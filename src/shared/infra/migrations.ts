import { copyFileSync, rmSync } from "node:fs";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { MIGRATION_001 } from "./migrations/001-init.js";
import { MIGRATION_002 } from "./migrations/002-imported-type.js";
import { MIGRATION_003 } from "./migrations/003-lineage.js";

interface Migration {
  version: number;
  sql: string;
  /** Take a ciphertext backup before applying — for table-rebuild migrations that touch real data. */
  backup?: boolean;
}

const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: MIGRATION_001 },
  { version: 2, sql: MIGRATION_002, backup: true },
  { version: 3, sql: MIGRATION_003, backup: true },
];

/**
 * Bring the database up to the latest schema. `dbPath` is optional so callers
 * that only need the schema (a fresh init) can omit it; when a backup-flagged
 * migration upgrades a populated vault, the path lets the runner snapshot the
 * ciphertext file first.
 */
export function migrate(db: Database, dbPath?: string): void {
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const current = schemaVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    applyMigration(db, migration, current, dbPath);
  }
}

/**
 * Apply one migration atomically. A backup is taken only when upgrading an
 * existing vault (current >= 1) with a known path — never on a fresh init. The
 * transaction commits or rolls back as a unit; on failure the backup is kept for
 * recovery, on success it is removed.
 */
function applyMigration(
  db: Database,
  migration: Migration,
  current: number,
  dbPath: string | undefined,
): void {
  const backupPath =
    migration.backup === true && current >= 1 && dbPath !== undefined
      ? backupCiphertext(db, dbPath, migration.version)
      : null;

  db.transaction(() => {
    db.exec(migration.sql);
    setSchemaVersion(db, migration.version);
  })();

  if (backupPath !== null) rmSync(backupPath, { force: true });
}

/** Checkpoint the WAL so the file on disk is complete, then copy the still-encrypted db aside. */
function backupCiphertext(db: Database, dbPath: string, version: number): string {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const backupPath = `${dbPath}.pre-${String(version).padStart(3, "0")}.bak`;
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

function setSchemaVersion(db: Database, version: number): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(version));
}

export function schemaVersion(db: Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}
