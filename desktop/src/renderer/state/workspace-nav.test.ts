import { describe, expect, it } from "vitest";
import { INITIAL_WORKSPACE_VIEW, resetWorkspaceView } from "./workspace-nav.js";

describe("resetWorkspaceView", () => {
  it("returns the dashboard — never a drill-down like relocate-vault or diagnostics", () => {
    expect(resetWorkspaceView()).toEqual(INITIAL_WORKSPACE_VIEW);
    expect(resetWorkspaceView()).toEqual({ screen: "dashboard" });
  });
});
