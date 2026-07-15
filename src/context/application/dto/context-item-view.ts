import type { ContextItem } from "../../domain/entities/context-item.js";
import type { ItemType } from "../../domain/values/item-type.js";
import type { ProjectName } from "../../domain/values/project-name.js";

/**
 * How a context item leaves the application layer: primitives only, no value
 * objects and no Date. Shared by every read use case so delivery has one shape
 * to render.
 */
export interface ContextItemView {
  id: string;
  project: string;
  type: ItemType;
  content: string;
  tags: string[];
  pinned: boolean;
  source?: string;
  createdAt: string;
}

export const toContextItemView = (
  item: ContextItem,
  projectName: ProjectName,
): ContextItemView => ({
  id: item.id,
  project: projectName as string,
  type: item.type,
  content: item.content as string,
  tags: [...item.tags],
  pinned: item.pinned,
  ...(item.source === undefined ? {} : { source: item.source }),
  createdAt: item.createdAt.toISOString(),
});
