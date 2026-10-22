import type { Clock, IdGenerator } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import { createImportedContextItem } from "../../domain/entities/context-item.js";
import type { Project } from "../../domain/entities/project.js";
import { setArchived } from "../../domain/services/item-curation.js";
import { refuseFlaggedImport } from "../../domain/services/secret-detection/secret-refusal.js";
import { parseContent } from "../../domain/values/content.js";
import { type ProjectName, parseProjectName } from "../../domain/values/project-name.js";
import { parseTags } from "../../domain/values/tag.js";
import type { VaultSession, VaultSessions } from "../ports/vault-session.js";

/** One imported chunk, ready to persist. `source` is a plain string so context owes nothing to importers. */
export interface ImportedItemInput {
  source: string;
  conversationId: string;
  chunkIndex: number;
  content: string;
  createdAt: Date;
  tags: string[];
}

/** The target project and the imported chunks to store in it. */
export interface ImportItemsInput {
  projectName: string;
  items: ImportedItemInput[];
  /** A human's explicit "import it anyway" (CLI --allow-secrets, desktop Import anyway). Never set by an AI tool. */
  allowSecrets?: boolean;
}

/** A chunk that could not be stored, and why. */
export interface ImportItemFailure {
  conversationId: string;
  reason: string;
}

/** How many chunks were stored or failed, and whether the project had to be created. */
export interface ImportItemsOutput {
  projectCreated: boolean;
  imported: number;
  failed: number;
  failures: ImportItemFailure[];
}

/**
 * Persist a batch of imported items in ONE session, auto-creating the target
 * project. Context stays the sole guardian of ContextItem and the `imported`
 * type; the importer only hands it drafts. Ids are deterministic, so re-running
 * an import upserts instead of duplicating — but never un-archives a chunk the
 * user archived (CURATION D-H). A single bad chunk is collected as a
 * failure, never aborting the batch. A flagged batch is refused whole, before
 * the session, unless `allowSecrets` (SECRET-WARN D-E, defense in depth).
 */
export class ImportItems implements UseCase<ImportItemsInput, ImportItemsOutput> {
  constructor(
    private readonly sessions: VaultSessions,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
  ) {}

  execute(input: ImportItemsInput): Result<ImportItemsOutput, DomainError> {
    const name = parseProjectName(input.projectName);
    if (!name.ok) return name;
    if (input.allowSecrets !== true) {
      const safe = refuseFlaggedImport(input.items.map((item) => item.content));
      if (!safe.ok) return safe;
    }

    return this.sessions.withSession((session) =>
      session.write(() => {
        const { project, created } = this.findOrCreateProject(session, name.value);
        const failures: ImportItemFailure[] = [];
        let imported = 0;
        for (const draft of input.items) {
          const saved = this.saveDraft(session, project.id, draft);
          if (saved.ok) imported += 1;
          else failures.push({ conversationId: draft.conversationId, reason: saved.error.message });
        }
        return ok({ projectCreated: created, imported, failed: failures.length, failures });
      }),
    );
  }

  /** Re-validate tags and content at the vault boundary — defense in depth, even though the renderer aims well under the limit. */
  private saveDraft(
    session: VaultSession,
    projectId: string,
    draft: ImportedItemInput,
  ): Result<void, DomainError> {
    const tags = parseTags(draft.tags);
    if (!tags.ok) return tags;
    const content = parseContent(draft.content);
    if (!content.ok) return content;

    const now = this.clock.now();
    const item = createImportedContextItem({
      projectId,
      source: draft.source,
      conversationId: draft.conversationId,
      chunkIndex: draft.chunkIndex,
      content: content.value,
      tags: tags.value,
      createdAt: draft.createdAt,
      now,
    });
    const keepArchived = session.items.findById(item.id)?.item.archived === true;
    session.items.save(keepArchived ? setArchived(item, true, now).item : item);
    return ok(undefined);
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
