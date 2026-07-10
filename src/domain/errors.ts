export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type DomainErrorCode =
  | "INVALID_PROJECT_NAME"
  | "INVALID_ITEM_TYPE"
  | "INVALID_TAG"
  | "CONTENT_TOO_LARGE"
  | "CONTENT_EMPTY"
  | "TOO_MANY_TAGS"
  | "PROJECT_NOT_FOUND"
  | "ITEM_NOT_FOUND"
  | "VAULT_NOT_FOUND"
  | "VAULT_ALREADY_EXISTS"
  | "VAULT_LOCKED"
  | "WRONG_PASSPHRASE"
  | "KEYCHAIN_ERROR"
  | "STORAGE_ERROR";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const domainErr = (code: DomainErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
