import type { BindingKind, WorkspaceLocation } from "../../domain/values/binding-target.js";
import type { ProjectBindingView } from "./project-binding-view.js";

/** How a project was detected: through a binding of that kind, or `VALIJA_PROJECT`. */
export type DetectionKind = BindingKind | "env";

/** What the probe saw for one workspace directory — for `which` and the desktop inspect panel only. */
export interface WorkspaceLocationView {
  folder: string;
  repositoryRoot: string | null;
  repository: string | null;
  tooBroadToLink: boolean;
}

/**
 * The resolution outcome, primitives only. `locations` (and `binding`) carry
 * paths and remotes: the MCP adapter never reads them, only `project` and
 * `detectedBy` (refined.md §10.2).
 */
export type ProjectResolutionOutput =
  | {
      outcome: "detected";
      project: string;
      detectedBy: DetectionKind;
      /** Absent when `VALIJA_PROJECT` decided. */
      binding?: ProjectBindingView;
      locations: WorkspaceLocationView[];
    }
  | { outcome: "none"; hint?: string; locations: WorkspaceLocationView[] }
  | { outcome: "ambiguous"; projects: string[]; locations: WorkspaceLocationView[] };

export const toWorkspaceLocationView = (location: WorkspaceLocation): WorkspaceLocationView => ({
  folder: location.folder as string,
  repositoryRoot: location.repositoryRoot as string | null,
  repository: location.repository as string | null,
  tooBroadToLink: location.tooBroadToLink,
});
