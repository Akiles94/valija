import { homedir } from "node:os";
import { join } from "node:path";

export interface StatePaths {
  root: string;
  state: string;
}

/**
 * Device-local state root — deliberately independent of VALIJA_HOME (which a
 * BYO-cloud setup points at a synced folder) so device identity, last-seen
 * lineage, and last-activity timestamps never land inside that synced folder.
 */
export function resolveStatePaths(rootOverride?: string): StatePaths {
  const root = rootOverride ?? process.env.VALIJA_STATE_HOME ?? join(homedir(), ".valija-state");
  return {
    root,
    state: join(root, "state.json"),
  };
}
