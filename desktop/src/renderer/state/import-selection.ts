import type { ImportListingRow } from "../../shared/ipc/messages.js";

/**
 * The checkbox column *is* `--pick` (D-S Option 2, §9 item 72): a comma-joined
 * spec of the checked rows' original 1-based indices, stable regardless of
 * how the list is currently sorted or filtered for display. `undefined` when
 * nothing is checked — the caller disables Preview/Import on that, matching
 * `NO_CONVERSATIONS_SELECTED`'s own rule that an empty selection is an error,
 * never a silent no-op.
 */
export function buildPickSpec(checked: ReadonlySet<number>): string | undefined {
  if (checked.size === 0) return undefined;
  return [...checked].sort((a, b) => a - b).join(",");
}

/** Every row checked by default — the common case is "import everything," with individual opt-out. */
export function allChecked(listing: readonly ImportListingRow[]): Set<number> {
  return new Set(listing.map((row) => row.index));
}

export type SortDirection = "asc" | "desc";

/**
 * Sortable by date *is* what covers `--since` here (§9 item 72): rather than
 * a literal date-cutoff field, the row order lets a user sort newest-first
 * and pick where to stop. A pure display reorder — it never touches the
 * original indices `buildPickSpec` reads.
 */
export function sortListingByDate(
  listing: readonly ImportListingRow[],
  direction: SortDirection,
): ImportListingRow[] {
  const sorted = [...listing].sort((a, b) => a.date.localeCompare(b.date));
  return direction === "asc" ? sorted : sorted.reverse();
}
