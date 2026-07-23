import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { migrate, schemaVersion } from "../migrations.js";
import { openVaultDb } from "../sqlite.js";
import { MIGRATION_001 } from "./001-init.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-migration-002-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const columns =
  "id, project_id, type, content, tags, pinned, source, archived, created_at, updated_at";

/** Build a populated schema-v1 vault at `path` and leave the handle open. */
function buildV1(path: string): Database {
  const db = openVaultDb(path, randomBytes(32).toString("hex"));
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(MIGRATION_001);
  db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '1')").run();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'demo', '2026', '2026')",
  ).run();
  const insert = db.prepare(
    `INSERT INTO context_items (${columns})
     VALUES (@id, '01P', @type, @content, @tags, @pinned, @source, @archived, @created_at, @updated_at)`,
  );
  insert.run({
    id: "i1",
    type: "decision",
    content: "we chose sqlcipher for encryption",
    tags: '["db"]',
    pinned: 1,
    source: null,
    archived: 0,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
  insert.run({
    id: "i2",
    type: "fact",
    content: "argon2id parameters tuned",
    tags: '["crypto"]',
    pinned: 0,
    source: "claude",
    archived: 0,
    created_at: "2026-01-02",
    updated_at: "2026-01-02",
  });
  insert.run({
    id: "i3",
    type: "progress",
    content: "an archived note",
    tags: "[]",
    pinned: 0,
    source: null,
    archived: 1,
    created_at: "2026-01-03",
    updated_at: "2026-01-03",
  });
  return db;
}

const ftsHits = (db: Database, term: string): unknown[] =>
  db.prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH ?").all(term);

describe("migration 002 — imported type", () => {
  it("upgrades a populated v1 vault to v2 without losing data or search", () => {
    const path = join(tmp, "populated.db");
    const db = buildV1(path);
    const before = db.prepare(`SELECT ${columns} FROM context_items ORDER BY id`).all();

    migrate(db, path);

    expect(schemaVersion(db)).toBe(3); // 002 + 003 both apply from a fresh migrate() call
    expect(db.prepare(`SELECT ${columns} FROM context_items ORDER BY id`).all()).toEqual(before);
    expect(ftsHits(db, "sqlcipher")).toHaveLength(1); // FTS index survived the rebuild
    db.close();
  });

  it("accepts the imported type after the upgrade", () => {
    const path = join(tmp, "accepts.db");
    const db = buildV1(path);
    migrate(db, path);
    expect(() =>
      db
        .prepare(
          `INSERT INTO context_items (${columns})
           VALUES ('imp1', '01P', 'imported', 'hello', '["imported"]', 0, 'chatgpt-import', 0, '2024-01-01', '2026-07-17')`,
        )
        .run(),
    ).not.toThrow();
    db.close();
  });

  it("takes a ciphertext backup and removes it on success", () => {
    const path = join(tmp, "backup.db");
    const db = buildV1(path);
    migrate(db, path);
    expect(existsSync(`${path}.pre-002.bak`)).toBe(false);
    db.close();
  });

  it("is a no-op once at the latest schema version", () => {
    const path = join(tmp, "idempotent.db");
    const db = buildV1(path);
    migrate(db, path);
    migrate(db, path);
    expect(schemaVersion(db)).toBe(3);
    db.close();
  });

  it("rolls back a failed migration, keeping v1 intact and the backup", () => {
    const path = join(tmp, "rollback.db");
    const db = buildV1(path);
    db.exec("CREATE TABLE context_items_new (x TEXT)"); // makes the rebuild's CREATE fail

    expect(() => migrate(db, path)).toThrow();

    expect(schemaVersion(db)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM context_items").get()).toEqual({ n: 3 });
    expect(ftsHits(db, "sqlcipher")).toHaveLength(1); // triggers restored by rollback
    expect(existsSync(`${path}.pre-002.bak`)).toBe(true); // backup kept for recovery
    db.close();
  });
});
