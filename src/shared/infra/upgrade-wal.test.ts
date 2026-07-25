import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const moduleRequire = createRequire(import.meta.url);

/**
 * A standalone writer: opens the vault in WAL mode with auto-checkpoint OFF,
 * commits one row (so its frames sit in a live -wal, not folded into the main
 * db), prints READY, then idles — so the parent can SIGKILL it to leave a
 * genuine dangling -wal, the shape only a real crash produces. It requires the
 * native module by absolute path (argv[2]) so resolution doesn't depend on the
 * child's cwd. `.cjs` so `require` works regardless of the project's module type.
 */
const WAL_WRITER_SCRIPT = `
const Database = require(process.argv[2]);
const [dbPath, keyHex] = process.argv.slice(3);
const db = new Database(dbPath);
db.pragma("cipher='sqlcipher'");
db.pragma(\`key="x'\${keyHex}'"\`);
db.prepare("SELECT count(*) FROM sqlite_master").get();
db.pragma("journal_mode = WAL");
db.pragma("wal_autocheckpoint = 0");
db.pragma("synchronous = FULL");
db.exec("CREATE TABLE IF NOT EXISTS survive (note TEXT NOT NULL)");
db.prepare("INSERT INTO survive (note) VALUES ('committed-in-wal')").run();
process.stdout.write("READY");
setInterval(() => {}, 1000);
`;

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
 * connection to a WAL database closes cleanly, so this builder — which closes
 * normally — proves the ordinary upgrade path: a vault created and used in WAL
 * mode upgrades correctly (journal switches, schema reaches 3, lineage seeds,
 * no data or search lost). The harder case — a literal dangling -wal left by a
 * process killed mid-flight — is covered separately by the crashed-process test
 * below, which spawns a real writer and SIGKILLs it.
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

  it("recovers a vault a crashed process left with a live -wal (folds it, then switches journaling)", async () => {
    const path = join(tmp, "crashed.db");
    const key = randomBytes(32).toString("hex");
    const scriptPath = join(tmp, "wal-writer.cjs");
    writeFileSync(scriptPath, WAL_WRITER_SCRIPT);
    const modulePath = moduleRequire.resolve("better-sqlite3-multiple-ciphers");

    const child = spawn(process.execPath, [scriptPath, modulePath, path, key]);
    // Arm the exit wait immediately, so the SIGKILL exit is captured no matter
    // how quickly it happens relative to the await below.
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    try {
      await new Promise<void>((resolve) => {
        child.stdout?.on("data", (chunk: Buffer) => {
          if (chunk.toString().includes("READY")) resolve();
        });
      });
      // A committed-but-uncheckpointed WAL is genuinely on disk right now.
      expect(existsSync(`${path}-wal`)).toBe(true);
      expect(statSync(`${path}-wal`).size).toBeGreaterThan(0);
    } finally {
      child.kill("SIGKILL");
    }
    await exited;

    // openVaultDb folds the surviving WAL (wal_checkpoint TRUNCATE) then switches to DELETE.
    const db = openVaultDb(path, key);
    const row = db.prepare("SELECT note FROM survive").get() as { note: string } | undefined;
    expect(row?.note).toBe("committed-in-wal");
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");

    db.close();
    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(existsSync(`${path}-shm`)).toBe(false);
  }, 15000);
});
