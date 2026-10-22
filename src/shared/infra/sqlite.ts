import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import SqliteDatabase, { type Database } from "better-sqlite3-multiple-ciphers";
import { refuseNewerSchema, SchemaTooNewError, schemaVersion } from "./migrations.js";

/**
 * `better-sqlite3-multiple-ciphers`'s own default when `timeout` is omitted
 * (`lib/database.js`: `'timeout' in options ? options.timeout : 5000`) — made
 * explicit here (D-J(a)) rather than left as an inherited library default, so
 * "what timeout is a contended write actually running with?" has an answer in
 * the source. Behaviour for the CLI and the MCP server is unchanged.
 */
export const SQLITE_BUSY_TIMEOUT_MS = 5000;

/** What a read-only connection throws when it meets a hot journal it cannot roll back (Slice 0 spike). */
const HOT_JOURNAL_CODE = "SQLITE_READONLY_ROLLBACK";

/**
 * Open (or create) the SQLCipher vault database with a raw 32-byte key.
 * Throws SqliteError (SQLITE_NOTADB) if the key is wrong for an existing file,
 * and SchemaTooNewError if a newer valija wrote it — before any journal pragma
 * runs, so a newer vault is never settled or migrated (D-F, F4).
 *
 * The single physical database is the shared persistence kernel: the vault
 * module opens it to verify keys, the context module opens it for repositories.
 */
export function openVaultDb(dbPath: string, keyHex: string): Database {
  assertKeyHex(keyHex);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new SqliteDatabase(dbPath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
  try {
    applyKey(db, keyHex);
    refuseNewerSchema(db);
    settleJournal(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * D-F: the read-only schema probe. No mkdir, no journal pragma, no write. On a hot journal a read-only
 * connection cannot recover, so the probe falls back to the read-write open — SQLite rolls the
 * journal back, and the refusal above still guards a newer schema (W1, P-6). The probe reports the
 * number and never refuses.
 */
export function probeSchemaVersion(dbPath: string, keyHex: string): number {
  assertKeyHex(keyHex);
  try {
    return readOnlySchemaVersion(dbPath, keyHex);
  } catch (error) {
    if (sqliteCode(error) !== HOT_JOURNAL_CODE) throw error;
    return recoveredSchemaVersion(dbPath, keyHex);
  }
}

/**
 * True when SQLCipher refused to open the database because the key is wrong (it reports
 * `SQLITE_NOTADB`).
 */
export function isWrongKeyError(error: unknown): boolean {
  return sqliteCode(error) === "SQLITE_NOTADB";
}

/** Another connection held the write lock past the busy timeout. */
export const isBusyError = (error: unknown): boolean => sqliteCode(error) === "SQLITE_BUSY";

function readOnlySchemaVersion(dbPath: string, keyHex: string): number {
  const db = new SqliteDatabase(dbPath, {
    readonly: true,
    fileMustExist: true,
    timeout: SQLITE_BUSY_TIMEOUT_MS,
  });
  try {
    applyKey(db, keyHex);
    return schemaVersion(db);
  } finally {
    db.close();
  }
}

function recoveredSchemaVersion(dbPath: string, keyHex: string): number {
  try {
    const db = openVaultDb(dbPath, keyHex);
    const version = schemaVersion(db);
    db.close();
    return version;
  } catch (error) {
    if (error instanceof SchemaTooNewError) return error.vaultVersion;
    throw error;
  }
}

function assertKeyHex(keyHex: string): void {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error("Vault key must be 64 hex characters (32 bytes).");
  }
}

/** Cipher, key, and the verifying read: touching the schema forces key verification (wrong key -> SQLITE_NOTADB). */
function applyKey(db: Database, keyHex: string): void {
  db.pragma("cipher='sqlcipher'");
  db.pragma(`key="x'${keyHex}'"`);
  db.prepare("SELECT count(*) FROM sqlite_master").get();
}

/**
 * Rollback journal, not WAL: a synced folder only ever sees `vault.db` at rest,
 * never a `-wal`/`-shm` sidecar a cloud client could upload out of step with it.
 * TRUNCATE first folds any WAL left by a pre-upgrade (0.2.x) vault before the switch.
 */
function settleJournal(db: Database): void {
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.pragma("journal_mode = DELETE");
  db.pragma("foreign_keys = ON");
}

function sqliteCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !("code" in error)) return undefined;
  return (error as { code?: string }).code;
}
