import { DomainError, err, type Result } from "../../shared/domain/result.js";

/** Error vocabulary of the CONTEXT bounded context (content language). */
export type ContextErrorCode =
  | "INVALID_PROJECT_NAME"
  | "INVALID_ITEM_TYPE"
  | "INVALID_TAG"
  | "CONTENT_TOO_LARGE"
  | "CONTENT_EMPTY"
  | "TOO_MANY_TAGS"
  | "PROJECT_NOT_FOUND"
  | "ITEM_NOT_FOUND";

export const contextErr = (code: ContextErrorCode, message: string): Result<never, DomainError> =>
  err(new DomainError(code, message));
