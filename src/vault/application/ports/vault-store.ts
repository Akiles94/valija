import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import type { KdfParams } from "./crypto.js";

/**
 * The plaintext vault header: id, KDF parameters and salt — everything needed to derive the key,
 * nothing secret.
 */
export interface VaultHeaderData {
  vaultId: string;
  schemaVersion: 1;
  kdf: KdfParams;
  salt: Uint8Array;
  createdAt: string;
}

/** Header + database lifecycle, without exposing the storage engine. */
export interface VaultStore {
  headerExists(): boolean;
  readHeader(): Result<VaultHeaderData, DomainError>;
  writeHeader(header: VaultHeaderData): void;
  /** Create the encrypted database and apply migrations. */
  initializeDb(keyHex: string): Result<void, DomainError>;
  /** Check a key against the existing database. WRONG_PASSPHRASE if it does not open. */
  verifyKey(keyHex: string): Result<void, DomainError>;
  /**
   * Read the vault's current lineage stamp. null for a vault that has never
   * been written to yet (fresh, or migrated but no write has happened).
   * WRONG_PASSPHRASE if the key does not open the database.
   */
  readLineage(keyHex: string): Result<LineageStamp | null, DomainError>;
  /**
   * The database's current schema version, without migrating it. Used to gate
   * unlock on an explicit upgrade confirmation (D-J(b)) — `readLineage` alone
   * cannot answer this because it migrates as a side effect.
   *
   * Read-only (SDK, D-F): no migration, no journal pragma, no write — and it
   * reports a newer schema's number instead of refusing it, so the use case
   * can refuse with `VAULT_SCHEMA_TOO_NEW` itself. Every other method that
   * opens the database returns `VAULT_SCHEMA_TOO_NEW` on a newer vault.
   */
  readSchemaVersion(keyHex: string): Result<number, DomainError>;
  dbPath(): string;
}
