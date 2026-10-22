import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

/** No `%` or `_` — a parsed id can never act as a LIKE wildcard in a prefix lookup. */
const PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const MAX_ECHO = 70;

/** Shortest id prefix accepted when a person addresses an item, so a typo rarely hits another item. */
export const MIN_REFERENCE_LENGTH = 6;

/** An exact item id: a ULID, `imp-<hex>`, or a fixture id — never assumed to be a ULID. */
export type ItemId = string & { readonly __brand: "ItemId" };

/** A full item id or a unique prefix of one, at least MIN_REFERENCE_LENGTH chars. */
export type ItemReference = string & { readonly __brand: "ItemReference" };

/** Parses an exact item id (1-64 chars of `[A-Za-z0-9-]`), trimmed; fails with `INVALID_ITEM_ID`. */
export function parseItemId(raw: string): Result<ItemId, DomainError> {
  const trimmed = raw.trim();
  if (!PATTERN.test(trimmed)) {
    return contextErr(
      "INVALID_ITEM_ID",
      `Item id must be 1-64 chars of [A-Za-z0-9-]. Got: "${truncateForMessage(raw)}"`,
    );
  }
  return ok(trimmed as ItemId);
}

/** Parses a full id or a prefix of at least `MIN_REFERENCE_LENGTH` characters, as typed by a person. */
export function parseItemReference(raw: string): Result<ItemReference, DomainError> {
  const id = parseItemId(raw);
  if (!id.ok) return id;
  if (id.value.length < MIN_REFERENCE_LENGTH) {
    return contextErr(
      "INVALID_ITEM_ID",
      `An item reference needs at least ${MIN_REFERENCE_LENGTH} characters. Got: "${id.value}"`,
    );
  }
  return ok(id.value as string as ItemReference);
}

function truncateForMessage(raw: string): string {
  return raw.length <= MAX_ECHO ? raw : `${raw.slice(0, MAX_ECHO)}…`;
}
