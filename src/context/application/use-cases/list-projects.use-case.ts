import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { VaultSessions } from "../ports/vault-session.js";

export interface ProjectListEntry {
  name: string;
  description?: string;
  itemCount: number;
  lastActivityAt: string | null;
}

export class ListProjects implements UseCase<void, ProjectListEntry[]> {
  constructor(private readonly sessions: VaultSessions) {}

  execute(): Result<ProjectListEntry[], DomainError> {
    return this.sessions.withSession((session) => {
      const entries = session.projects.list().map((summary) => ({
        name: summary.project.name as string,
        ...(summary.project.description === undefined
          ? {}
          : { description: summary.project.description }),
        itemCount: summary.itemCount,
        lastActivityAt: summary.lastActivityAt?.toISOString() ?? null,
      }));
      return ok(entries);
    });
  }
}
