import type { ContentEditRequest } from "../../shared/ipc/messages.js";

/** What the edit dialog holds: the tags as one comma-separated field, exactly what the user types. */
export interface EditDraft {
  content: string;
  tags: string;
  type: string;
}

export function draftFor(item: { content: string; tags: string[]; type: string }): EditDraft {
  return { content: item.content, tags: item.tags.join(", "), type: item.type };
}

/** Same rule as `valija edit --tags`: split on commas, trim, drop empties — an empty field clears the tags. */
export function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Only the fields that differ from the original; `null` when nothing changed, so no call is made. */
export function editRequestFor(
  id: string,
  original: { content: string; tags: string[]; type: string },
  draft: EditDraft,
): ContentEditRequest | null {
  const tags = parseTagsInput(draft.tags);
  const sameTags =
    tags.length === original.tags.length && tags.every((t, i) => t === original.tags[i]);
  const request: ContentEditRequest = {
    id,
    ...(draft.content === original.content ? {} : { content: draft.content }),
    ...(sameTags ? {} : { tags }),
    ...(draft.type === original.type ? {} : { type: draft.type }),
  };
  return Object.keys(request).length === 1 ? null : request;
}
