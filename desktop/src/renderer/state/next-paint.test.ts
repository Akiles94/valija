import { describe, expect, it } from "vitest";
import { waitForNextPaint } from "./next-paint.js";

/**
 * Runs in this suite's default `node` environment, where
 * `requestAnimationFrame` doesn't exist — exercising the `setTimeout`
 * fallback branch. A second jsdom file isn't added just to cover the rAF
 * branch (P-D5); the fallback is what every other renderer test relies on.
 */
describe("waitForNextPaint", () => {
  it("yields at least one macrotask before resolving, i.e. it actually yields", async () => {
    let macrotaskRan = false;
    setTimeout(() => {
      macrotaskRan = true;
    }, 0);
    await waitForNextPaint();
    expect(macrotaskRan).toBe(true);
  });

  it("resolves cleanly without requestAnimationFrame", async () => {
    await expect(waitForNextPaint()).resolves.toBeUndefined();
  });
});
