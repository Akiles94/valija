/**
 * D-D's "is this long?" predicate (`advances/CARDS/refined.md` §6 D-D,
 * Option A) — a pure heuristic on the source string, not a layout
 * measurement (jsdom reports `scrollHeight`/`clientHeight` as `0`, which
 * would make a measurement-based test assert nothing real).
 *
 * These two constants are tied to `.item-content.collapsed`'s `176px` cap
 * in `screens.css` — change all three together or none: `ItemCard` renders
 * unclamped whenever this returns `false`, so a mis-prediction can only
 * show a needless toggle, never hide content.
 */
export const LONG_CONTENT_CHARS = 420;
/** Line count from which an item card starts collapsed. */
export const LONG_CONTENT_NEWLINES = 6;

/** True when an item is long enough that its card starts collapsed behind a Show more toggle. */
export function isLongContent(content: string): boolean {
  if (content.length > LONG_CONTENT_CHARS) return true;
  const newlineCount = content.split("\n").length - 1;
  return newlineCount >= LONG_CONTENT_NEWLINES;
}
