import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../errors.js";

export const ITEM_TYPES = ["decision", "progress", "preference", "fact", "handoff"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export function parseItemType(raw: string): Result<ItemType, DomainError> {
  if ((ITEM_TYPES as readonly string[]).includes(raw)) {
    return ok(raw as ItemType);
  }
  return contextErr(
    "INVALID_ITEM_TYPE",
    `Item type must be one of ${ITEM_TYPES.join(", ")}. Got: "${raw}"`,
  );
}
