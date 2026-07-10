import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import SqliteDatabase, { type Database } from "better-sqlite3-multiple-ciphers";

/**
 * Open (or create) the SQLCipher vault database with a raw 32-byte key.
 * Throws SqliteError (SQLITE_NOTADB) if the key is wrong for an existing file.
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
    db.pragma("journal_mode = WAL");
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
