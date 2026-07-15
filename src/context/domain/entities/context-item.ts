import type { Content } from "../values/content.js";
import type { ItemType } from "../values/item-type.js";
import type { Tag } from "../values/tag.js";

export interface ContextItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: ItemType;
  readonly content: Content;
  readonly tags: readonly Tag[];
  readonly pinned: boolean;
  readonly source?: string;
  readonly archived: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewContextItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: ItemType;
  readonly content: Content;
  readonly tags: readonly Tag[];
  readonly pinned: boolean;
  readonly source?: string;
  readonly now: Date;
}

/**
 * Mint a brand-new item. Total, not a Result: every field arrives as an
 * already-parsed value object, so there is no invariant left to break here.
 * Rehydration from storage is the repository's job.
 */
export function createContextItem(input: NewContextItem): ContextItem {
  return {
    id: input.id,
    projectId: input.projectId,
    type: input.type,
    content: input.content,
    tags: input.tags,
    pinned: input.pinned,
    ...(input.source === undefined ? {} : { source: input.source }),
    archived: false,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
