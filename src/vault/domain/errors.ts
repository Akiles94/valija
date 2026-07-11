import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the VAULT bounded context (security language). */
export type VaultErrorCode =
  | "VAULT_NOT_FOUND"
  | "VAULT_ALREADY_EXISTS"
  | "VAULT_LOCKED"
  | "WRONG_PASSPHRASE"
  | "WEAK_PASSPHRASE"
  | "KEYCHAIN_ERROR"
  | "STORAGE_ERROR";

export const vaultErr = (code: VaultErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
