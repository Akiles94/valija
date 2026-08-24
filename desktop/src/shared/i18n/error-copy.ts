import type { DomainError } from "../../../src/shared/domain/result.js";

// Map domain error codes to catalog keys
// Includes codes from vault, context, importers contexts and new codes from Slices 4 & 8
const ERROR_CODE_TO_KEY: Record<string, string> = {
  // Vault context (slice 4)
  VAULT_NOT_FOUND: "errors.VAULT_NOT_FOUND",
  VAULT_ALREADY_EXISTS: "errors.VAULT_ALREADY_EXISTS",
  VAULT_LOCKED: "errors.VAULT_LOCKED",
  WRONG_PASSPHRASE: "errors.WRONG_PASSPHRASE",
  WEAK_PASSPHRASE: "errors.WEAK_PASSPHRASE",
  KEYCHAIN_ERROR: "errors.KEYCHAIN_ERROR",
  STORAGE_ERROR: "errors.STORAGE_ERROR",
  INVALID_DEVICE_ID: "errors.INVALID_DEVICE_ID",
  INVALID_GENERATION: "errors.INVALID_GENERATION",
  INVALID_WRITE_STAMP: "errors.INVALID_WRITE_STAMP",
  VAULT_FORK_DETECTED: "errors.VAULT_FORK_DETECTED",
  VAULT_UPGRADE_REQUIRED: "errors.VAULT_UPGRADE_REQUIRED",
  VAULT_MUST_BE_LOCKED: "errors.VAULT_MUST_BE_LOCKED",

  // Context errors (placeholder for future)
  CONTEXT_ERROR: "errors.CONTEXT_ERROR",

  // Importers errors (placeholder for future)
  UNSUPPORTED_SOURCE: "errors.UNSUPPORTED_SOURCE",
  ARCHIVE_TOO_LARGE: "errors.ARCHIVE_TOO_LARGE",
  ENTRY_TOO_LARGE: "errors.ENTRY_TOO_LARGE",
  INVALID_JSON: "errors.INVALID_JSON",

  // Relocation errors (slice 8)
  RELOCATION_DESTINATION_OCCUPIED: "errors.RELOCATION_DESTINATION_OCCUPIED",
  RELOCATION_DESTINATION_UNUSABLE: "errors.RELOCATION_DESTINATION_UNUSABLE",
  RELOCATION_DESTINATION_NESTED: "errors.RELOCATION_DESTINATION_NESTED",
  RELOCATION_SOURCE_UNSETTLED: "errors.RELOCATION_SOURCE_UNSETTLED",
  RELOCATION_COPY_FAILED: "errors.RELOCATION_COPY_FAILED",
  RELOCATION_VERIFY_FAILED: "errors.RELOCATION_VERIFY_FAILED",
  RELOCATION_ROLLBACK_FAILED: "errors.RELOCATION_ROLLBACK_FAILED",
};

/**
 * Get the catalog key for an error code.
 * Never returns the raw error message from DomainError.
 */
export function getErrorCatalogKey(error: DomainError): string {
  const key = ERROR_CODE_TO_KEY[error.code];
  if (key) {
    return key;
  }

  // Fallback: return a generic error key that names the code
  // This ensures a missing mapping doesn't silently blank the UI
  return `errors.${error.code}`;
}
