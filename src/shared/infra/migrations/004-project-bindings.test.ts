import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION, migrate, schemaVersion } from "../migrations.js";
import { openVaultDb } from "../sqlite.js";
import { MIGRATION_001 } from "./001-init.js";
import { MIGRATION_002 } from "./002-imported-type.js";
import { MIGRATION_003 } from "./003-lineage.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-migration-004-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Build a populated schema-v3 vault at `path` and leave the handle open. */
function buildV3(path: string): Database {
  const db = openVaultDb(path, randomBytes(32).toString("hex"));
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(MIGRATION_001);
  db.exec(MIGRATION_002);
  db.exec(MIGRATION_003);
  db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '3')").run();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'demo', '2026', '2026')",
  ).run();
  db.prepare(
    "INSERT INTO context_items (id, project_id, type, content, tags, pinned, archived, created_at, updated_at) " +
      "VALUES ('i1', '01P', 'decision', 'we chose sqlcipher for encryption', '[\"db\"]', 0, 0, '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

const hasBindingsTable = (db: Database): boolean =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'project_bindings'")
    .get() !== undefined;

const bindingCount = (db: Database): number =>
  (db.prepare("SELECT count(*) AS n FROM project_bindings").get() as { n: number }).n;

const ftsHits = (db: Database, term: string): unknown[] =>
  db.prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH ?").all(term);

const insertBinding = (db: Database, id: string, kind: string, target: string): void => {
  db.prepare(
    "INSERT INTO project_bindings (id, project_id, kind, target, created_at) VALUES (?, '01P', ?, ?, '2026')",
  ).run(id, kind, target);
};

describe("migration 004 — project bindings", () => {
  it("a fresh init reaches the latest schema with an empty bindings table", () => {
    const path = join(tmp, "fresh.db");
    const db = openVaultDb(path, randomBytes(32).toString("hex"));
    migrate(db, path);
    expect(LATEST_SCHEMA_VERSION).toBe(4);
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    expect(hasBindingsTable(db)).toBe(true);
    expect(bindingCount(db)).toBe(0);
    db.close();
  });

  it("upgrades a populated v3 vault to v4 without losing rows or search", () => {
    const path = join(tmp, "populated.db");
    const db = buildV3(path);
    const projects = db.prepare("SELECT * FROM projects ORDER BY id").all();
    const items = db.prepare("SELECT * FROM context_items ORDER BY id").all();

    migrate(db, path);

    expect(schemaVersion(db)).toBe(4);
    expect(db.prepare("SELECT * FROM projects ORDER BY id").all()).toEqual(projects);
    expect(db.prepare("SELECT * FROM context_items ORDER BY id").all()).toEqual(items);
    expect(ftsHits(db, "sqlcipher")).toHaveLength(1);
    expect(bindingCount(db)).toBe(0);
    db.close();
  });

  it("takes a ciphertext backup and removes it on success", () => {
    const path = join(tmp, "backup.db");
    const db = buildV3(path);
    migrate(db, path);
    expect(existsSync(`${path}.pre-004.bak`)).toBe(false);
    db.close();
  });

  it("is a no-op once at v4", () => {
    const path = join(tmp, "idempotent.db");
    const db = buildV3(path);
    migrate(db, path);
    insertBinding(db, "b1", "folder", "/work/valija");
    migrate(db, path);
    expect(schemaVersion(db)).toBe(4);
    expect(bindingCount(db)).toBe(1);
    db.close();
  });

  it("re-applies cleanly when the marker is rolled back to 3 over a v4 database (F6)", () => {
    const path = join(tmp, "rollback.db");
    const db = buildV3(path);
    migrate(db, path);
    insertBinding(db, "b1", "repository", "github.com/oscar/valija");
    db.prepare("UPDATE meta SET value = '3' WHERE key = 'schema_version'").run();

    expect(() => migrate(db, path)).not.toThrow();

    expect(schemaVersion(db)).toBe(4);
    expect(bindingCount(db)).toBe(1);
    db.close();
  });

  it("holds UNIQUE (kind, target) and the CHECK on kind", () => {
    const path = join(tmp, "constraints.db");
    const db = buildV3(path);
    migrate(db, path);
    insertBinding(db, "b1", "folder", "/work/valija");

    expect(() => insertBinding(db, "b2", "folder", "/work/valija")).toThrow(/UNIQUE/);
    expect(() => insertBinding(db, "b3", "repository", "/work/valija")).not.toThrow();
    expect(() => insertBinding(db, "b4", "marker", "/work/other")).toThrow(/CHECK/);
    expect(bindingCount(db)).toBe(2);
    db.close();
  });
});
