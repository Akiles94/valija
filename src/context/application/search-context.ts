import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { contextErr } from "../domain/errors.js";
import type { ItemType } from "../domain/values/item-type.js";
import { parseProjectName } from "../domain/values/project-name.js";
import type { VaultSessionFactory } from "./ports/vault-session.js";

export interface SearchContextInput {
  query: string;
  project?: string;
  limit?: number;
}

export interface SearchHit {
  id: string;
  project: string;
  type: ItemType;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

export class SearchContext {
  constructor(private readonly sessions: VaultSessionFactory) {}

  execute(input: SearchContextInput): Result<SearchHit[], DomainError> {
    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      let projectId: string | undefined;
      if (input.project !== undefined) {
        const name = parseProjectName(input.project);
        if (!name.ok) return name;
        const project = session.value.projects.findByName(name.value);
        if (project === null) {
          return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
        }
        projectId = project.id;
      }
      const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
      const hits = session.value.items.search(input.query, projectId, limit).map((result) => ({
        id: result.item.id,
        project: result.projectName as string,
        type: result.item.type,
        content: result.item.content,
        tags: [...result.item.tags],
        pinned: result.item.pinned,
        createdAt: result.item.createdAt.toISOString(),
      }));
      return ok(hits);
    } finally {
      session.value.close();
    }
  }
}
