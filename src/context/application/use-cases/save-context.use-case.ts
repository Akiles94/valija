import type { Clock, IdGenerator } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { type ContextItem, createContextItem } from "../../domain/entities/context-item.js";
import type { Project } from "../../domain/entities/project.js";
import { contextErr } from "../../domain/errors.js";
import { archiveSuperseded } from "../../domain/services/item-curation.js";
import { type Content, parseContent } from "../../domain/values/content.js";
import { type ItemId, parseItemId } from "../../domain/values/item-id.js";
import { type ItemType, parseItemType } from "../../domain/values/item-type.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { parseTags, type Tag } from "../../domain/values/tag.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";

/** What to remember: project, content, and optionally type, tags, pin and source. */
export interface SaveContextInput {
  project: string;
  content: string;
  type?: string;
  tags?: string[];
  pinned?: boolean;
  source?: string;
  /** The exact id of ONE live item in the same project that this save replaces; it is archived. */
  supersedes?: string;
}

/** The stored item's id and type, and whether its project was created on the fly. */
export interface SaveContextOutput {
  itemId: string;
  project: string;
  type: ItemType;
  projectCreated: boolean;
  /** Present only when `supersedes` was used. */
  supersededItemId?: string;
}

interface ValidatedSave {
  name: ProjectName;
  type: ItemType;
  tags: Tag[];
  content: Content;
  pinned: boolean;
  source?: string;
  supersedes?: ItemId;
}

/**
 * Stores one piece of context (a decision, progress note, preference, fact or handoff) in a
 * project, creating the project when it does not exist yet.
 */
export class SaveContext implements UseCase<SaveContextInput, SaveContextOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  execute(input: SaveContextInput): Result<SaveContextOutput, DomainError> {
    const validated = this.parseInput(input);
    if (!validated.ok) return validated;

    const v = validated.value;
    return this.sessions.withSession((session) =>
      session.write(() => {
        const now = this.clock.now();
        const { project, created } = this.findOrCreateProject(session, v.name);
        // Check the superseded target first: a refusal rolls the whole write back, project creation included.
        const retired = this.retireSuperseded(session, project, v.supersedes, now);
        if (!retired.ok) return retired;
        const item = createContextItem({
          id: this.idGen.next(),
          projectId: project.id,
          type: v.type,
          content: v.content,
          tags: v.tags,
          pinned: v.pinned,
          ...(v.source === undefined ? {} : { source: v.source }),
          now,
        });
        session.items.save(item);
        if (retired.value !== null) session.items.save(retired.value);
        return ok({
          itemId: item.id,
          project: v.name as string,
          type: v.type,
          projectCreated: created,
          ...(retired.value === null ? {} : { supersededItemId: retired.value.id }),
        });
      }),
    );
  }

  /** The same message for "missing" and "in another project", so nothing leaks about other projects. */
  private retireSuperseded(
    session: VaultSession,
    project: Project,
    id: ItemId | undefined,
    now: Date,
  ): Result<ContextItem | null, DomainError> {
    if (id === undefined) return ok(null);
    const found = session.items.findById(id);
    if (found === null || found.item.projectId !== project.id) {
      return contextErr("ITEM_NOT_FOUND", `No item ${id} in project "${project.name}".`);
    }
    return archiveSuperseded(found.item, now);
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
    const supersedes = input.supersedes === undefined ? undefined : parseItemId(input.supersedes);
    if (supersedes !== undefined && !supersedes.ok) return supersedes;
    return ok({
      name: name.value,
      type: type.value,
      tags: tags.value,
      content: content.value,
      pinned: input.pinned ?? false,
      ...(input.source === undefined ? {} : { source: input.source }),
      ...(supersedes === undefined ? {} : { supersedes: supersedes.value }),
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
