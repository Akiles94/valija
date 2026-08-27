import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(import.meta.dirname, "diagnostics.tsx"), "utf8");

/**
 * §4.6 step 26'/80, §8 item 13: both probe-backed reads this screen performs
 * — the keychain-backed `bridge.diagnostics.run` and the Node-probe-backed
 * `bridge.tools.nodeStatus` — must only ever run from an explicit user
 * action, never automatically, silently, or on a timer. A DOM-level render
 * test isn't available here — P-D5 (2026-08-20) limits jsdom + Testing
 * Library to exactly `recovery-kit.tsx` and `relocate-vault.tsx` — so this
 * asserts the same structural guarantee the rest of `desktop/` uses for
 * invariants a render test would otherwise cover (see
 * `no-network-surface.test.ts`, `import-no-reimplementation.test.ts`): the
 * screen has no `useEffect` at all, so nothing in it can fire on mount.
 */
describe("diagnostics.tsx never runs its probe-backed reads automatically", () => {
  it("calls bridge.diagnostics.run and bridge.tools.nodeStatus, both from the same explicit handler", () => {
    expect(SOURCE).toContain("diagnostics.run(");
    expect(SOURCE).toContain("tools.nodeStatus(");
    const handlerStart = SOURCE.indexOf("async function handleRunChecks()");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerBody = SOURCE.slice(handlerStart, SOURCE.indexOf("\n  }\n", handlerStart));
    expect(handlerBody).toContain("diagnostics.run(");
    expect(handlerBody).toContain("tools.nodeStatus(");
  });

  it("has no useEffect anywhere — nothing on this screen runs on mount", () => {
    expect(SOURCE).not.toContain("useEffect");
  });
});
