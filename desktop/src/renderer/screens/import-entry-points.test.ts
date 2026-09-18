import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD = readFileSync(join(import.meta.dirname, "dashboard.tsx"), "utf8");
const APP = readFileSync(join(import.meta.dirname, "..", "app.tsx"), "utf8");

/**
 * IMPORT-ENTRY (`advances/IMPORT-ENTRY/refined.md` §1): the Import action used to
 * live only in the dashboard's `projects.length === 0` branch, so a vault with any
 * content had no route to `ImportScreen` from the GUI at all. D-1 moved it into the
 * shared `header`, which all four return branches interpolate.
 *
 * This scans the *header block*, not the whole file: `dashboard.tsx` mentioned
 * `onImportHistory` before the fix too, so a bare `toContain` would have passed
 * against the bug. D-4 chose this source-scan form over a jsdom render to stay
 * inside GUI P-D5 (DOM tests confined to `recovery-kit.tsx` and
 * `relocate-vault.tsx`) and P-D11. Named trade-off: it proves the wiring, not the
 * rendering.
 */
function headerBlock(source: string): string {
  const start = source.indexOf("const header = (");
  const end = source.indexOf("\n  );", start);
  if (start < 0 || end < start) {
    throw new Error("dashboard.tsx no longer declares a `const header = (…)` block");
  }
  return source.slice(start, end);
}

const HEADER = headerBlock(DASHBOARD);

describe("Import is reachable from every dashboard branch", () => {
  it("puts the Import action in the shared header, not in the empty branch", () => {
    expect(HEADER).toContain("onImportHistory");
    expect(HEADER).toContain("dashboard.importHistory");
    // Guards the slice itself: if `headerBlock` ever over-runs into the empty
    // branch (e.g. after a reformat moves the closing `\n  );`), it would pick
    // up this branch's own Import button and pass vacuously — exactly the bug
    // this file exists to catch (review IMPORT-ENTRY, finding W2).
    expect(HEADER).not.toContain("projects.length === 0");
  });

  it("keeps Check my setup in the header, after Import (D-6)", () => {
    expect(HEADER).toContain("onCheckSetup");
    expect(HEADER.indexOf("onImportHistory")).toBeLessThan(HEADER.indexOf("onCheckSetup"));
  });

  it("still renders the header in all four return branches (item 89a)", () => {
    const headerUses = DASHBOARD.match(/\{header\}/g) ?? [];
    expect(headerUses).toHaveLength(4);
  });

  it("navigates through a caller-supplied callback, never by itself", () => {
    expect(DASHBOARD).not.toContain("setView");
    expect(DASHBOARD).not.toContain("workspace-nav");
  });

  it("app.tsx still mounts exactly one ImportScreen", () => {
    const mounts = APP.match(/<ImportScreen/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(APP).toContain("onImportHistory=");
  });
});
