import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { migrate, schemaVersion } from "../migrations.js";
import { openVaultDb } from "../sqlite.js";
import { MIGRATION_001 } from "./001-init.js";
import { MIGRATION_002 } from "./002-imported-type.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-migration-003-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const lineageGeneration = (db: Database): string | undefined =>
  (
    db.prepare("SELECT value FROM meta WHERE key = 'lineage_generation'").get() as
      | { value: string }
      | undefined
  )?.value;

/** Build a populated schema-v2 vault at `path` and leave the handle open. */
function buildV2(path: string): Database {
  const db = openVaultDb(path, randomBytes(32).toString("hex"));
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(MIGRATION_001);
  db.exec(MIGRATION_002);
  db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '2')").run();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'demo', '2026', '2026')",
  ).run();
  db.prepare(
    "INSERT INTO context_items (id, project_id, type, content, tags, pinned, archived, created_at, updated_at) " +
      "VALUES ('i1', '01P', 'decision', 'we chose sqlcipher for encryption', '[\"db\"]', 0, 0, '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

const ftsHits = (db: Database, term: string): unknown[] =>
  db.prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH ?").all(term);

describe("migration 003 — lineage baseline", () => {
  it("a fresh init reaches schema 3 with lineage_generation seeded to 0", () => {
    const path = join(tmp, "fresh.db");
    const db = openVaultDb(path, randomBytes(32).toString("hex"));
    migrate(db, path);
    expect(schemaVersion(db)).toBe(3);
    expect(lineageGeneration(db)).toBe("0");
    db.close();
  });

  it("upgrades a populated v2 vault to v3 without losing rows or search", () => {
    const path = join(tmp, "populated.db");
    const db = buildV2(path);
    const before = db.prepare("SELECT id FROM context_items ORDER BY id").all();

    migrate(db, path);

    expect(schemaVersion(db)).toBe(3);
    expect(db.prepare("SELECT id FROM context_items ORDER BY id").all()).toEqual(before);
    expect(ftsHits(db, "sqlcipher")).toHaveLength(1);
    expect(lineageGeneration(db)).toBe("0");
    db.close();
  });

  it("takes a ciphertext backup and removes it on success", () => {
    const path = join(tmp, "backup.db");
    const db = buildV2(path);
    migrate(db, path);
    expect(existsSync(`${path}.pre-003.bak`)).toBe(false);
    db.close();
  });

  it("is a no-op once at v3", () => {
    const path = join(tmp, "idempotent.db");
    const db = buildV2(path);
    migrate(db, path);
    migrate(db, path);
    expect(schemaVersion(db)).toBe(3);
    db.close();
  });
});
