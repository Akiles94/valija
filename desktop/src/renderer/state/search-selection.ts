/**
 * The selected hit, derived — never stored twice. Falls back to the first hit when the stored id
 * is absent (a new result set) or null (a fresh search), which is what makes "the first hit is
 * selected when a search completes" true with no effect and no re-query.
 */
export function selectedHit<T extends { id: string }>(
  hits: readonly T[],
  selectedId: string | null,
): T | null {
  if (hits.length === 0) return null;
  const match = selectedId !== null ? hits.find((hit) => hit.id === selectedId) : undefined;
  return match ?? hits[0] ?? null;
}
