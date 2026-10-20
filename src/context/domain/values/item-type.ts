import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

/** The item types a user or an AI may save. */
export const ITEM_TYPES = ["decision", "progress", "preference", "fact", "handoff"] as const;

/** One of the savable item types. */
export type ItemType = (typeof ITEM_TYPES)[number];

/** Accepts a savable item type; fails with `INVALID_ITEM_TYPE` otherwise. */
export function parseItemType(raw: string): Result<ItemType, DomainError> {
  if ((ITEM_TYPES as readonly string[]).includes(raw)) {
    return ok(raw as ItemType);
  }
  return contextErr(
    "INVALID_ITEM_TYPE",
    `Item type must be one of ${ITEM_TYPES.join(", ")}. Got: "${raw}"`,
  );
}

/**
 * Every type that may be STORED, including `imported`. Deliberately wider than
 * ITEM_TYPES (the five a user or AI may save): imported items are minted only by
 * the importer, never through the save path or the MCP surface — so widening
 * what can be stored never widens what a model can create.
 */
export const STORABLE_ITEM_TYPES = [...ITEM_TYPES, "imported"] as const;

/** Any type an item may have in storage, including `imported`. */
export type StorableItemType = (typeof STORABLE_ITEM_TYPES)[number];

/** Accepts any storable item type (used for filters); fails with `INVALID_ITEM_TYPE` otherwise. */
export function parseStorableItemType(raw: string): Result<StorableItemType, DomainError> {
  if ((STORABLE_ITEM_TYPES as readonly string[]).includes(raw)) {
    return ok(raw as StorableItemType);
  }
  return contextErr(
    "INVALID_ITEM_TYPE",
    `Item type must be one of ${STORABLE_ITEM_TYPES.join(", ")}. Got: "${raw}"`,
  );
}
