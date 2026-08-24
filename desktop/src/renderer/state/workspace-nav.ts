/** Which screen is showing inside the unlocked workspace. Dashboard/search/sync are the three nav-bar destinations; project and pack-preview are drill-downs reached from Dashboard. */
export type WorkspaceView =
  | { screen: "dashboard" }
  | { screen: "project"; project: string }
  | { screen: "search" }
  | { screen: "pack-preview"; project: string }
  | { screen: "sync" };

export const INITIAL_WORKSPACE_VIEW: WorkspaceView = { screen: "dashboard" };
