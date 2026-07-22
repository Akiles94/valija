import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { Conversation } from "../entities/conversation.js";
import { importerErr } from "../errors.js";

export interface SelectionFilters {
  all?: boolean;
  pick?: string;
  query?: string;
  since?: string;
}

/**
 * Parse a `--pick` spec like "1,3-5" into sorted, unique, **0-based** indices.
 * Indices are 1-based in the spec (they mirror the printed listing); any
 * non-numeric token, out-of-range value, or reversed range is a selection error.
 */
export function parsePickSpec(spec: string, count: number): Result<number[], DomainError> {
  const tokens = spec
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return importerErr("INVALID_SELECTION", "--pick is empty.");
  }

  const indices = new Set<number>();
  for (const token of tokens) {
    const range = token.match(/^(\d+)-(\d+)$/);
    const single = token.match(/^(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end > count || start > end) {
        return importerErr(
          "INVALID_SELECTION",
          `--pick range "${token}" is out of bounds (valid: 1-${count}).`,
        );
      }
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else if (single) {
      const index = Number(single[1]);
      if (index < 1 || index > count) {
        return importerErr(
          "INVALID_SELECTION",
          `--pick index "${token}" is out of bounds (valid: 1-${count}).`,
        );
      }
      indices.add(index - 1);
    } else {
      return importerErr("INVALID_SELECTION", `--pick token "${token}" is not a number or range.`);
    }
  }
  return ok([...indices].sort((a, b) => a - b));
}

/**
 * Narrow a chronological-ascending conversation list by the CLI selection flags.
 * `--pick` resolves against the full printed order first, so its indices stay
 * stable regardless of the other flags; `--since` and `--query` then filter.
 * An empty result is a selection error, never a silent no-op.
 */
export function selectConversations(
  conversations: readonly Conversation[],
  filters: SelectionFilters,
): Result<Conversation[], DomainError> {
  let selected = [...conversations];

  if (filters.pick !== undefined) {
    const picked = parsePickSpec(filters.pick, conversations.length);
    if (!picked.ok) return picked;
    selected = picked.value
      .map((index) => conversations[index])
      .filter((conversation): conversation is Conversation => conversation !== undefined);
  }

  if (filters.since !== undefined) {
    const since = new Date(filters.since);
    if (Number.isNaN(since.getTime())) {
      return importerErr(
        "INVALID_SELECTION",
        `--since "${filters.since}" is not a valid date (use YYYY-MM-DD).`,
      );
    }
    selected = selected.filter(
      (conversation) => conversation.createdAt.getTime() >= since.getTime(),
    );
  }

  if (filters.query !== undefined) {
    const needle = filters.query.toLowerCase();
    selected = selected.filter((conversation) => conversation.title.toLowerCase().includes(needle));
  }

  if (selected.length === 0) {
    return importerErr("NO_CONVERSATIONS_SELECTED", "No conversations matched the given filters.");
  }
  return ok(selected);
}
