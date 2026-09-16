/** Roving-focus arrow-key behaviour for a tablist (ARIA APG): Left/Up previous, Right/Down next, Home/End ends, wrapping; any other key returns the current id unchanged. */
export function nextTabId<T extends string>(ids: readonly T[], current: T, key: string): T {
  const index = ids.indexOf(current);
  if (index === -1) return current;

  switch (key) {
    case "ArrowLeft":
    case "ArrowUp":
      return ids[(index - 1 + ids.length) % ids.length] as T;
    case "ArrowRight":
    case "ArrowDown":
      return ids[(index + 1) % ids.length] as T;
    case "Home":
      return ids[0] as T;
    case "End":
      return ids[ids.length - 1] as T;
    default:
      return current;
  }
}
