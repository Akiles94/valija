import { type DomainError, ok, type Result } from "../../domain/errors.js";
import type { VaultSessionFactory } from "../../domain/ports/vault-session.js";

export interface ProjectListEntry {
  name: string;
  description?: string;
  itemCount: number;
  lastActivityAt: string | null;
}

export class ListProjects {
  constructor(private readonly sessions: VaultSessionFactory) {}

  execute(): Result<ProjectListEntry[], DomainError> {
    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      const entries = session.value.projects.list().map((summary) => ({
        name: summary.project.name as string,
        ...(summary.project.description === undefined
          ? {}
          : { description: summary.project.description }),
        itemCount: summary.itemCount,
        lastActivityAt: summary.lastActivityAt?.toISOString() ?? null,
      }));
      return ok(entries);
    } finally {
      session.value.close();
    }
  }
}
