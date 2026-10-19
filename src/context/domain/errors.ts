import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the CONTEXT bounded context (content language). */
export type ContextErrorCode =
  /** A project name is not a valid slug (1-64 lowercase letters, digits or hyphens). */
  | "INVALID_PROJECT_NAME"
  /** An item type is not one of the allowed types. */
  | "INVALID_ITEM_TYPE"
  /** A tag is not 1-32 lowercase letters, digits or hyphens. */
  | "INVALID_TAG"
  /** Content is larger than 32 KB and should be distilled. */
  | "CONTENT_TOO_LARGE"
  /** Content is empty once trimmed. */
  | "CONTENT_EMPTY"
  /** More tags than allowed on one item. */
  | "TOO_MANY_TAGS"
  /** No project with that name exists. */
  | "PROJECT_NOT_FOUND"
  /** No item with that id exists. */
  | "ITEM_NOT_FOUND";

/** Fails with a CONTEXT error code, as a `Result`. */
export const contextErr = (code: ContextErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
