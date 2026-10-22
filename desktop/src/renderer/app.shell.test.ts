import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = readFileSync(join(import.meta.dirname, "app.tsx"), "utf8");
const BASE_CSS = readFileSync(join(import.meta.dirname, "styles/base.css"), "utf8");
const NAV_BAR_PATH = join(import.meta.dirname, "components/nav-bar.tsx");

/**
 * GUI-LAYOUT Slice 2: the top nav bar is gone, replaced by the sidebar +
 * breadcrumb shell derived from `workspaceChrome`. A source-scan, the house
 * style of `app.theme.test.ts` / `import-entry-points.test.ts` — P-D5 confines
 * jsdom rendering to `recovery-kit.tsx`/`relocate-vault.tsx`.
 */
describe("the sidebar/breadcrumb shell replaced the top nav bar", () => {
  it("app.tsx mounts exactly one WorkspaceSidebar, derived from workspaceChrome", () => {
    const mounts = APP.match(/<WorkspaceSidebar/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(APP).toContain("workspaceChrome(");
  });

  it("app.tsx has no remaining NavBar/nav-bar reference", () => {
    expect(APP).not.toContain("NavBar");
    expect(APP).not.toContain("nav-bar");
  });

  it("nav-bar.tsx no longer exists", () => {
    expect(existsSync(NAV_BAR_PATH)).toBe(false);
  });

  it("base.css has no .nav-bar selector", () => {
    expect(BASE_CSS).not.toContain(".nav-bar");
  });
});

describe("the newer-schema terminal screen is routed like the other entry screens (P-18 (b))", () => {
  it('app.tsx renders SchemaTooNewScreen inside EntryShell for case "schema-too-new"', () => {
    expect(APP).toMatch(
      /case "schema-too-new":\s*return \(\s*<EntryShell>\s*<SchemaTooNewScreen[\s\S]*?<\/EntryShell>/,
    );
  });

  it("Quit closes the window — no new IPC channel (P-22)", () => {
    expect(APP).toContain("onQuit={() => window.close()}");
  });

  it("the bridge wrapper routes newer-schema refusals to the terminal phase", () => {
    expect(APP).toMatch(/withLockDetection\([\s\S]*?afterSchemaTooNew\(versions\)/);
  });
});
