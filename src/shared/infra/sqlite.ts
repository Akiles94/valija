import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import SqliteDatabase, { type Database } from "better-sqlite3-multiple-ciphers";

/**
 * Open (or create) the SQLCipher vault database with a raw 32-byte key.
 * Throws SqliteError (SQLITE_NOTADB) if the key is wrong for an existing file.
 *
 * The single physical database is the shared persistence kernel: the vault
 * module opens it to verify keys, the context module opens it for repositories.
 */
export function openVaultDb(dbPath: string, keyHex: string): Database {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error("Vault key must be 64 hex characters (32 bytes).");
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new SqliteDatabase(dbPath);
  try {
    db.pragma("cipher='sqlcipher'");
    db.pragma(`key="x'${keyHex}'"`);
    // Touching the schema forces key verification: wrong key -> SQLITE_NOTADB.
    db.prepare("SELECT count(*) FROM sqlite_master").get();
    // Rollback journal, not WAL: a synced folder only ever sees `vault.db` at rest,
    // never a `-wal`/`-shm` sidecar a cloud client could upload out of step with it.
    // TRUNCATE first folds any WAL left by a pre-upgrade (0.2.x) vault before the switch.
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.pragma("journal_mode = DELETE");
    db.pragma("foreign_keys = ON");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function isWrongKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "SQLITE_NOTADB"
  );
}
