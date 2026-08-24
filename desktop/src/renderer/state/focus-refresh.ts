export interface FocusTarget {
  addEventListener(type: "focus", listener: () => void): void;
  removeEventListener(type: "focus", listener: () => void): void;
}

/**
 * Wires `refetch` to fire again whenever `target` regains focus, and returns
 * the cleanup. This app never polls on a repeating timer: "state refreshes
 * on user action and on window focus, not on a timer" (refined.md §6) —
 * each refetch goes through the same per-action `VaultSessions.withSession`
 * path a mount-time fetch does, so there is no long-lived session kept open
 * between refreshes.
 */
export function wireFocusRefresh(target: FocusTarget, refetch: () => void): () => void {
  target.addEventListener("focus", refetch);
  return () => target.removeEventListener("focus", refetch);
}
