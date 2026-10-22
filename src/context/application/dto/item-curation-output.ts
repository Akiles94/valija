import type { ContextItem } from "../../domain/entities/context-item.js";
import type { EditableField } from "../../domain/services/item-curation.js";
import type { StorableItemType } from "../../domain/values/item-type.js";
import type { ItemWithProject } from "../ports/repositories.js";

/** What a curation use case reports: primitives only. `changed: false` means nothing was written. */
export interface ItemCurationOutput {
  itemId: string;
  project: string;
  type: StorableItemType;
  changed: boolean;
}

export interface EditItemOutput extends ItemCurationOutput {
  changedFields: EditableField[];
}

export const toItemCurationOutput = (
  found: ItemWithProject,
  item: ContextItem,
  changed: boolean,
): ItemCurationOutput => ({
  itemId: item.id,
  project: found.projectName as string,
  type: item.type,
  changed,
});
