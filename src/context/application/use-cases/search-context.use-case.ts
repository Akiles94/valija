import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import { parseProjectName } from "../../domain/values/project-name.js";
import { type ContextItemView, toContextItemView } from "../dto/context-item-view.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";

export interface SearchContextInput {
  query: string;
  project?: string;
  limit?: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export class SearchContext implements UseCase<SearchContextInput, ContextItemView[]> {
  constructor(private readonly sessions: VaultSessions) {}

  execute(input: SearchContextInput): Result<ContextItemView[], DomainError> {
    return this.sessions.withSession((session) => {
      const scope = this.resolveProjectScope(session, input.project);
      if (!scope.ok) return scope;

      const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const hits = session.items
        .search(input.query, scope.value, limit)
        .map((result) => toContextItemView(result.item, result.projectName));
      return ok(hits);
    });
  }

  /** No project given → search everywhere; otherwise the project must exist. */
  private resolveProjectScope(
    session: VaultSession,
    project: string | undefined,
  ): Result<string | undefined, DomainError> {
    if (project === undefined) return ok(undefined);
    const name = parseProjectName(project);
    if (!name.ok) return name;
    const found = session.projects.findByName(name.value);
    if (found === null) {
      return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
    }
    return ok(found.id);
  }
}
