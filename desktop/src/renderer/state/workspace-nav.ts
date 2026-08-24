/** Which screen is showing inside the unlocked workspace. Dashboard/search/sync are the three nav-bar destinations; project, pack-preview, relocate-vault, connect-tools, and import are drill-downs reached from Dashboard/Sync. */
export type WorkspaceView =
  | { screen: "dashboard" }
  | { screen: "project"; project: string }
  | { screen: "search" }
  | { screen: "pack-preview"; project: string }
  | { screen: "sync" }
  | { screen: "relocate-vault" }
  | { screen: "connect-tools" }
  | { screen: "import" };

export const INITIAL_WORKSPACE_VIEW: WorkspaceView = { screen: "dashboard" };
