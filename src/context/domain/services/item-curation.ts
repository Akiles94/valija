import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { ContextItem } from "../entities/context-item.js";
import { contextErr } from "../errors.js";
import type { Content } from "../values/content.js";
import type { ItemType } from "../values/item-type.js";
import type { Tag } from "../values/tag.js";

/** What a curation transition produced; `changed: false` means a no-op the caller must not persist. */
export interface CurationOutcome {
  readonly item: ContextItem;
  readonly changed: boolean;
}

/** The item fields an edit can change; reported back so callers can say what changed. */
export type EditableField = "content" | "tags" | "type";

/** A validated edit: each field present replaces the item's current value. */
export interface ItemEdit {
  readonly content?: Content;
  readonly tags?: readonly Tag[];
  readonly type?: ItemType;
}

/** The edited item and which fields actually differ; an empty list means nothing to persist. */
export interface EditOutcome {
  readonly item: ContextItem;
  readonly changedFields: EditableField[];
}

/** Pins or unpins an item; pinning refuses imported and archived items, and a repeat is a no-op. */
export function setPinned(
  item: ContextItem,
  pinned: boolean,
  now: Date,
): Result<CurationOutcome, DomainError> {
  if (pinned) {
    const refused = refuseUncuratable(item);
    if (refused) return refused;
  }
  if (item.pinned === pinned) return ok({ item, changed: false });
  return ok({ item: { ...item, pinned, updatedAt: now }, changed: true });
}

/** Total: archive/unarchive is allowed on every item, imported ones included. Never touches `pinned`. */
export function setArchived(item: ContextItem, archived: boolean, now: Date): CurationOutcome {
  if (item.archived === archived) return { item, changed: false };
  return { item: { ...item, archived, updatedAt: now }, changed: true };
}

/** Applies an edit in place (same id, new updatedAt); refuses imported and archived items. */
export function applyEdit(
  item: ContextItem,
  edit: ItemEdit,
  now: Date,
): Result<EditOutcome, DomainError> {
  const refused = refuseUncuratable(item);
  if (refused) return refused;
  const changedFields = editedFields(item, edit);
  if (changedFields.length === 0) return ok({ item, changedFields });
  const edited: ContextItem = {
    ...item,
    content: edit.content ?? item.content,
    tags: edit.tags ?? item.tags,
    type: edit.type ?? item.type,
    updatedAt: now,
  };
  return ok({ item: edited, changedFields });
}

/** Retire an item a newer save replaces. Project scoping is the caller's lookup concern. */
export function archiveSuperseded(item: ContextItem, now: Date): Result<ContextItem, DomainError> {
  const refused = refuseUncuratable(item);
  if (refused) return refused;
  if (item.pinned) {
    return contextErr(
      "ITEM_PINNED",
      `Item ${item.id} is pinned. Unpin it first — a pin is the user's call.`,
    );
  }
  return ok(setArchived(item, true, now).item);
}

function refuseUncuratable(item: ContextItem): Result<never, DomainError> | null {
  if (item.type === "imported") {
    return contextErr(
      "ITEM_NOT_CURATABLE",
      `Item ${item.id} is an imported item; it can only be archived or unarchived.`,
    );
  }
  if (item.archived) {
    return contextErr("ITEM_ARCHIVED", `Item ${item.id} is archived. Unarchive it first.`);
  }
  return null;
}

function editedFields(item: ContextItem, edit: ItemEdit): EditableField[] {
  const fields: EditableField[] = [];
  if (edit.content !== undefined && edit.content !== item.content) fields.push("content");
  if (edit.tags !== undefined && !sameTags(edit.tags, item.tags)) fields.push("tags");
  if (edit.type !== undefined && edit.type !== item.type) fields.push("type");
  return fields;
}

function sameTags(a: readonly Tag[], b: readonly Tag[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i]);
}
