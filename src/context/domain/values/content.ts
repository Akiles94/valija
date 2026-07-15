import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

export const MAX_CONTENT_BYTES = 32 * 1024;

/** The body of a context item: trimmed, non-empty, at most 32 KB of UTF-8. */
export type Content = string & { readonly __brand: "Content" };

export function parseContent(raw: string): Result<Content, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return contextErr("CONTENT_EMPTY", "Content must not be empty.");
  }
  const bytes = new TextEncoder().encode(trimmed).length;
  if (bytes > MAX_CONTENT_BYTES) {
    return contextErr(
      "CONTENT_TOO_LARGE",
      `Content is ${bytes} bytes; the maximum is ${MAX_CONTENT_BYTES} (32 KB). Distill it.`,
    );
  }
  return ok(trimmed as Content);
}
