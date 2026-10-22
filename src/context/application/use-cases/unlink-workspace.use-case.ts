import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import { type BoundProject, bindingFor } from "../../domain/services/project-resolution.js";
import { type BindingId, parseBindingId } from "../../domain/values/binding-id.js";
import type { BindingKind } from "../../domain/values/binding-target.js";
import { type ProjectBindingView, toProjectBindingView } from "../dto/project-binding-view.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";
import type { WorkspaceProbe } from "../ports/workspace-probe.js";

/** By id (see `valija links`), or by the binding a directory resolves through. Never both. */
export type UnlinkWorkspaceInput = { bindingId: string } | { directory: string; by?: BindingKind };

/**
 * Remove one binding and report what was removed. In a sub-folder, the binding
 * a directory resolves through can be an ancestor's folder binding or the
 * repository's (W3), so the output always names the removed target.
 */
export class UnlinkWorkspace implements UseCase<UnlinkWorkspaceInput, ProjectBindingView> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly probe: WorkspaceProbe,
  ) {}

  execute(input: UnlinkWorkspaceInput): Result<ProjectBindingView, DomainError> {
    if ("bindingId" in input) return this.unlinkById(input.bindingId);
    return this.sessions.withSession((session) =>
      removeBinding(session, this.bindingAt(session, input)),
    );
  }

  private unlinkById(raw: string): Result<ProjectBindingView, DomainError> {
    const id = parseBindingId(raw);
    if (!id.ok) return id;
    return this.sessions.withSession((session) =>
      removeBinding(session, bindingWithId(session, id.value)),
    );
  }

  private bindingAt(
    session: VaultSession,
    input: { directory: string; by?: BindingKind },
  ): Result<BoundProject, DomainError> {
    const location = this.probe.locate(input.directory);
    if (!location.ok) return location;
    const bindings = session.bindings
      .list()
      .filter(({ binding }) => input.by === undefined || binding.kind === input.by);
    const found = bindingFor(location.value, bindings);
    if (found !== null) return ok(found);
    return contextErr(
      "BINDING_NOT_FOUND",
      `Nothing linked here${input.by === undefined ? "" : ` by ${input.by}`}.`,
    );
  }
}

function bindingWithId(session: VaultSession, id: BindingId): Result<BoundProject, DomainError> {
  const found = session.bindings.list().find(({ binding }) => binding.id === id);
  return found === undefined
    ? contextErr("BINDING_NOT_FOUND", "No binding has that id.")
    : ok(found);
}

/** The one write, only once a binding was found; a row another process removed first is an `err`, so it rolls back unbumped. */
function removeBinding(
  session: VaultSession,
  found: Result<BoundProject, DomainError>,
): Result<ProjectBindingView, DomainError> {
  if (!found.ok) return found;
  const { binding } = found.value;
  return session.write(() =>
    session.bindings.remove(binding.id)
      ? ok(toProjectBindingView(found.value))
      : contextErr("BINDING_NOT_FOUND", "No binding has that id."),
  );
}
