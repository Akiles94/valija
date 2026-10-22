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
  | "ITEM_NOT_FOUND"
  /** An item id or id prefix is malformed, or a prefix is shorter than 6 characters. */
  | "INVALID_ITEM_ID"
  /** An id prefix matches more than one item, so more characters are needed. */
  | "ITEM_ID_AMBIGUOUS"
  /** The item is archived and must be unarchived before it is pinned, edited or superseded. */
  | "ITEM_ARCHIVED"
  /** The item is pinned, so a newer save cannot supersede it (only the user unpins). */
  | "ITEM_PINNED"
  /** The item is imported, so it can only be archived or unarchived. */
  | "ITEM_NOT_CURATABLE"
  /** An edit named no field to change (content, tags or type). */
  | "NOTHING_TO_EDIT";

/** Fails with a CONTEXT error code, as a `Result`. */
export const contextErr = (code: ContextErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
