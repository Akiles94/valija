import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import type { Database } from "better-sqlite3-multiple-ciphers";
import type { ContextItem } from "../context/domain/entities/context-item.js";
import type { Project } from "../context/domain/entities/project.js";
import type { Content } from "../context/domain/values/content.js";
import type { ItemType, StorableItemType } from "../context/domain/values/item-type.js";
import type { ProjectName } from "../context/domain/values/project-name.js";
import type { Tag } from "../context/domain/values/tag.js";
import { SqliteContextItemRepository } from "../context/infra/item-repo.js";
import { SqliteProjectRepository } from "../context/infra/project-repo.js";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import type { Clock, IdGenerator } from "../shared/application/ports/clock.js";
import { migrate } from "../shared/infra/migrations.js";
import { openVaultDb } from "../shared/infra/sqlite.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { SessionGuard } from "../vault/application/policies/session-guard.js";
import { parseAutoLockTtl } from "../vault/domain/values/auto-lock-ttl.js";
import type { DeviceId } from "../vault/domain/values/device-id.js";
import { bytesToHex } from "../vault/domain/values/key-hex.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { SqliteLineageStore } from "../vault/infra/sqlite-lineage-store.js";
import { writeVaultHeader } from "../vault/infra/vault-header.js";
import { FakeDeviceIdentity, FakeKeychain, FixedClock } from "./test-vault.js";

/** The published, machine-readable parameter set for the golden vault fixture. */
export interface GoldenVaultManifest {
  fixtureVersion: number;
  vaultId: string;
  /** Public test passphrase — never a real secret. See the fixture README. */
  passphrase: string;
  /** The raw 32-byte key (64 hex chars) the passphrase derives to. Filled by regeneration. */
  keyHex: string;
  saltBase64: string;
  kdf: { algorithm: "argon2id"; memoryKiB: number; iterations: number; parallelism: number };
  /** The database's schema_version (currently 3) — distinct from the header's schemaVersion. */
  schemaVersion: number;
  /** The plaintext header's schemaVersion field — always the literal 1. */
  headerSchemaVersion: 1;
  createdAt: string;
  /** The Clock time used to render the expected pack/export ("generated <ISO>" line). */
  generatedAt: string;
  packBudgetTokens: number;
  searchLimitDefault: number;
  /** The device id the one lineage bump below is attributed to. */
  deviceId: string;
  /** The write stamp minted for that one lineage bump. */
  writeStamp: string;
  /** Probed SQLCipher parameters — filled by the cipher-parameter probe. */
  cipher: Record<string, string | number>;
  /** The first 16 bytes of vault.db, as hex — the raw-key salt convention. Filled by regeneration. */
  fileSaltHex: string;
}

interface SeedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface SeedItem {
  id: string;
  projectId: string;
  type: StorableItemType;
  content: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoldenVaultSeed {
  projects: SeedProject[];
  items: SeedItem[];
}

/** The fixture directory, so both the generator and the conformance test agree on where it lives. */
export const GOLDEN_VAULT_DIR = new URL("./__fixtures__/golden-vault/", import.meta.url);

const manifestPath = () => new URL("manifest.json", GOLDEN_VAULT_DIR);
const seedPath = () => new URL("seed.json", GOLDEN_VAULT_DIR);

/**
 * Typed JSON reads for repo-owned fixture data — not `parseX`. `parseX -> Result`
 * is this codebase's convention for untrusted input crossing a domain boundary;
 * this is committed test data read by test-support code, where a throw on
 * malformed data is simpler and a Result would only ever be unwrapped with a
 * throw anyway. See plan.md §7 for the fuller reasoning.
 */
export function readGoldenVaultManifest(): GoldenVaultManifest {
  return JSON.parse(readFileSync(manifestPath(), "utf8")) as GoldenVaultManifest;
}

export function readGoldenVaultSeed(): GoldenVaultSeed {
  return JSON.parse(readFileSync(seedPath(), "utf8")) as GoldenVaultSeed;
}

/** Returns ids from a fixed list, one per call — deterministic and realistic-looking. */
export class FixedIds implements IdGenerator {
  private i = 0;
  constructor(private readonly ids: readonly string[]) {}
  next(): string {
    const id = this.ids[this.i];
    if (id === undefined) throw new Error("FixedIds exhausted — add more ids to the list.");
    this.i += 1;
    return id;
  }
}

const toProjectEntity = (row: SeedProject): Project => ({
  id: row.id,
  name: row.name as ProjectName,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

const toItemEntity = (row: SeedItem): ContextItem => ({
  id: row.id,
  projectId: row.projectId,
  type: row.type as ItemType,
  content: row.content as Content,
  tags: row.tags as Tag[],
  pinned: row.pinned,
  ...(row.source === undefined ? {} : { source: row.source }),
  archived: row.archived,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

/**
 * Build the golden vault at `root` from the manifest + seed, through the real
 * write path (repositories, migrations, FTS triggers) — so the fixture is
 * shaped exactly like a vault a user's `valija` produced, not a hand-rolled
 * approximation of one.
 */
export async function buildGoldenVault(
  root: string,
  manifest: GoldenVaultManifest,
  seed: GoldenVaultSeed,
): Promise<{ paths: VaultPaths; keyHex: string }> {
  const paths = resolveVaultPaths(root);
  const salt = new Uint8Array(Buffer.from(manifest.saltBase64, "base64"));
  const key = await new Argon2VaultCrypto().deriveKey(manifest.passphrase, salt, manifest.kdf);
  const keyHex = bytesToHex(key);

  writeVaultHeader(paths.header, {
    vaultId: manifest.vaultId,
    schemaVersion: manifest.headerSchemaVersion,
    kdf: manifest.kdf,
    salt,
    createdAt: manifest.createdAt,
  });

  const db = openVaultDb(paths.db, keyHex);
  migrate(db, paths.db);

  const projects = new SqliteProjectRepository(db);
  const items = new SqliteContextItemRepository(db);
  for (const project of seed.projects) projects.save(toProjectEntity(project));
  for (const item of seed.items) items.save(toItemEntity(item));

  const lineageIds = new FixedIds([manifest.writeStamp]);
  const lineageClock: Clock = { now: () => new Date(manifest.createdAt) };
  new SqliteLineageStore(db, lineageIds, lineageClock).bump(manifest.deviceId as DeviceId);

  db.close();
  return { paths, keyHex };
}

/**
 * Copy the committed fixture into a fresh temp root and return its paths.
 * `openVaultDb` writes on open (WAL checkpoint, journal switch), so every
 * reader goes through this rather than opening the committed files in
 * place — the same snapshot-copy discipline the format contract prescribes
 * for a mobile reader (D-H).
 */
export function copyGoldenVaultTo(destRoot: string): VaultPaths {
  const paths = resolveVaultPaths(destRoot);
  mkdirSync(destRoot, { recursive: true });
  copyFileSync(new URL("vault.json", GOLDEN_VAULT_DIR), paths.header);
  copyFileSync(new URL("vault.db", GOLDEN_VAULT_DIR), paths.db);
  return paths;
}

export interface GoldenVaultReader {
  sessions: SqliteVaultSessions;
  clock: FixedClock;
  close(): void;
}

/**
 * Wire a session over an already-copied golden vault root, seeded with the
 * published key so no passphrase derivation is needed to read it. `close()`
 * only forgets the in-memory keychain entry — callers own removing the temp
 * directory `copyGoldenVaultTo` created.
 */
export function makeGoldenVaultReader(
  root: string,
  manifest: GoldenVaultManifest,
): GoldenVaultReader {
  const paths = resolveVaultPaths(root);
  const keychain = new FakeKeychain();
  keychain.setKey(manifest.vaultId, manifest.keyHex);
  const readerIds = new FixedIds(["reader-device-noop"]);
  const deviceIdentity = new FakeDeviceIdentity(readerIds);
  const clock = new FixedClock(new Date(manifest.generatedAt));
  const guard = new SessionGuard(deviceIdentity, keychain, clock, parseAutoLockTtl(undefined));
  const sessions = new SqliteVaultSessions(
    paths,
    keychain,
    deviceIdentity,
    guard,
    readerIds,
    clock,
  );
  return {
    sessions,
    clock,
    close: () => keychain.deleteKey(manifest.vaultId),
  };
}

// The SQLCipher parameters that must line up with a second implementation.
// Not a list read off documentation: `readCipherParameters` tries each of
// these against the live database and keeps only the ones that actually
// answer, so a build that stops (or starts) exposing one is caught by the
// conformance test rather than assumed away.
const CIPHER_PRAGMA_CANDIDATES = [
  "cipher",
  "page_size",
  "kdf_iter",
  "fast_kdf_iter",
  "hmac_use",
  "hmac_pgno",
  "hmac_salt_mask",
  "kdf_algorithm",
  "hmac_algorithm",
  "plaintext_header_size",
  "legacy",
  "legacy_page_size",
  "cipher_salt",
  "cipher_version",
  "cipher_provider",
  "cipher_provider_version",
  "cipher_default_kdf_iter",
  "cipher_compatibility",
] as const;

/** Probe the live database for the parameters an official SQLCipher build must match. */
export function readCipherParameters(db: Database): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const name of CIPHER_PRAGMA_CANDIDATES) {
    let value: unknown;
    try {
      value = db.pragma(name, { simple: true });
    } catch {
      continue; // this build does not recognize the pragma — not every candidate will hit
    }
    if (typeof value === "string" || typeof value === "number") {
      if (value !== "") result[name] = value;
    }
  }
  return result;
}

/** The raw-key salt convention (A4): the file's first 16 bytes, as hex. */
export function readFileSaltHex(dbPath: string): string {
  const buf = readFileSync(dbPath);
  return buf.subarray(0, 16).toString("hex").toUpperCase();
}
