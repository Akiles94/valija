import type { Database } from "better-sqlite3-multiple-ciphers";
import { MIGRATION_001 } from "./migrations/001-init.js";

const MIGRATIONS: ReadonlyArray<{ version: number; sql: string }> = [
  { version: 1, sql: MIGRATION_001 },
];

export function migrate(db: Database): void {
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  const current = row ? Number(row.value) : 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).run(String(migration.version));
    })();
  }
}

export function schemaVersion(db: Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}
