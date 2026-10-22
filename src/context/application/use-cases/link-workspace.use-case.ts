import type { Clock, IdGenerator } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { Project } from "../../domain/entities/project.js";
import { createProjectBinding } from "../../domain/entities/project-binding.js";
import { contextErr } from "../../domain/errors.js";
import {
  type BoundProject,
  bindingOnTarget,
  chooseLinkTarget,
  type LinkTarget,
} from "../../domain/services/project-resolution.js";
import type { BindingKind } from "../../domain/values/binding-target.js";
import { parseProjectName } from "../../domain/values/project-name.js";
import { type ProjectBindingView, toProjectBindingView } from "../dto/project-binding-view.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";
import type { WorkspaceProbe } from "../ports/workspace-probe.js";

/** Which existing project to link, from which directory, and whether by repository or folder. */
export interface LinkWorkspaceInput {
  /** An existing project's slug: linking never creates a project (D-H). */
  project: string;
  directory: string;
  /** Omitted → the repository when it has a usable remote, else the folder (D-K). */
  by?: BindingKind;
}

/** The link as stored, and whether this call actually created it. */
export interface LinkWorkspaceOutput {
  binding: ProjectBindingView;
  /** `false`: that target was already linked to that project, and nothing was written. */
  changed: boolean;
}

/**
 * The user act that anchors detection: link a folder or its repository to one
 * project. Checks project → path → remote → existing binding before opening a
 * write, so a rejection or a no-op never bumps the lineage.
 */
export class LinkWorkspace implements UseCase<LinkWorkspaceInput, LinkWorkspaceOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly probe: WorkspaceProbe,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  execute(input: LinkWorkspaceInput): Result<LinkWorkspaceOutput, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;

    return this.sessions.withSession((session) => {
      const project = session.projects.findByName(name.value);
      if (project === null) {
        return contextErr(
          "PROJECT_NOT_FOUND",
          `No project named "${name.value}". Link only to an existing project.`,
        );
      }
      const location = this.probe.locate(input.directory);
      if (!location.ok) return location;
      const chosen = chooseLinkTarget(location.value, input.by);
      if (!chosen.ok) return chosen;
      const { kind, target } = chosen.value;
      const existing = bindingOnTarget(session.bindings.list(), kind, target);
      if (existing !== null) return alreadyBound(existing, project);
      return this.addBinding(session, project, chosen.value);
    });
  }

  /** The one write: a lost race (another process linked it first) is an `err`, so it rolls back unbumped. */
  private addBinding(
    session: VaultSession,
    project: Project,
    { kind, target }: LinkTarget,
  ): Result<LinkWorkspaceOutput, DomainError> {
    const binding = createProjectBinding({
      id: this.idGen.next(),
      projectId: project.id,
      kind,
      target,
      now: this.clock.now(),
    });
    const view = toProjectBindingView({ binding, projectName: project.name });
    return session.write(() =>
      session.bindings.add(binding)
        ? ok({ binding: view, changed: true })
        : contextErr(
            "BINDING_CONFLICT",
            `That ${kind} was just linked by another valija process. See it with: valija links`,
          ),
    );
  }
}

/** Same project → a no-op; another project → BINDING_CONFLICT naming its slug and the binding id only. */
function alreadyBound(
  existing: BoundProject,
  project: Project,
): Result<LinkWorkspaceOutput, DomainError> {
  if (existing.binding.projectId === project.id) {
    return ok({ binding: toProjectBindingView(existing), changed: false });
  }
  return contextErr(
    "BINDING_CONFLICT",
    `That ${existing.binding.kind} is already linked to project "${existing.projectName}". Unlink it first (valija unlink ${existing.binding.id}).`,
  );
}
