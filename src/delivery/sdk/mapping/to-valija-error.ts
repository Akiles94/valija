import { BUSY_MESSAGE } from "../../../context/infra/vault-sessions.js";
import type { DomainError } from "../../../shared/domain/result.js";
import { isBusyError } from "../../../shared/infra/sqlite.js";
import { VALIJA_ERROR_CODES, type ValijaError, type ValijaErrorCode } from "../dto/valija-error.js";

const UNEXPECTED_MESSAGE =
  'valija hit an unexpected error and did not complete the call. Run "valija doctor" to check the vault.';

const isListed = (code: string): code is ValijaErrorCode =>
  (VALIJA_ERROR_CODES as readonly string[]).includes(code);

/** A use-case error crosses the SDK boundary only with a listed code; anything else is an unexpected STORAGE_ERROR (D-O). */
export function toValijaError(error: DomainError): ValijaError {
  if (isListed(error.code)) return { code: error.code, message: error.message };
  return { code: "STORAGE_ERROR", message: `${UNEXPECTED_MESSAGE} (${error.code})` };
}

/** A throw is never an expected condition: busy → the "vault busy" wording, anything else → a generic message (P-20). */
export function unexpectedError(thrown: unknown): ValijaError {
  if (isBusyError(thrown)) return { code: "STORAGE_ERROR", message: BUSY_MESSAGE };
  return { code: "STORAGE_ERROR", message: UNEXPECTED_MESSAGE };
}

/** An `INVALID_INPUT` error for SDK arguments that fail validation. */
export const invalidInput = (message: string): ValijaError => ({ code: "INVALID_INPUT", message });
