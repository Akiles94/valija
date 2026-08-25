import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DASHBOARD = readFileSync(join(import.meta.dirname, "dashboard.tsx"), "utf8");
const SETTINGS = readFileSync(join(import.meta.dirname, "settings.tsx"), "utf8");
const APP = readFileSync(join(import.meta.dirname, "..", "app.tsx"), "utf8");

/**
 * `review.md`'s W4 (item 89a, `refined.md` §4.6 step 26): Diagnostics is
 * reachable "from the dashboard, or from Settings → Vault & sync" — item 82
 * already required this be a *second entry point*, never a second
 * implementation, so this proves both wiring facts mechanically rather than
 * by review: the dashboard and the settings screen each call a
 * caller-supplied callback (they never navigate directly, since neither
 * imports `bridge.js` — see `onboarding-settings.no-session.test.ts`), and
 * `app.tsx` mounts exactly one `<DiagnosticsScreen`. P-D11 confirmed this
 * source-scan form rather than a third jsdom test — P-D5 confines DOM-level
 * rendering to exactly `recovery-kit.tsx` and `relocate-vault.tsx`.
 */
describe("Diagnostics has exactly one entry point, reached two ways", () => {
  it("dashboard.tsx renders a Check-my-setup action wired to onCheckSetup", () => {
    expect(DASHBOARD).toContain("onCheckSetup");
    expect(DASHBOARD).toContain("dashboard.checkMySetup");
  });

  it("settings.tsx renders an open-Diagnostics action wired to onOpenDiagnostics", () => {
    expect(SETTINGS).toContain("onOpenDiagnostics");
    expect(SETTINGS).toContain("settings.openDiagnostics");
  });

  it("app.tsx passes both callbacks", () => {
    expect(APP).toContain("onCheckSetup=");
    expect(APP).toContain("onOpenDiagnostics=");
  });

  it("app.tsx mounts exactly one DiagnosticsScreen", () => {
    const occurrences = APP.match(/<DiagnosticsScreen/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
