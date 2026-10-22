import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { isSameOrInside } from "../../../shared/domain/services/path-containment.js";
import type { ProjectBinding } from "../entities/project-binding.js";
import { contextErr } from "../errors.js";
import {
  type BindingKind,
  type FolderTarget,
  folderDepth,
  type WorkspaceLocation,
} from "../values/binding-target.js";
import type { ProjectName } from "../values/project-name.js";
import { type RepositoryTarget, repositoryName } from "../values/repository-target.js";

/** A binding and the slug of the project it maps to — what the repository's list returns. */
export interface BoundProject {
  readonly binding: ProjectBinding;
  readonly projectName: ProjectName;
}

/** What the links say about a workspace: one bound project, none, or several (ambiguous). */
export type BindingResolution =
  | { readonly outcome: "bound"; readonly match: BoundProject }
  | { readonly outcome: "none" }
  | { readonly outcome: "ambiguous"; readonly projectNames: ProjectName[] };

/** What a new link points at: a folder, or a normalized repository remote. */
export interface LinkTarget {
  readonly kind: BindingKind;
  readonly target: FolderTarget | RepositoryTarget;
}

/** D-E for one location: the deepest folder binding covering it, else its repository's binding. */
export function bindingFor(
  location: WorkspaceLocation,
  bindings: readonly BoundProject[],
  platform: NodeJS.Platform = process.platform,
): BoundProject | null {
  const covering = bindings.filter(
    ({ binding }) =>
      binding.kind === "folder" && isSameOrInside(binding.target, location.folder, platform),
  );
  const deepest = covering.reduce<BoundProject | null>(
    (best, candidate) => (best === null || depthOf(candidate) > depthOf(best) ? candidate : best),
    null,
  );
  if (deepest !== null) return deepest;
  if (location.repository === null) return null;
  return (
    bindings.find(
      ({ binding }) => binding.kind === "repository" && binding.target === location.repository,
    ) ?? null
  );
}

/** D-E across every workspace directory: one distinct project → bound; two or more → ambiguous. */
export function resolveFromBindings(
  locations: readonly WorkspaceLocation[],
  bindings: readonly BoundProject[],
  platform: NodeJS.Platform = process.platform,
): BindingResolution {
  const matches = locations
    .map((location) => bindingFor(location, bindings, platform))
    .filter((match): match is BoundProject => match !== null);
  const first = matches[0];
  if (first === undefined) return { outcome: "none" };
  const projectNames = distinctProjectNames(matches);
  if (projectNames.length === 1) return { outcome: "bound", match: first };
  return { outcome: "ambiguous", projectNames };
}

/** The binding that already owns this exact target, if any (case-folded on win32/darwin for folders). */
export function bindingOnTarget(
  bindings: readonly BoundProject[],
  kind: BindingKind,
  target: string,
  platform: NodeJS.Platform = process.platform,
): BoundProject | null {
  const sameTarget = (bound: string) =>
    kind === "repository"
      ? bound === target
      : isSameOrInside(bound, target, platform) && isSameOrInside(target, bound, platform);
  return (
    bindings.find(({ binding }) => binding.kind === kind && sameTarget(binding.target)) ?? null
  );
}

/** D-K default kind: the repository when it has a usable remote, else the folder. */
export function chooseLinkTarget(
  location: WorkspaceLocation,
  by?: BindingKind,
): Result<LinkTarget, DomainError> {
  if (by === "repository" && location.repository === null) {
    return contextErr(
      "NO_GIT_REMOTE",
      "This folder is not inside a git repository with a usable remote. Link the folder instead (--by folder).",
    );
  }
  if (by === "folder" || location.repository === null) return folderLinkTarget(location);
  return ok({ kind: "repository", target: location.repository });
}

/** Name-match hint candidates (D-E option 1): the repository's name and its root folder's name. */
export function hintCandidates(location: WorkspaceLocation): string[] {
  const candidates = [
    location.repository === null ? null : repositoryName(location.repository),
    location.repositoryRoot === null ? null : lastSegment(location.repositoryRoot),
  ];
  const named = candidates.filter((name): name is string => name !== null && name.length > 0);
  return [...new Set(named.map((name) => name.toLowerCase()))];
}

function folderLinkTarget(location: WorkspaceLocation): Result<LinkTarget, DomainError> {
  if (location.tooBroadToLink) {
    return contextErr(
      "INVALID_WORKSPACE_PATH",
      "Linking your home folder or the filesystem root would match everything. Pick a project folder.",
    );
  }
  return ok({ kind: "folder", target: location.folder });
}

function depthOf({ binding }: BoundProject): number {
  return folderDepth(binding.target as FolderTarget);
}

function distinctProjectNames(matches: readonly BoundProject[]): ProjectName[] {
  const byProject = new Map(matches.map((match) => [match.binding.projectId, match.projectName]));
  return [...byProject.values()].sort();
}

function lastSegment(folder: FolderTarget): string {
  return (
    folder
      .split(/[\\/]/)
      .filter((segment) => segment.length > 0)
      .at(-1) ?? ""
  );
}
