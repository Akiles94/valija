import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER_CONFIG = readFileSync(
  join(import.meta.dirname, "../../../electron-builder.yml"),
  "utf8",
);
const PACKAGE_JSON = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../../package.json"), "utf8"),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

/**
 * §8.5, item 95: "no `publish`/auto-update configuration of any kind" — the
 * mechanical form, in the idiom of Slice 1 step 7's grep
 * (`no-network-surface.test.ts`), so the rule is kept by the suite rather
 * than by nobody adding a key (P-D19). `electron-builder.yml`'s own
 * `publish` key is what turns a packaged build into a self-updating one
 * (checking a feed on launch); this app has no update feed and no code path
 * that checks one.
 */
describe("no auto-update configuration anywhere in the desktop build", () => {
  it("electron-builder.yml has no publish key, at any indentation or quoting", () => {
    // Not just a top-level key: electron-builder honours a platform-scoped
    // `mac:`/`win:`/`linux:` `publish:` too, and YAML allows a quoted key
    // (`"publish":`) — both turn on auto-update just as a top-level one would.
    expect(BUILDER_CONFIG).not.toMatch(/^\s*["']?publish["']?\s*:/m);
  });

  it("desktop/package.json has no updater-shaped dependency", () => {
    // Not just the literal name `electron-updater` — `update-electron-app`,
    // `electron-differential-updater` and similar packages are the same shape.
    const allDeps = { ...PACKAGE_JSON.dependencies, ...PACKAGE_JSON.devDependencies };
    const updaterLike = Object.keys(allDeps).filter((name) => /updat(e|er)/i.test(name));
    expect(updaterLike).toEqual([]);
  });
});
