import type { Clock, IdGenerator } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { createContextItem } from "../../domain/entities/context-item.js";
import type { Project } from "../../domain/entities/project.js";
import { type Content, parseContent } from "../../domain/values/content.js";
import { type ItemType, parseItemType } from "../../domain/values/item-type.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { parseTags, type Tag } from "../../domain/values/tag.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";

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

interface ValidatedSave {
  name: ProjectName;
  type: ItemType;
  tags: Tag[];
  content: Content;
  pinned: boolean;
  source?: string;
}

export class SaveContext implements UseCase<SaveContextInput, SaveContextOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  execute(input: SaveContextInput): Result<SaveContextOutput, DomainError> {
    const validated = this.parseInput(input);
    if (!validated.ok) return validated;

    return this.sessions.withSession((session) => {
      const { project, created } = this.findOrCreateProject(session, validated.value.name);
      const item = createContextItem({
        id: this.idGen.next(),
        projectId: project.id,
        type: validated.value.type,
        content: validated.value.content,
        tags: validated.value.tags,
        pinned: validated.value.pinned,
        ...(validated.value.source === undefined ? {} : { source: validated.value.source }),
        now: this.clock.now(),
      });
      session.items.save(item);
      return ok({
        itemId: item.id,
        project: validated.value.name as string,
        type: validated.value.type,
        projectCreated: created,
      });
    });
  }

  /** Everything is parsed before a session is opened: bad input never touches the vault. */
  private parseInput(input: SaveContextInput): Result<ValidatedSave, DomainError> {
    const name = parseProjectName(input.project);
    if (!name.ok) return name;
    const type = parseItemType(input.type ?? "fact");
    if (!type.ok) return type;
    const tags = parseTags(input.tags ?? []);
    if (!tags.ok) return tags;
    const content = parseContent(input.content);
    if (!content.ok) return content;
    return ok({
      name: name.value,
      type: type.value,
      tags: tags.value,
      content: content.value,
      pinned: input.pinned ?? false,
      ...(input.source === undefined ? {} : { source: input.source }),
    });
  }

  private findOrCreateProject(
    session: VaultSession,
    name: ProjectName,
  ): { project: Project; created: boolean } {
    const existing = session.projects.findByName(name);
    if (existing !== null) return { project: existing, created: false };

    const now = this.clock.now();
    const project: Project = { id: this.idGen.next(), name, createdAt: now, updatedAt: now };
    session.projects.save(project);
    return { project, created: true };
  }
}
