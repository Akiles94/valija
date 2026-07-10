import { type DomainError, domainErr, ok, type Result } from "../errors.js";
import type { ItemType } from "../values/item-type.js";
import type { Tag } from "../values/tag.js";

export const MAX_CONTENT_BYTES = 32 * 1024;

export interface ContextItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: ItemType;
  readonly content: string;
  readonly tags: readonly Tag[];
  readonly pinned: boolean;
  readonly source?: string;
  readonly archived: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function validateContent(content: string): Result<string, DomainError> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return domainErr("CONTENT_EMPTY", "Content must not be empty.");
  }
  const bytes = new TextEncoder().encode(trimmed).length;
  if (bytes > MAX_CONTENT_BYTES) {
    return domainErr(
      "CONTENT_TOO_LARGE",
      `Content is ${bytes} bytes; the maximum is ${MAX_CONTENT_BYTES} (32 KB). Distill it.`,
    );
  }
  return ok(trimmed);
}
