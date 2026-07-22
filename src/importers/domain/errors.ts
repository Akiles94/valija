import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the IMPORTERS bounded context (conversation-import language). */
export type ImporterErrorCode =
  | "UNSUPPORTED_SOURCE"
  | "MALFORMED_EXPORT"
  | "EMPTY_EXPORT"
  | "UNREADABLE_FILE"
  | "CORRUPT_ARCHIVE"
  | "INVALID_SELECTION"
  | "NO_CONVERSATIONS_SELECTED"
  | "UNSUPPORTED_GENERIC_VERSION";

export const importerErr = (code: ImporterErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
