import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the IMPORTERS bounded context (conversation-import language). */
export type ImporterErrorCode =
  /** The export format could not be detected, or the named source is unknown. */
  | "UNSUPPORTED_SOURCE"
  /** The file is not a valid export of the stated format. */
  | "MALFORMED_EXPORT"
  /** The export contains no conversations. */
  | "EMPTY_EXPORT"
  /** The export file could not be read. */
  | "UNREADABLE_FILE"
  /** The zip archive is damaged, or an entry exceeds the decompression caps. */
  | "CORRUPT_ARCHIVE"
  /** The conversation selection (pick, query or since) is invalid. */
  | "INVALID_SELECTION"
  /** No conversation matches the selection. */
  | "NO_CONVERSATIONS_SELECTED"
  /** The generic import envelope has a version this Valija does not support. */
  | "UNSUPPORTED_GENERIC_VERSION";

/** Fails with an IMPORTERS error code, as a `Result`. */
export const importerErr = (code: ImporterErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
