import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import {
  type BindingResolution,
  hintCandidates,
  resolveFromBindings,
} from "../../domain/services/project-resolution.js";
import type { WorkspaceLocation } from "../../domain/values/binding-target.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { toProjectBindingView } from "../dto/project-binding-view.js";
import {
  type ProjectResolutionOutput,
  toWorkspaceLocationView,
  type WorkspaceLocationView,
} from "../dto/project-resolution-output.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";
import type { WorkspaceProbe } from "../ports/workspace-probe.js";

export interface ResolveProjectInput {
  /** Where work is happening: the CLI's cwd or `--dir`, the MCP client's roots. May be empty. */
  directories: string[];
  /** `VALIJA_PROJECT`, read once by the container. Blank means unset. */
  envProject?: string;
}

/**
 * Which project a workspace belongs to (D-E): `VALIJA_PROJECT`, then the
 * deepest folder binding, then the repository binding. An explicit name never
 * reaches this use case — delivery short-circuits it. Read-only: it never
 * writes, never bumps the lineage, never creates a project.
 */
export class ResolveProject implements UseCase<ResolveProjectInput, ProjectResolutionOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly probe: WorkspaceProbe,
  ) {}

  execute(input: ResolveProjectInput): Result<ProjectResolutionOutput, DomainError> {
    const env = parseEnvProject(input.envProject);
    if (!env.ok) return env;

    // The session opens first in every case, so a locked vault is VAULT_LOCKED before any probe (W2).
    return this.sessions.withSession<ProjectResolutionOutput>((session) => {
      if (env.value !== null) {
        // D-E: VALIJA_PROJECT outranks every binding, so an unreadable directory cannot block it.
        const locations = this.locateReadable(input.directories).map(toWorkspaceLocationView);
        return ok({ outcome: "detected", project: env.value, detectedBy: "env", locations });
      }
      const located = this.locateAll(input.directories);
      if (!located.ok) return located;
      const locations = located.value.map(toWorkspaceLocationView);
      const resolution = resolveFromBindings(located.value, session.bindings.list());
      return ok(toOutput(session, resolution, located.value, locations));
    });
  }

  private locateAll(directories: string[]): Result<WorkspaceLocation[], DomainError> {
    const locations: WorkspaceLocation[] = [];
    for (const directory of directories) {
      const location = this.probe.locate(directory);
      if (!location.ok) return location;
      locations.push(location.value);
    }
    return ok(locations);
  }

  /** Every directory the probe can read; the others are skipped (the env case, where none decides). */
  private locateReadable(directories: string[]): WorkspaceLocation[] {
    return directories.flatMap((directory) => {
      const location = this.probe.locate(directory);
      return location.ok ? [location.value] : [];
    });
  }
}

/** Unset or blank → `null`. A bad value names the variable, never echoes it. */
function parseEnvProject(raw: string | undefined): Result<ProjectName | null, DomainError> {
  if (raw === undefined || raw.trim() === "") return ok(null);
  const name = parseProjectName(raw);
  if (name.ok) return name;
  return contextErr(
    "INVALID_PROJECT_NAME",
    "VALIJA_PROJECT is not a valid project name (1-64 chars of [a-z0-9-], starting with a letter or digit).",
  );
}

function toOutput(
  session: VaultSession,
  resolution: BindingResolution,
  located: WorkspaceLocation[],
  locations: WorkspaceLocationView[],
): ProjectResolutionOutput {
  switch (resolution.outcome) {
    case "bound":
      return {
        outcome: "detected",
        project: resolution.match.projectName,
        detectedBy: resolution.match.binding.kind,
        binding: toProjectBindingView(resolution.match),
        locations,
      };
    case "ambiguous":
      return { outcome: "ambiguous", projects: [...resolution.projectNames], locations };
    case "none": {
      const hint = existingHint(session, located);
      return { outcome: "none", ...(hint === null ? {} : { hint }), locations };
    }
  }
}

/** The first name-match candidate that is an existing project. A read: it never creates one (D-H). */
function existingHint(session: VaultSession, located: WorkspaceLocation[]): string | null {
  for (const candidate of located.flatMap(hintCandidates)) {
    const name = parseProjectName(candidate);
    if (name.ok && session.projects.findByName(name.value) !== null) return name.value;
  }
  return null;
}
