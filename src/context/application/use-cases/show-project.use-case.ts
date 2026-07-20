import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { contextErr } from "../../domain/errors.js";
import { parseStorableItemType, type StorableItemType } from "../../domain/values/item-type.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { type ContextItemView, toContextItemView } from "../dto/context-item-view.js";
import type { VaultSessions } from "../ports/vault-session.js";

export interface ShowProjectInput {
  project: string;
  type?: string;
}

interface ShowFilters {
  name: ProjectName;
  type?: StorableItemType;
}

export class ShowProject implements UseCase<ShowProjectInput, ContextItemView[]> {
  constructor(private readonly sessions: VaultSessions) {}

  execute(input: ShowProjectInput): Result<ContextItemView[], DomainError> {
    const filters = this.parseFilters(input);
    if (!filters.ok) return filters;

    return this.sessions.withSession((session) => {
      const found = session.projects.findByName(filters.value.name);
      if (found === null) {
        return contextErr("PROJECT_NOT_FOUND", `No project named "${filters.value.name}".`);
      }
      const items = session.items.findByProject(
        found.id,
        filters.value.type === undefined ? {} : { type: filters.value.type },
      );
      return ok(items.map((item) => toContextItemView(item, filters.value.name)));
    });
  }

  private parseFilters(input: ShowProjectInput): Result<ShowFilters, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;
    if (input.type === undefined) return ok({ name: name.value });
    const parsed = parseStorableItemType(input.type);
    if (!parsed.ok) return parsed;
    return ok({ name: name.value, type: parsed.value });
  }
}
