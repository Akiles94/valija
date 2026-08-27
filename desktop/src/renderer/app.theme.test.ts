import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = readFileSync(join(import.meta.dirname, "app.tsx"), "utf8");
const RECOVERY_KIT = readFileSync(join(import.meta.dirname, "screens/recovery-kit.tsx"), "utf8");

/**
 * Item 89b (D-Q): the resolved theme is applied as `data-theme` on the shell
 * root exactly once, and nowhere else outside the recovery kit's own
 * permanent `dark` (D-Q's exception, structural since Slice 6 — that screen
 * still never imports `useTheme`). A DOM-level render test isn't available
 * here — P-D5 confines jsdom to exactly `recovery-kit.tsx` and
 * `relocate-vault.tsx` — so this proves the wiring the same structural way
 * `no-network-surface.test.ts` and `diagnostics.no-auto-run.test.ts` do.
 */
describe("the resolved theme reaches the DOM in exactly one place", () => {
  it("app.tsx applies useTheme()'s value as data-theme on the shell root", () => {
    expect(APP).toContain("useTheme()");
    expect(APP).toMatch(/data-theme=\{theme\}/);
  });

  it("recovery-kit.tsx still hardcodes dark and never imports useTheme", () => {
    expect(RECOVERY_KIT).toContain('data-theme="dark"');
    expect(RECOVERY_KIT).not.toMatch(/from ["'].*theme-context\.js["']/);
  });
});
