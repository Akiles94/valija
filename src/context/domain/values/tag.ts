import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

const PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export const MAX_TAGS = 10;

/** Lowercase tag: 1-32 chars of [a-z0-9-]. */
export type Tag = string & { readonly __brand: "Tag" };

export function parseTag(raw: string): Result<Tag, DomainError> {
  const normalized = raw.trim().toLowerCase();
  if (!PATTERN.test(normalized)) {
    return contextErr("INVALID_TAG", `Tag must be 1-32 chars of [a-z0-9-]. Got: "${raw}"`);
  }
  return ok(normalized as Tag);
}

export function parseTags(raw: readonly string[]): Result<Tag[], DomainError> {
  if (raw.length > MAX_TAGS) {
    return contextErr("TOO_MANY_TAGS", `At most ${MAX_TAGS} tags allowed. Got ${raw.length}.`);
  }
  const tags: Tag[] = [];
  for (const r of raw) {
    const parsed = parseTag(r);
    if (!parsed.ok) return parsed;
    if (!tags.includes(parsed.value)) tags.push(parsed.value);
  }
  return ok(tags);
}
