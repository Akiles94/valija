import { type DomainError, ok, type Result } from "../../shared/domain/result.js";
import { contextErr } from "../domain/errors.js";
import { type ItemType, parseItemType } from "../domain/values/item-type.js";
import { parseProjectName } from "../domain/values/project-name.js";
import type { VaultSessionFactory } from "./ports/vault-session.js";
import type { SearchHit } from "./search-context.js";

export class ShowProject {
  constructor(private readonly sessions: VaultSessionFactory) {}

  execute(project: string, type?: string): Result<SearchHit[], DomainError> {
    const name = parseProjectName(project);
    if (!name.ok) return name;
    let typeValue: ItemType | undefined;
    if (type !== undefined) {
      const parsed = parseItemType(type);
      if (!parsed.ok) return parsed;
      typeValue = parsed.value;
    }
    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      const found = session.value.projects.findByName(name.value);
      if (found === null) {
        return contextErr("PROJECT_NOT_FOUND", `No project named "${name.value}".`);
      }
      const items = session.value.items.findByProject(
        found.id,
        typeValue === undefined ? {} : { type: typeValue },
      );
      return ok(
        items.map((item) => ({
          id: item.id,
          project: name.value as string,
          type: item.type,
          content: item.content,
          tags: [...item.tags],
          pinned: item.pinned,
          createdAt: item.createdAt.toISOString(),
        })),
      );
    } finally {
      session.value.close();
    }
  }
}
