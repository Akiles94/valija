import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import SqliteDatabase, { type Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { setStoredSchemaVersion, snapshotVaultFiles } from "../../testing/schema-skew.js";
import {
  LATEST_SCHEMA_VERSION,
  migrate,
  pendingMigrations,
  SchemaTooNewError,
  schemaVersion,
} from "./migrations.js";
import { openVaultDb } from "./sqlite.js";
import { resolveVaultPaths } from "./vault-paths.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-migrations-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("Migrations", () => {
  it("applies the latest schema and is idempotent", () => {
    const db = openVaultDb(join(tmp, "idempotent.db"), randomBytes(32).toString("hex"));
    migrate(db);
    migrate(db);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });

  it("FTS triggers keep the index in sync on insert, update, and delete visibility", () => {
    const db = openVaultDb(join(tmp, "fts.db"), randomBytes(32).toString("hex"));
    migrate(db);
    db.prepare(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'p', '2026', '2026')",
    ).run();
    db.prepare(
      "INSERT INTO context_items (id, project_id, type, content, tags, created_at, updated_at) " +
        "VALUES ('01I', '01P', 'decision', 'we chose sqlcipher for encryption', '[\"db\"]', '2026', '2026')",
    ).run();

    const hits = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'sqlcipher'")
      .all();
    expect(hits).toHaveLength(1);

    db.prepare("UPDATE context_items SET content = 'we chose argon2id' WHERE id = '01I'").run();
    const stale = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'sqlcipher'")
      .all();
    const fresh = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'argon2id'")
      .all();
    expect(stale).toHaveLength(0);
    expect(fresh).toHaveLength(1);
    db.close();
  });

  it("LATEST_SCHEMA_VERSION matches the highest version applied by migrate", () => {
    const db = openVaultDb(join(tmp, "latest.db"), randomBytes(32).toString("hex"));
    migrate(db);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });

  it("pendingMigrations(current) reports only migrations after current, with their backup flag", () => {
    expect(pendingMigrations(0)).toEqual([
      { version: 1, backsUpCiphertext: false },
      { version: 2, backsUpCiphertext: true },
      { version: 3, backsUpCiphertext: true },
      { version: 4, backsUpCiphertext: true },
    ]);
    expect(pendingMigrations(2)).toEqual([
      { version: 3, backsUpCiphertext: true },
      { version: 4, backsUpCiphertext: true },
    ]);
    expect(pendingMigrations(LATEST_SCHEMA_VERSION)).toEqual([]);
  });
});

/** A keyed connection with none of openVaultDb's refusal or pragmas — to hand `migrate` a newer vault directly. */
function rawOpen(path: string, keyHex: string): Database {
  const db = new SqliteDatabase(path);
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key="x'${keyHex}'"`);
  return db;
}

/** A migrated vault folder (a stub header so the snapshot helper has both files) whose marker reads `version`. */
function vaultAt(name: string, version: number) {
  const paths = resolveVaultPaths(join(tmp, name));
  mkdirSync(paths.root, { recursive: true });
  writeFileSync(paths.header, "{}");
  const keyHex = randomBytes(32).toString("hex");
  const db = openVaultDb(paths.db, keyHex);
  migrate(db, paths.db);
  db.close();
  setStoredSchemaVersion(paths.db, keyHex, version);
  return { paths, keyHex };
}

describe("Migrations — newer-schema backstop (D-E)", () => {
  it("migrate refuses a vault newer than this build with both numbers", () => {
    const { paths, keyHex } = vaultAt("too-new", LATEST_SCHEMA_VERSION + 1);
    const db = rawOpen(paths.db, keyHex);
    let caught: unknown;
    try {
      migrate(db, paths.db);
    } catch (error) {
      caught = error;
    } finally {
      db.close();
    }
    expect(caught).toBeInstanceOf(SchemaTooNewError);
    expect((caught as SchemaTooNewError).vaultVersion).toBe(LATEST_SCHEMA_VERSION + 1);
    expect((caught as SchemaTooNewError).supportedVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it("the refused vault is byte-for-byte untouched and leaves no .pre-*.bak", () => {
    const { paths, keyHex } = vaultAt("too-new-inert", LATEST_SCHEMA_VERSION + 1);
    const before = snapshotVaultFiles(paths);
    const db = rawOpen(paths.db, keyHex);
    expect(() => migrate(db, paths.db)).toThrow(SchemaTooNewError);
    db.close();
    expect(snapshotVaultFiles(paths)).toEqual(before);
    expect(readdirSync(paths.root).some((f) => f.includes(".pre-"))).toBe(false);
  });

  it("a brand-new database has no meta table: schemaVersion is 0 and migrate reaches LATEST", () => {
    const db = rawOpen(join(tmp, "brand-new.db"), randomBytes(32).toString("hex"));
    expect(schemaVersion(db)).toBe(0);
    migrate(db);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });
});
