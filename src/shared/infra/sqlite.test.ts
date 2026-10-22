import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import SqliteDatabase, { type Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import { LATEST_SCHEMA_VERSION, migrate, SchemaTooNewError } from "./migrations.js";
import {
  isBusyError,
  isWrongKeyError,
  openVaultDb,
  probeSchemaVersion,
  SQLITE_BUSY_TIMEOUT_MS,
} from "./sqlite.js";
import { resolveVaultPaths } from "./vault-paths.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-sqlite-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const newKey = () => randomBytes(32).toString("hex");

describe("SQLCipher engine", () => {
  it("creates, closes, and reopens with the same key", () => {
    const path = join(tmp, "reopen.db");
    const key = newKey();

    const db = openVaultDb(path, key);
    migrate(db);
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "01P",
      "vault-app",
      "2026-07-11",
      "2026-07-11",
    );
    db.close();

    const reopened = openVaultDb(path, key);
    const row = reopened.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("vault-app");
    reopened.close();
  });

  it("fails to open with a wrong key", () => {
    const path = join(tmp, "wrongkey.db");
    const db = openVaultDb(path, newKey());
    migrate(db);
    db.close();

    let caught: unknown;
    try {
      openVaultDb(path, newKey());
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(isWrongKeyError(caught)).toBe(true);
  });

  it("rejects a malformed key before touching disk", () => {
    expect(() => openVaultDb(join(tmp, "never.db"), "not-hex")).toThrow(/64 hex/);
  });

  it("is a single self-consistent file at rest after every command, not only after lock", () => {
    const path = join(tmp, "single-file.db");
    const key = newKey();

    const db = openVaultDb(path, key);
    migrate(db, path);
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "01P",
      "single-file",
      "2026-07-23",
      "2026-07-23",
    );
    db.close();

    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
    expect(existsSync(`${path}-journal`)).toBe(false);

    // A bare copy of just vault.db, with no sidecars present, is the complete database.
    const copyPath = join(tmp, "single-file-copy.db");
    copyFileSync(path, copyPath);
    const reopened = openVaultDb(copyPath, key);
    const row = reopened.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("single-file");
    reopened.close();
  });

  it("folds an existing WAL from a pre-upgrade vault into vault.db on open", () => {
    const path = join(tmp, "pre-upgrade.db");
    const key = newKey();

    // Simulate a 0.2.x vault left in WAL mode with a live -wal sidecar.
    const legacy = openVaultDb(path, key);
    legacy.pragma("journal_mode = WAL");
    migrate(legacy, path);
    legacy
      .prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run("01P", "legacy", "2026-07-23", "2026-07-23");
    // Leave the connection open with committed data still possibly sitting in -wal.
    legacy.close();

    const upgraded = openVaultDb(path, key);
    expect(upgraded.pragma("journal_mode", { simple: true })).toBe("delete");
    const row = upgraded.prepare("SELECT name FROM projects WHERE id = '01P'").get() as {
      name: string;
    };
    expect(row.name).toBe("legacy");
    upgraded.close();

    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
  });

  it("the busy timeout is explicit in code, matching the library's own default (D-J(a))", () => {
    expect(SQLITE_BUSY_TIMEOUT_MS).toBe(5000);
  });
});

/** A keyed connection with none of openVaultDb's refusal or pragmas. */
function rawOpen(path: string, keyHex: string, timeout = SQLITE_BUSY_TIMEOUT_MS): Database {
  const db = new SqliteDatabase(path, { timeout });
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key="x'${keyHex}'"`);
  return db;
}

/** A migrated vault folder (stub header, for the snapshot) whose marker reads `version`. */
function vaultAt(name: string, version: number) {
  const paths = resolveVaultPaths(join(tmp, name));
  mkdirSync(paths.root, { recursive: true });
  writeFileSync(paths.header, "{}");
  const keyHex = newKey();
  const db = openVaultDb(paths.db, keyHex);
  migrate(db, paths.db);
  db.exec("CREATE TABLE spill (x BLOB)");
  db.close();
  setStoredSchemaVersion(paths.db, keyHex, version);
  return { paths, keyHex };
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

/**
 * The Slice 0 recipe: an uncommitted transaction that spills to disk, its `vault.db` and
 * `vault.db-journal` copied mid-flight — the state a crash leaves behind.
 */
function hotJournalCopy(name: string, version: number) {
  const source = vaultAt(`${name}-source`, version);
  const target = resolveVaultPaths(join(tmp, name));
  mkdirSync(target.root, { recursive: true });
  writeFileSync(target.header, "{}");
  const db = rawOpen(source.paths.db, source.keyHex);
  db.pragma("cache_size = 1");
  db.exec("BEGIN");
  const insert = db.prepare("INSERT INTO spill VALUES (randomblob(4096))");
  for (let i = 0; i < 300; i++) insert.run();
  copyFileSync(source.paths.db, target.db);
  copyFileSync(`${source.paths.db}-journal`, `${target.db}-journal`);
  db.close();
  return { paths: target, keyHex: source.keyHex };
}

describe("SQLCipher engine — newer-schema refusal (D-F)", () => {
  it("openVaultDb refuses a newer vault with both numbers and leaves its bytes untouched", () => {
    const { paths, keyHex } = vaultAt("open-too-new", LATEST_SCHEMA_VERSION + 1);
    const before = snapshotVaultFiles(paths);
    const caught = thrownBy(() => openVaultDb(paths.db, keyHex));
    expect(caught).toBeInstanceOf(SchemaTooNewError);
    expect((caught as SchemaTooNewError).vaultVersion).toBe(LATEST_SCHEMA_VERSION + 1);
    expect(snapshotVaultFiles(paths)).toEqual(before);
  });

  it("refuses before the journal pragmas: a WAL-mode newer vault is never switched to DELETE", () => {
    const { paths, keyHex } = vaultAt("open-too-new-wal", LATEST_SCHEMA_VERSION + 1);
    const wal = rawOpen(paths.db, keyHex);
    wal.pragma("journal_mode = WAL");
    wal.close();

    expect(() => openVaultDb(paths.db, keyHex)).toThrow(SchemaTooNewError);

    const raw = rawOpen(paths.db, keyHex);
    expect(raw.pragma("journal_mode", { simple: true })).toBe("wal");
    raw.close();
  });

  it("probeSchemaVersion reports a newer and a current vault without changing any bytes", () => {
    const newer = vaultAt("probe-newer", LATEST_SCHEMA_VERSION + 1);
    const current = vaultAt("probe-current", LATEST_SCHEMA_VERSION);
    const before = [snapshotVaultFiles(newer.paths), snapshotVaultFiles(current.paths)];

    expect(probeSchemaVersion(newer.paths.db, newer.keyHex)).toBe(LATEST_SCHEMA_VERSION + 1);
    expect(probeSchemaVersion(current.paths.db, current.keyHex)).toBe(LATEST_SCHEMA_VERSION);
    expect([snapshotVaultFiles(newer.paths), snapshotVaultFiles(current.paths)]).toEqual(before);
  });

  it("probeSchemaVersion throws SQLITE_NOTADB on a wrong key", () => {
    const { paths } = vaultAt("probe-wrong-key", LATEST_SCHEMA_VERSION);
    expect(isWrongKeyError(thrownBy(() => probeSchemaVersion(paths.db, newKey())))).toBe(true);
  });

  it("on a hot journal the probe falls back, SQLite rolls the journal back, and the version is still reported", () => {
    const { paths, keyHex } = hotJournalCopy("probe-hot", LATEST_SCHEMA_VERSION + 1);
    expect(existsSync(`${paths.db}-journal`)).toBe(true);

    expect(probeSchemaVersion(paths.db, keyHex)).toBe(LATEST_SCHEMA_VERSION + 1);

    expect(existsSync(`${paths.db}-journal`)).toBe(false);
    const raw = rawOpen(paths.db, keyHex);
    expect(raw.prepare("SELECT count(*) AS n FROM spill").get()).toEqual({ n: 0 });
    raw.close();
  });

  it("isBusyError recognises a write lock held past the timeout, and nothing else", () => {
    const { paths, keyHex } = vaultAt("busy", LATEST_SCHEMA_VERSION);
    const holder = rawOpen(paths.db, keyHex);
    holder.exec("BEGIN IMMEDIATE");
    const contender = rawOpen(paths.db, keyHex, 0);
    const caught = thrownBy(() => contender.exec("INSERT INTO spill VALUES (x'00')"));
    holder.exec("ROLLBACK");
    holder.close();
    contender.close();

    expect(isBusyError(caught)).toBe(true);
    expect(isBusyError(new Error("database is locked"))).toBe(false);
    expect(isBusyError(thrownBy(() => probeSchemaVersion(paths.db, newKey())))).toBe(false);
  });
});
