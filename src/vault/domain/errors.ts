import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the VAULT bounded context (security language). */
export type VaultErrorCode =
  /** No vault header exists in the vault folder — run `valija init` first. */
  | "VAULT_NOT_FOUND"
  /** Creating a vault where one already exists. */
  | "VAULT_ALREADY_EXISTS"
  /**
   * The vault is locked (or auto-locked when idle) — unlock it before reading or writing context.
   */
  | "VAULT_LOCKED"
  /** The passphrase or recovery key does not open the vault. */
  | "WRONG_PASSPHRASE"
  /** The new passphrase is shorter than the minimum length. */
  | "WEAK_PASSPHRASE"
  /** The OS keychain could not be reached to store or read the vault key. */
  | "KEYCHAIN_ERROR"
  /** The vault files on disk could not be created, read or parsed. */
  | "STORAGE_ERROR"
  /** A device id read from local state is empty. */
  | "INVALID_DEVICE_ID"
  /** A lineage generation is not a non-negative integer. */
  | "INVALID_GENERATION"
  /** A lineage write stamp is empty. */
  | "INVALID_WRITE_STAMP"
  /**
   * Two devices wrote the vault independently from the same starting point — nothing was deleted.
   */
  | "VAULT_FORK_DETECTED"
  /**
   * The vault schema is older than this version of Valija — unlocking needs the upgrade confirmed
   * first.
   */
  | "VAULT_UPGRADE_REQUIRED"
  /** Relocation target already contains a vault. */
  | "RELOCATION_DESTINATION_OCCUPIED"
  /** Relocation target does not exist or is not writable. */
  | "RELOCATION_DESTINATION_UNUSABLE"
  /** Relocation target is the vault folder itself or inside it. */
  | "RELOCATION_DESTINATION_NESTED"
  /**
   * The vault folder has conflicted copies, leftover backups or sidecar files — settle it before
   * moving.
   */
  | "RELOCATION_SOURCE_UNSETTLED"
  /** Copying the vault to its new folder failed — the partial copy was removed. */
  | "RELOCATION_COPY_FAILED"
  /** The copied vault does not match the original — the copy was removed. */
  | "RELOCATION_VERIFY_FAILED"
  /**
   * Removing the old vault failed and cleaning up the copy failed too — one folder must be deleted
   * by hand.
   */
  | "RELOCATION_ROLLBACK_FAILED"
  /** The vault must be locked for this operation (relocation never handles the key). */
  | "VAULT_MUST_BE_LOCKED";

/** A VAULT DomainError whose code is checked against VaultErrorCode. */
export const vaultError = (code: VaultErrorCode, message: string): DomainError =>
  new DomainError(code, message);

/** Fails with a VAULT error code, as a `Result`. */
export const vaultErr = (code: VaultErrorCode, message: string): Result<never, DomainError> =>
  err(vaultError(code, message));

/** Shared wording for VAULT_LOCKED, so every caller (session open, auto-lock) says the same thing. */
export const LOCKED_MESSAGE = 'Vault is locked. Ask the user to run "valija unlock" in a terminal.';
