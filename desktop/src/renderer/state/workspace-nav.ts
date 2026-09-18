/** Which screen is showing inside the unlocked workspace. Dashboard/search/connect-tools/sync are the four nav-bar destinations; project, pack-preview, relocate-vault, import, and diagnostics are drill-downs reached from Dashboard/Sync. */
export type WorkspaceView =
  | { screen: "dashboard" }
  | { screen: "project"; project: string }
  | { screen: "search" }
  | { screen: "pack-preview"; project: string }
  | { screen: "sync" }
  | { screen: "relocate-vault" }
  | { screen: "connect-tools" }
  | { screen: "import" }
  | { screen: "diagnostics" };

export const INITIAL_WORKSPACE_VIEW: WorkspaceView = { screen: "dashboard" };

export type NavDestination = "dashboard" | "search" | "connect-tools" | "sync";
/** Today's order, unchanged (§5.0). Driven from a list, not four hardcoded entries, so CONNECT can add a lock indicator / a fifth entry without a rewrite (D-21a). */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  "dashboard",
  "search",
  "connect-tools",
  "sync",
];

/**
 * A workspace view must not survive the session leaving "unlocked" — call
 * this at every transition out of it (relocation's `onVaultRelocated`
 * today), paired with the `SessionState` transition, so a completed
 * relocation cannot land the next unlock back inside the relocation wizard.
 */
export function resetWorkspaceView(): WorkspaceView {
  return INITIAL_WORKSPACE_VIEW;
}
