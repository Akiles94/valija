import { createHash } from "node:crypto";
import type { Content } from "../values/content.js";
import type { ItemType, StorableItemType } from "../values/item-type.js";
import type { Tag } from "../values/tag.js";

/** One stored piece of memory about a project; archived items are kept but no longer served. */
export interface ContextItem {
  readonly id: string;
  readonly projectId: string;
  readonly type: StorableItemType;
  readonly content: Content;
  readonly tags: readonly Tag[];
  readonly pinned: boolean;
  readonly source?: string;
  readonly archived: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Already-parsed fields for minting an item through the save path. */
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

/** Already-parsed fields for minting an item from an imported conversation chunk. */
export interface NewImportedContextItem {
  readonly projectId: string;
  /** The import source, e.g. "chatgpt" — kept as a plain string so the entity owes nothing to the importers module. */
  readonly source: string;
  readonly conversationId: string;
  readonly chunkIndex: number;
  readonly content: Content;
  readonly tags: readonly Tag[];
  /** The original conversation date — chronology is preserved. */
  readonly createdAt: Date;
  /** The import instant — so the project surfaces as freshly active. */
  readonly now: Date;
}

/**
 * A deterministic id for an imported chunk: the same (source, conversation,
 * chunk) always maps to the same id, so re-importing the same export upserts
 * instead of duplicating. Not a ULID — that is fine, ordering everywhere is by
 * created_at, never by id. Hashing is a pure computation, so it belongs here.
 */
export function importedItemId(
  projectId: string,
  source: string,
  conversationId: string,
  chunkIndex: number,
): string {
  const digest = createHash("sha256")
    .update(`${projectId} ${source} ${conversationId} ${chunkIndex}`)
    .digest("hex");
  return `imp-${digest.slice(0, 32)}`;
}

/**
 * Mint an imported item. Total, like createContextItem, but it stamps the
 * historical createdAt separately from the import instant (updatedAt), fixes the
 * type to `imported`, is never pinned, and derives its id deterministically.
 */
export function createImportedContextItem(input: NewImportedContextItem): ContextItem {
  return {
    id: importedItemId(input.projectId, input.source, input.conversationId, input.chunkIndex),
    projectId: input.projectId,
    type: "imported",
    content: input.content,
    tags: input.tags,
    pinned: false,
    source: `${input.source}-import`,
    archived: false,
    createdAt: input.createdAt,
    updatedAt: input.now,
  };
}
