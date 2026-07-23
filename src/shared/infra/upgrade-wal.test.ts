import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import SqliteDatabase from "better-sqlite3-multiple-ciphers";
import { afterAll, describe, expect, it } from "vitest";
import { MIGRATION_001 } from "./migrations/001-init.js";
import { MIGRATION_002 } from "./migrations/002-imported-type.js";
import { migrate, schemaVersion } from "./migrations.js";
import { openVaultDb } from "./sqlite.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-upgrade-wal-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const ROW_SQL =
  "INSERT INTO context_items (id, project_id, type, content, tags, pinned, archived, created_at, updated_at) " +
  "VALUES ('i1', '01P', 'decision', 'we chose sqlcipher for encryption', '[\"db\"]', 0, 0, '2026-01-01', '2026-01-01')";

/**
 * Build a populated, pre-M3 (0.2.x) vault directly: WAL mode, real rows,
 * closed normally — exactly the on-disk shape an existing user's vault is in
 * before upgrading. `atVersion` controls how much of today's schema is
 * pre-applied.
 *
 * Note: SQLite auto-checkpoints (and removes -wal/-shm) when the last
 * connection to a WAL database closes cleanly, and changing journal_mode
 * away from WAL requires being the only connection — so a literal dangling
 * -wal file at the moment of upgrade can only happen via an actual crash
 * (a separate process, killed uncleanly), which isn't reproducible from a
 * single in-process test without real subprocess tricks. What this test can
 * and does prove is the property that actually matters: a vault that was
 * created and used in WAL mode upgrades correctly — journal switches,
 * schema reaches 3, lineage seeds, and no data or search is lost.
 */
function buildLegacyWalVault(path: string, keyHex: string, atVersion: 1 | 2): void {
  const db = new SqliteDatabase(path);
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key="x'${keyHex}'"`);
  db.prepare("SELECT count(*) FROM sqlite_master").get();
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(MIGRATION_001);
  if (atVersion === 2) db.exec(MIGRATION_002);
  db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(String(atVersion));
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('01P', 'demo', '2026', '2026')",
  ).run();
  db.prepare(ROW_SQL).run();
  db.close();
}

describe("upgrading a pre-M3 populated WAL vault", () => {
  it("folds the WAL, switches journaling, seeds lineage, and preserves data + search", () => {
    const path = join(tmp, "legacy.db");
    const key = randomBytes(32).toString("hex");
    buildLegacyWalVault(path, key, 2);

    const db = openVaultDb(path, key);
    migrate(db, path);

    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    expect(schemaVersion(db)).toBe(3);
    const generation = db
      .prepare("SELECT value FROM meta WHERE key = 'lineage_generation'")
      .get() as { value: string } | undefined;
    expect(generation?.value).toBe("0");

    const row = db.prepare("SELECT content FROM context_items WHERE id = 'i1'").get() as {
      content: string;
    };
    expect(row.content).toBe("we chose sqlcipher for encryption");
    const hits = db
      .prepare("SELECT rowid FROM context_items_fts WHERE context_items_fts MATCH 'sqlcipher'")
      .all();
    expect(hits).toHaveLength(1);

    db.close();
    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
  });

  it("keeps the prior state and the backup intact on a forced mid-upgrade migration failure", () => {
    // Migration 003 is a trivial INSERT OR IGNORE (see 003-lineage.ts) — there is
    // no realistic SQL fault to inject into it directly, so this builds a v1
    // legacy vault (both 002 and 003 must run) and sabotages 002's table
    // rebuild, exactly like the existing migration-002 rollback test. The
    // property under test — a failed migrate() strands nothing and keeps the
    // pre-upgrade backup — is the same regardless of which migration trips it.
    const path = join(tmp, "failure.db");
    const key = randomBytes(32).toString("hex");
    buildLegacyWalVault(path, key, 1);

    const db = openVaultDb(path, key);
    // The journal fold/switch happens unconditionally at open, independent of
    // whether the migration chain that follows succeeds.
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");

    db.exec("CREATE TABLE context_items_new (x TEXT)"); // makes migration 002's rebuild fail
    expect(() => migrate(db, path)).toThrow();

    expect(schemaVersion(db)).toBe(1);
    const row = db.prepare("SELECT content FROM context_items WHERE id = 'i1'").get() as {
      content: string;
    };
    expect(row.content).toBe("we chose sqlcipher for encryption");
    expect(existsSync(`${path}.pre-002.bak`)).toBe(true); // kept for recovery
    expect(existsSync(`${path}.pre-003.bak`)).toBe(false); // 003 never started

    db.close();
  });
});
