/**
 * IMPORT-FEEDBACK D-2 = O1, "paint before you block": the whole import runs
 * synchronously on the Electron main process, so a busy state that is only
 * *set* before the IPC call is never *presented* — the user keeps looking at
 * the last frame painted before main froze. Awaiting this hands the browser
 * two frames to commit the busy state first.
 *
 * Two rAFs, then a task: the second callback cannot run until the first frame
 * was committed, and the `setTimeout` leaves that frame's paint behind us
 * rather than in the same callback. A repeating timer is forbidden repo-wide
 * (`no-network-surface.test.ts`) and is not needed here anyway. Falls back to
 * a plain task where `requestAnimationFrame` does not exist (the `node` test
 * environment), so this is safe to call from anywhere.
 */
export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
  });
}
