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
  /** A newer Valija upgraded the vault past what this version understands, so update Valija (nothing was changed). */
  | "VAULT_SCHEMA_TOO_NEW"
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
  | "VAULT_MUST_BE_LOCKED"
  /** The new passphrase derives the key the vault already has, so nothing changed. */
  | "PASSPHRASE_UNCHANGED"
  /**
   * The vault folder has sidecar files, conflicted copies or leftover backups — settle it before
   * re-encrypting (nothing changed).
   */
  | "VAULT_FOLDER_UNSETTLED"
  /** Re-encrypting the vault failed or did not verify — the vault still opens with the current passphrase. */
  | "REKEY_FAILED";

/** A VAULT DomainError whose code is checked against VaultErrorCode. */
export const vaultError = (code: VaultErrorCode, message: string): DomainError =>
  new DomainError(code, message);

/** Fails with a VAULT error code, as a `Result`. */
export const vaultErr = (code: VaultErrorCode, message: string): Result<never, DomainError> =>
  err(vaultError(code, message));

/** Shared wording for VAULT_LOCKED, so every caller (session open, auto-lock) says the same thing. */
export const LOCKED_MESSAGE = 'Vault is locked. Ask the user to run "valija unlock" in a terminal.';

/** One wording for CLI, MCP, desktop logs and the SDK (§6): both numbers, and what to do. */
export const schemaTooNewMessage = (vaultVersion: number, supportedVersion: number): string =>
  `This vault was upgraded by a newer version of valija (schema ${vaultVersion}); this version ` +
  `supports up to schema ${supportedVersion}. Update valija to open it — if you are an AI tool, ask the user to update valija.`;

/** VAULT_SCHEMA_TOO_NEW that also carries both numbers, so a surface can show them without parsing the message (P-21). */
export class VaultSchemaTooNewError extends DomainError {
  constructor(
    readonly vaultVersion: number,
    readonly supportedVersion: number,
  ) {
    super("VAULT_SCHEMA_TOO_NEW", schemaTooNewMessage(vaultVersion, supportedVersion));
  }
}

/** The only way any layer builds this refusal. */
export const schemaTooNewErr = (
  vaultVersion: number,
  supportedVersion: number,
): Result<never, DomainError> => err(new VaultSchemaTooNewError(vaultVersion, supportedVersion));
