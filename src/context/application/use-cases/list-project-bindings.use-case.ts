import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { type ProjectBindingView, toProjectBindingView } from "../dto/project-binding-view.js";
import type { VaultSessions } from "../ports/vault-session.js";

/** Optionally, the one project whose links to list. */
export interface ListProjectBindingsInput {
  /** Omitted → every binding in the vault. */
  project?: string;
}

/** Folder and repository links, ordered by project, kind, target. Read-only. */
export class ListProjectBindings
  implements UseCase<ListProjectBindingsInput, ProjectBindingView[]>
{
  constructor(private readonly sessions: VaultSessions) {}

  execute(input: ListProjectBindingsInput): Result<ProjectBindingView[], DomainError> {
    const name = input.project === undefined ? null : parseProjectName(input.project);
    if (name !== null && !name.ok) return name;

    return this.sessions.withSession((session) => {
      const only: ProjectName | null = name === null ? null : name.value;
      if (only !== null && session.projects.findByName(only) === null) {
        return contextErr("PROJECT_NOT_FOUND", `No project named "${only}".`);
      }
      const bindings = session.bindings
        .list()
        .filter(({ projectName }) => only === null || projectName === only);
      return ok(bindings.map(toProjectBindingView));
    });
  }
}
