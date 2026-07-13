import { validateContent } from "../../domain/entities/context-item.js";
import type { Project } from "../../domain/entities/project.js";
import { type DomainError, ok, type Result } from "../../domain/errors.js";
import type { Clock, IdGenerator } from "../../domain/ports/clock.js";
import type { VaultSessionFactory } from "../../domain/ports/vault-session.js";
import { type ItemType, parseItemType } from "../../domain/values/item-type.js";
import { parseProjectName } from "../../domain/values/project-name.js";
import { parseTags } from "../../domain/values/tag.js";

export interface SaveContextInput {
  project: string;
  content: string;
  type?: string;
  tags?: string[];
  pinned?: boolean;
  source?: string;
}

export interface SaveContextOutput {
  itemId: string;
  project: string;
  type: ItemType;
  projectCreated: boolean;
}

export class SaveContext {
  constructor(
    private readonly sessions: VaultSessionFactory,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  execute(input: SaveContextInput): Result<SaveContextOutput, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;
    const type = parseItemType(input.type ?? "fact");
    if (!type.ok) return type;
    const tags = parseTags(input.tags ?? []);
    if (!tags.ok) return tags;
    const content = validateContent(input.content);
    if (!content.ok) return content;

    const session = this.sessions.open();
    if (!session.ok) return session;
    try {
      const now = this.clock.now();
      let project = session.value.projects.findByName(name.value);
      const projectCreated = project === null;
      if (project === null) {
        project = {
          id: this.idGen.next(),
          name: name.value,
          createdAt: now,
          updatedAt: now,
        } satisfies Project;
        session.value.projects.save(project);
      }
      const itemId = this.idGen.next();
      session.value.items.save({
        id: itemId,
        projectId: project.id,
        type: type.value,
        content: content.value,
        tags: tags.value,
        pinned: input.pinned ?? false,
        ...(input.source === undefined ? {} : { source: input.source }),
        archived: false,
        createdAt: now,
        updatedAt: now,
      });
      return ok({ itemId, project: name.value, type: type.value, projectCreated });
    } finally {
      session.value.close();
    }
  }
}
