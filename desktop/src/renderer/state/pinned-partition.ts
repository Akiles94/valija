export interface PinnedPartition<T> {
  pinned: T[];
  rest: T[];
}

/** A stable partition, never a re-sort: relative order inside each group is exactly the order the rows arrived in (D-9). */
export function partitionPinnedItems<T extends { pinned: boolean }>(
  items: readonly T[],
): PinnedPartition<T> {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (item.pinned ? pinned : rest).push(item);
  }
  return { pinned, rest };
}
