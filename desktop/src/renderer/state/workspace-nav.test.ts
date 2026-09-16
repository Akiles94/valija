import { describe, expect, it } from "vitest";
import { INITIAL_WORKSPACE_VIEW, NAV_DESTINATIONS, resetWorkspaceView } from "./workspace-nav.js";

describe("resetWorkspaceView", () => {
  it("returns the dashboard — never a drill-down like relocate-vault or diagnostics", () => {
    expect(resetWorkspaceView()).toEqual(INITIAL_WORKSPACE_VIEW);
    expect(resetWorkspaceView()).toEqual({ screen: "dashboard" });
  });
});

describe("NAV_DESTINATIONS", () => {
  it("is today's four nav-bar destinations, in today's order", () => {
    expect(NAV_DESTINATIONS).toEqual(["dashboard", "search", "connect-tools", "sync"]);
  });
});
