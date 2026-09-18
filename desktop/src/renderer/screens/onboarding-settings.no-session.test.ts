import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ONBOARDING = readFileSync(join(import.meta.dirname, "onboarding.tsx"), "utf8");
const SETTINGS = readFileSync(join(import.meta.dirname, "settings.tsx"), "utf8");

/**
 * Item 90/refined.md §4.8 step 37: opening Settings, and watching or
 * replaying the tour, must open no vault session and touch no vault file —
 * in particular, must not extend the idle-lock clock the way a
 * `SessionGuard`-backed read does (M3 D-I; `app.tsx`'s own comment on
 * `Workspace` explains why a polling refresh would silently disable
 * auto-lock, and the same reasoning applies to any bridge call here). A
 * DOM-level render test isn't available — P-D5 confines jsdom to exactly
 * `recovery-kit.tsx` and `relocate-vault.tsx` — so, in the idiom of
 * `diagnostics.no-auto-run.test.ts` and `no-network-surface.test.ts`, this
 * asserts the stronger, structural guarantee: neither screen imports the
 * bridge at all, so neither can call anything that would open a session.
 * `app.tsx` (not scanned here) owns every `bridge.preferences.*` call these
 * screens' actions eventually trigger.
 */
const BRIDGE_IMPORT = /from ["'].*state\/bridge\.js["']/;

describe("onboarding.tsx and settings.tsx never touch the vault", () => {
  it("onboarding.tsx does not import the bridge", () => {
    expect(ONBOARDING).not.toMatch(BRIDGE_IMPORT);
  });

  it("settings.tsx does not import the bridge", () => {
    expect(SETTINGS).not.toMatch(BRIDGE_IMPORT);
  });
});
