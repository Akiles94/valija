/**
 * Every code an SDK call can return — closed and documented (refined §7, docs/sdk.md).
 * Additive only within a minor version (D-T).
 */
export const VALIJA_ERROR_CODES = [
  // vault lifecycle
  "VAULT_NOT_FOUND",
  "VAULT_ALREADY_EXISTS",
  "VAULT_LOCKED",
  "WRONG_PASSPHRASE",
  "WEAK_PASSPHRASE",
  "KEYCHAIN_ERROR",
  "STORAGE_ERROR",
  "VAULT_UPGRADE_REQUIRED",
  "VAULT_SCHEMA_TOO_NEW",
  // save, handoff, pack, search
  "POSSIBLE_SECRET",
  "INVALID_PROJECT_NAME",
  "INVALID_ITEM_TYPE",
  "INVALID_TAG",
  "TOO_MANY_TAGS",
  "CONTENT_EMPTY",
  "CONTENT_TOO_LARGE",
  "INVALID_ITEM_ID",
  "ITEM_NOT_FOUND",
  "ITEM_ARCHIVED",
  "ITEM_PINNED",
  "ITEM_NOT_CURATABLE",
  "PROJECT_NOT_FOUND",
  // SDK input (W2, P-9)
  "INVALID_INPUT",
] as const;

/** One code from the closed list an SDK call can fail with. */
export type ValijaErrorCode = (typeof VALIJA_ERROR_CODES)[number];

/**
 * What every failed SDK call returns. `code` is the contract; `message` is English for humans and
 * not covered by semver. It never holds a key, a passphrase or refused content.
 */
export interface ValijaError {
  readonly code: ValijaErrorCode;
  readonly message: string;
}
