import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteVaultSessionFactory } from "../context/infra/session-factory.js";
import type { Clock, IdGenerator } from "../shared/application/ports/clock.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import type { KeychainPort } from "../vault/application/ports/keychain.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";

export class FakeKeychain implements KeychainPort {
  private readonly store = new Map<string, string>();
  setKey(vaultId: string, keyHex: string): void {
    this.store.set(vaultId, keyHex);
  }
  getKey(vaultId: string): string | null {
    return this.store.get(vaultId) ?? null;
  }
  deleteKey(vaultId: string): boolean {
    return this.store.delete(vaultId);
  }
}

export class FixedClock implements Clock {
  private current: Date;
  constructor(start = new Date("2026-07-11T12:00:00Z")) {
    this.current = start;
  }
  now(): Date {
    return this.current;
  }
  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SeqIds implements IdGenerator {
  private n = 0;
  next(): string {
    return `01SEQ${String(++this.n).padStart(6, "0")}`;
  }
}

export interface TestVault {
  paths: VaultPaths;
  store: FileVaultStore;
  keychain: FakeKeychain;
  factory: SqliteVaultSessionFactory;
  keyHex: string;
  vaultId: string;
}

/** An initialized, unlocked vault on a temp dir — no Argon2, fast. */
export function makeUnlockedVault(): TestVault {
  const root = mkdtempSync(join(tmpdir(), "valija-app-"));
  const paths = resolveVaultPaths(root);
  const store = new FileVaultStore(paths);
  const keychain = new FakeKeychain();
  const keyHex = randomBytes(32).toString("hex");
  const vaultId = "01TESTVAULT";
  store.writeHeader({
    vaultId,
    schemaVersion: 1,
    kdf: { algorithm: "argon2id", memoryKiB: 8192, iterations: 1, parallelism: 1 },
    salt: randomBytes(16),
    createdAt: "2026-07-11T00:00:00Z",
  });
  const init = store.initializeDb(keyHex);
  if (!init.ok) throw new Error(init.error.message);
  keychain.setKey(vaultId, keyHex);
  return {
    paths,
    store,
    keychain,
    factory: new SqliteVaultSessionFactory(paths, keychain),
    keyHex,
    vaultId,
  };
}
