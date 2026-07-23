import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { LineageStamp } from "../../domain/services/vault-lineage.js";
import type { KdfParams } from "./crypto.js";

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
  dbPath(): string;
}
