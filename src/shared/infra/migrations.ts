import { copyFileSync, rmSync } from "node:fs";
import type { Database } from "better-sqlite3-multiple-ciphers";
import { compareSchema } from "../domain/services/schema-compatibility.js";
import { MIGRATION_001 } from "./migrations/001-init.js";
import { MIGRATION_002 } from "./migrations/002-imported-type.js";
import { MIGRATION_003 } from "./migrations/003-lineage.js";
import { MIGRATION_004 } from "./migrations/004-project-bindings.js";

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
  { version: 4, sql: MIGRATION_004, backup: true },
];

/** Schema version a freshly migrated vault database reaches; vaults behind it need an upgrade. */
export const LATEST_SCHEMA_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

/** A vault written by a newer valija. Thrown before any write, pragma or migration (D-E, D-F). */
export class SchemaTooNewError extends Error {
  constructor(
    readonly vaultVersion: number,
    readonly supportedVersion: number,
  ) {
    super(`Vault schema ${vaultVersion} is newer than the supported ${supportedVersion}.`);
    this.name = "SchemaTooNewError";
  }
}

/** Fail closed: refuse a schema this build does not know. Reads only. */
export function refuseNewerSchema(db: Database): void {
  const current = schemaVersion(db);
  if (compareSchema(current, LATEST_SCHEMA_VERSION) === "newer") {
    throw new SchemaTooNewError(current, LATEST_SCHEMA_VERSION);
  }
}

/** Which migrations a vault at `current` still needs, and whether any of them backs up the ciphertext first — for a GUI confirmation screen to name before running `migrate`. */
export function pendingMigrations(
  current: number,
): { version: number; backsUpCiphertext: boolean }[] {
  return MIGRATIONS.filter((m) => m.version > current).map((m) => ({
    version: m.version,
    backsUpCiphertext: m.backup === true,
  }));
}

/**
 * Bring the database up to the latest schema. `dbPath` is optional so callers
 * that only need the schema (a fresh init) can omit it; when a backup-flagged
 * migration upgrades a populated vault, the path lets the runner snapshot the
 * ciphertext file first.
 *
 * The backstop runs first (D-E, F5): a newer schema is refused before the
 * `meta` table is even created, so a refused vault sees no write at all.
 */
export function migrate(db: Database, dbPath?: string): void {
  refuseNewerSchema(db);
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

/** The stored schema marker; `0` for a database never migrated (no `meta` table yet, F6). */
export function schemaVersion(db: Database): number {
  if (!hasMetaTable(db)) return 0;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

function hasMetaTable(db: Database): boolean {
  return (
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get() !==
    undefined
  );
}
