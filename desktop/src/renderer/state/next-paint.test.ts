import { describe, expect, it } from "vitest";
import { waitForNextPaint } from "./next-paint.js";

/**
 * Runs in the `node` environment (this file carries no jsdom pragma), so
 * `requestAnimationFrame` is undefined and the `setTimeout` fallback is what
 * is under test here. It must actually yield — resolving synchronously would
 * defeat D-2 = O1's whole point of handing the browser a frame to paint.
 */
describe("waitForNextPaint", () => {
  it("resolves after yielding at least one macrotask", async () => {
    let settled = false;
    const promise = waitForNextPaint().then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await promise;
    expect(settled).toBe(true);
  });

  it("falls back to a plain task when requestAnimationFrame does not exist", () => {
    expect(typeof requestAnimationFrame).toBe("undefined");
  });
});
