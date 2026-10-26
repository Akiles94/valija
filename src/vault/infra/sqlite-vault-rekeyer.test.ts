import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LATEST_SCHEMA_VERSION, schemaVersion } from "../../shared/infra/migrations.js";
import { openVaultDb } from "../../shared/infra/sqlite.js";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import { makeUnlockedVault, type TestVault } from "../../testing/test-vault.js";
import { contentChecksum, seedVaultContent } from "../../testing/vault-content.js";
import { createDeviceId } from "../domain/values/device-id.js";
import { SqliteLineageStore } from "./sqlite-lineage-store.js";
import {
  REKEY_BACKUP_SUFFIX,
  REKEY_BUSY_MESSAGE,
  type RekeyStage,
  SqliteVaultRekeyer,
} from "./sqlite-vault-rekeyer.js";

/** Switches for the passthrough mocks below: each test turns on only the fault it injects. */
const faults = vi.hoisted(() => ({
  freeBytes: null as number | null,
  failOpenWithKey: null as string | null,
  failRename: false,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    statfsSync: ((path: string) =>
      faults.freeBytes === null
        ? actual.statfsSync(path)
        : {
            ...actual.statfsSync(path),
            bavail: faults.freeBytes,
            bsize: 1,
          }) as typeof actual.statfsSync,
    renameSync: ((from: string, to: string) => {
      if (faults.failRename) throw Object.assign(new Error("EPERM"), { code: "EPERM" });
      actual.renameSync(from, to);
    }) as typeof actual.renameSync,
  };
});

vi.mock("../../shared/infra/sqlite.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/infra/sqlite.js")>();
  return {
    ...actual,
    openVaultDb: (dbPath: string, keyHex: string) => {
      if (keyHex === faults.failOpenWithKey) {
        throw Object.assign(new Error("database disk image is malformed"), {
          code: "SQLITE_CORRUPT",
        });
      }
      return actual.openVaultDb(dbPath, keyHex);
    },
  };
});

const newKey = (): string => randomBytes(32).toString("hex");
const HEX_RUN = /[0-9a-f]{64}/i;

let vault: TestVault;

afterEach(() => {
  faults.freeBytes = null;
  faults.failOpenWithKey = null;
  faults.failRename = false;
  rmSync(vault.paths.root, { recursive: true, force: true });
});

/** An unlocked vault with projects, bindings and items, written once (generation 0). */
function seededVault(): TestVault {
  const v = makeUnlockedVault();
  seedVaultContent(v.paths.db, v.keyHex, { projects: 3, items: 40, wordsPerItem: 60 });
  const db = openVaultDb(v.paths.db, v.keyHex);
  db.transaction(() =>
    new SqliteLineageStore(db, v.idGen, v.clock).bump(createDeviceId(v.idGen)),
  )();
  db.close();
  return v;
}

function rekeyerFor(v: TestVault, stages: RekeyStage[] = []): SqliteVaultRekeyer {
  return new SqliteVaultRekeyer(v.paths, v.idGen, v.clock, (stage) => stages.push(stage));
}

function rekey(v: TestVault, newKeyHex: string, stages: RekeyStage[] = []) {
  return rekeyerFor(v, stages).rekey({
    currentKeyHex: v.keyHex,
    newKeyHex,
    writer: v.deviceIdentity.deviceId(),
  });
}

function opens(dbPath: string, keyHex: string): boolean | string {
  try {
    const db = openVaultDb(dbPath, keyHex);
    const integrity = db.pragma("integrity_check", { simple: true });
    db.close();
    return integrity === "ok" ? true : String(integrity);
  } catch (error) {
    return (error as { code?: string }).code ?? "error";
  }
}

const backupOf = (v: TestVault): string => `${v.paths.db}${REKEY_BACKUP_SUFFIX}`;

describe("SqliteVaultRekeyer — success", () => {
  it("re-encrypts in place: NEW opens, OLD gives SQLITE_NOTADB, content and lineage as promised", () => {
    vault = seededVault();
    const before = contentChecksum(vault.paths.db, vault.keyHex);
    const NEW = newKey();
    const stages: RekeyStage[] = [];

    const result = rekey(vault, NEW, stages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(opens(vault.paths.db, NEW)).toBe(true);
    expect(opens(vault.paths.db, vault.keyHex)).toBe("SQLITE_NOTADB");
    expect(contentChecksum(vault.paths.db, NEW)).toBe(before);
    expect(result.value.generation).toBe(1);
    expect(result.value.writer).toBe(vault.deviceIdentity.deviceId());
    const db = openVaultDb(vault.paths.db, NEW);
    expect(new SqliteLineageStore(db, vault.idGen, vault.clock).read()).toEqual(result.value);
    db.close();
    expect(stages).toEqual([
      "locked",
      "bumped",
      "backed-up",
      "rekeying",
      "rekeyed",
      "released",
      "verified",
    ]);
  });

  it("leaves vault.json byte-identical, the cipher salt unchanged, no sidecar, no backup, DELETE journal", () => {
    vault = seededVault();
    const header = readFileSync(vault.paths.header);
    const salt = readFileSync(vault.paths.db).subarray(0, 16);
    const NEW = newKey();

    expect(rekey(vault, NEW).ok).toBe(true);

    expect(readFileSync(vault.paths.header).equals(header)).toBe(true);
    expect(readFileSync(vault.paths.db).subarray(0, 16).equals(salt)).toBe(true);
    for (const suffix of ["-wal", "-shm", "-journal", REKEY_BACKUP_SUFFIX]) {
      expect(existsSync(`${vault.paths.db}${suffix}`)).toBe(false);
    }
    const db = openVaultDb(vault.paths.db, NEW);
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.close();
  });

  it("re-keys a behind-schema vault without migrating it (D-J)", () => {
    vault = seededVault();
    setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION - 1);
    const NEW = newKey();

    expect(rekey(vault, NEW).ok).toBe(true);

    const db = openVaultDb(vault.paths.db, NEW);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION - 1);
    db.close();
  });
});

describe("SqliteVaultRekeyer — refusals before anything is written", () => {
  it("refuses when free disk space is under three times the database (D-P)", () => {
    vault = seededVault();
    const before = snapshotVaultFiles(vault.paths);
    faults.freeBytes = 1;

    const result = rekey(vault, newKey());

    expect(!result.ok && result.error.code).toBe("STORAGE_ERROR");
    expect(!result.ok && result.error.message).toContain("disk space");
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("refuses a newer schema through openVaultDb, bytes untouched", () => {
    vault = seededVault();
    setStoredSchemaVersion(vault.paths.db, vault.keyHex, LATEST_SCHEMA_VERSION + 1);
    const before = snapshotVaultFiles(vault.paths);

    const result = rekey(vault, newKey());

    expect(!result.ok && result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("refuses a malformed new key before opening anything (a bad x'…' would become a passphrase)", () => {
    vault = seededVault();
    const before = snapshotVaultFiles(vault.paths);

    const result = rekey(vault, "zz");

    expect(!result.ok && result.error.code).toBe("REKEY_FAILED");
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("refuses a current key that does not open the vault", () => {
    vault = seededVault();
    const before = snapshotVaultFiles(vault.paths);

    const result = rekeyerFor(vault).rekey({
      currentKeyHex: newKey(),
      newKeyHex: newKey(),
      writer: vault.deviceIdentity.deviceId(),
    });

    expect(!result.ok && result.error.code).toBe("WRONG_PASSPHRASE");
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("gives up busy after the 5 s timeout while another process holds the write lock", async () => {
    vault = seededVault();
    const before = snapshotVaultFiles(vault.paths);
    const holder = await holdWriteLock(vault, 6_500);

    const result = rekey(vault, newKey());
    await holder.exited;

    expect(!result.ok && result.error.code).toBe("STORAGE_ERROR");
    expect(!result.ok && result.error.message).toBe(REKEY_BUSY_MESSAGE);
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
    expect(opens(vault.paths.db, vault.keyHex)).toBe(true);
  }, 20_000);
});

describe("SqliteVaultRekeyer — failures", () => {
  it("a journal that cannot be created fails with REKEY_FAILED, nothing changed, no backup (S9 ii)", () => {
    vault = seededVault();
    const before = contentChecksum(vault.paths.db, vault.keyHex);
    mkdirSync(`${vault.paths.db}-journal`);

    const result = rekey(vault, newKey());

    expect(!result.ok && result.error.code).toBe("REKEY_FAILED");
    expect(!result.ok && result.error.message).toContain("Nothing changed");
    expect(!result.ok && result.error.message).not.toMatch(HEX_RUN);
    expect(existsSync(backupOf(vault))).toBe(false);
    rmSync(`${vault.paths.db}-journal`, { recursive: true });
    expect(opens(vault.paths.db, vault.keyHex)).toBe(true);
    expect(contentChecksum(vault.paths.db, vault.keyHex)).toBe(before);
  });

  it("a re-encryption that does not verify restores the backup: OLD opens, content equal, no backup", () => {
    vault = seededVault();
    const before = contentChecksum(vault.paths.db, vault.keyHex);
    const NEW = newKey();
    faults.failOpenWithKey = NEW;

    const result = rekey(vault, NEW);

    expect(!result.ok && result.error.code).toBe("REKEY_FAILED");
    expect(!result.ok && result.error.message).toContain("restored from its backup");
    expect(!result.ok && result.error.message).not.toMatch(HEX_RUN);
    faults.failOpenWithKey = null;
    expect(opens(vault.paths.db, vault.keyHex)).toBe(true);
    expect(contentChecksum(vault.paths.db, vault.keyHex)).toBe(before);
    expect(existsSync(backupOf(vault))).toBe(false);
    expect(existsSync(`${vault.paths.db}-journal`)).toBe(false);
  });

  it("when the restore itself fails, the error names the backup, which is kept and opens with OLD", () => {
    vault = seededVault();
    const before = contentChecksum(vault.paths.db, vault.keyHex);
    const NEW = newKey();
    faults.failOpenWithKey = NEW;
    faults.failRename = true;

    const result = rekey(vault, NEW);

    expect(!result.ok && result.error.code).toBe("REKEY_FAILED");
    expect(!result.ok && result.error.message).toContain(backupOf(vault));
    expect(existsSync(backupOf(vault))).toBe(true);
    expect(opens(backupOf(vault), vault.keyHex)).toBe(true);
    expect(contentChecksum(backupOf(vault), vault.keyHex)).toBe(before);
  });
});

describe("SqliteVaultRekeyer — source rule (F4)", () => {
  it("uses only the raw-key PRAGMA rekey form, never the passphrase-style key APIs", () => {
    vault = makeUnlockedVault();
    const source = readFileSync(join(import.meta.dirname, "sqlite-vault-rekeyer.ts"), "utf8");
    expect(source).toContain(`rekey="x'`);
    expect(source).not.toContain(".rekey(");
    expect(source).not.toMatch(/hexrekey/i);
    expect(source).not.toMatch(/hexkey/i);
  });
});

/** Holds BEGIN IMMEDIATE on the vault from a worker thread for `ms` (the vault-sessions pattern). */
function holdWriteLock(v: TestVault, ms: number): Promise<{ exited: Promise<void> }> {
  const source = `
    const { parentPort, workerData } = require("node:worker_threads");
    const Sqlite = require("node:module").createRequire(workerData.anchor)("better-sqlite3-multiple-ciphers");
    const db = new Sqlite(workerData.path);
    db.pragma("cipher='sqlcipher'");
    db.pragma('key="x\\'' + workerData.key + '\\'"');
    db.exec("BEGIN IMMEDIATE");
    parentPort.postMessage("held");
    setTimeout(() => {
      db.exec("ROLLBACK");
      db.close();
    }, workerData.ms);
  `;
  const worker = new Worker(source, {
    eval: true,
    workerData: { anchor: import.meta.filename, path: v.paths.db, key: v.keyHex, ms },
  });
  const exited = new Promise<void>((resolve, reject) => {
    worker.once("exit", () => resolve());
    worker.once("error", reject);
  });
  return new Promise((resolve, reject) => {
    worker.once("message", () => resolve({ exited }));
    worker.once("error", reject);
  });
}
