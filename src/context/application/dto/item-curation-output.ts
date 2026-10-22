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

/** What `EditItem` reports: the curation output plus the fields that changed. */
export interface EditItemOutput extends ItemCurationOutput {
  changedFields: EditableField[];
}

/** Maps a looked-up item and its new state to the primitives a curation use case returns. */
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
