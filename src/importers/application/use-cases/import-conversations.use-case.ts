import type {
  ImportedItemInput,
  ImportItemsInput,
  ImportItemsOutput,
} from "../../../context/application/use-cases/import-items.use-case.js";
import type { Clock } from "../../../shared/application/ports/clock.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type { Conversation } from "../../domain/entities/conversation.js";
import { importerErr } from "../../domain/errors.js";
import { renderConversationChunks } from "../../domain/services/chunk-render.js";
import { selectConversations } from "../../domain/services/selection.js";
import type { ImportSource } from "../../domain/values/import-source.js";
import type { ExportReader } from "../ports/export-reader.js";
import type { ConversationParser } from "../ports/parser.js";
import type { ParserRegistry } from "../ports/parser-registry.js";

export interface ImportConversationsInput {
  filePath: string;
  projectName?: string;
  from?: ImportSource;
  list?: boolean;
  pick?: string;
  query?: string;
  since?: string;
  all?: boolean;
  dryRun?: boolean;
}

export interface ListingRow {
  index: number;
  title: string;
  date: string;
  messageCount: number;
  estimatedChunks: number;
}

export interface ImportFailure {
  conversation: string;
  reason: string;
}

export type ImportMode = "list" | "dry-run" | "import";

export interface ImportConversationsOutput {
  mode: ImportMode;
  source: ImportSource;
  project?: string;
  listing?: ListingRow[];
  imported: number;
  /** Conversations that contributed at least one item. */
  conversations: number;
  skipped: number;
  failed: number;
  failures: ImportFailure[];
}

/**
 * Orchestrates an import: read the file, resolve a parser, parse to the
 * normalized IR, select, chunk, and (unless listing or dry-running) hand the
 * chunks to context's ImportItems for the single-session write. It never touches
 * the vault directly — the whole write path lives behind the injected use case.
 */
export class ImportConversations
  implements UseCase<ImportConversationsInput, ImportConversationsOutput>
{
  constructor(
    private readonly reader: ExportReader,
    private readonly registry: ParserRegistry,
    private readonly importItems: UseCase<ImportItemsInput, ImportItemsOutput>,
    private readonly clock: Clock,
  ) {}

  execute(input: ImportConversationsInput): Result<ImportConversationsOutput, DomainError> {
    const docs = this.reader.read(input.filePath);
    if (!docs.ok) return docs;

    const resolved = this.resolveParser(docs.value, input.from);
    if (!resolved.ok) return resolved;

    const parsed = resolved.value.parser.parse(resolved.value.doc);
    if (!parsed.ok) return parsed;

    const source = resolved.value.parser.source;
    const conversations = [...parsed.value.conversations].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const parseFailures: ImportFailure[] = parsed.value.failures.map((failure) => ({
      conversation: failure.title,
      reason: failure.reason,
    }));

    const mode = this.resolveMode(input);
    if (mode === "list") {
      return ok(
        this.summary(mode, source, input, parseFailures, {
          listing: this.toListing(conversations, source),
        }),
      );
    }

    const selected = selectConversations(conversations, {
      ...(input.all === undefined ? {} : { all: input.all }),
      ...(input.pick === undefined ? {} : { pick: input.pick }),
      ...(input.query === undefined ? {} : { query: input.query }),
      ...(input.since === undefined ? {} : { since: input.since }),
    });
    if (!selected.ok) return selected;

    const { items, skipped, contributed } = this.buildItems(selected.value, source);
    if (mode === "dry-run") {
      return ok(
        this.summary(mode, source, input, parseFailures, {
          imported: items.length,
          conversations: contributed,
          skipped,
        }),
      );
    }

    const written = this.importItems.execute({ projectName: input.projectName ?? "", items });
    if (!written.ok) return written;
    const importFailures: ImportFailure[] = written.value.failures.map((failure) => ({
      conversation: failure.conversationId,
      reason: failure.reason,
    }));
    return ok(
      this.summary(mode, source, input, [...parseFailures, ...importFailures], {
        imported: written.value.imported,
        conversations: contributed,
        skipped,
      }),
    );
  }

  /** With `--from`, use that parser and surface its parse error verbatim; otherwise first `detect()` wins. */
  private resolveParser(
    docs: readonly unknown[],
    from: ImportSource | undefined,
  ): Result<{ parser: ConversationParser; doc: unknown }, DomainError> {
    if (from !== undefined) {
      const parser = this.registry.forSource(from);
      const doc = docs.find((candidate) => parser.detect(candidate)) ?? docs[0];
      if (doc === undefined) return importerErr("EMPTY_EXPORT", "The export was empty.");
      return ok({ parser, doc });
    }
    for (const parser of this.registry.autodetect) {
      const doc = docs.find((candidate) => parser.detect(candidate));
      if (doc !== undefined) return ok({ parser, doc });
    }
    return importerErr(
      "UNSUPPORTED_SOURCE",
      "Could not detect the export format. Pass --from chatgpt, claude, or generic.",
    );
  }

  /** No selection flag (or an explicit --list) lists; otherwise --dry-run previews, else import. */
  private resolveMode(input: ImportConversationsInput): ImportMode {
    const hasSelection =
      input.all === true ||
      input.pick !== undefined ||
      input.query !== undefined ||
      input.since !== undefined;
    if (input.list === true || !hasSelection) return "list";
    return input.dryRun === true ? "dry-run" : "import";
  }

  private toListing(conversations: readonly Conversation[], source: ImportSource): ListingRow[] {
    return conversations.map((conversation, index) => ({
      index: index + 1,
      title: conversation.title,
      date: conversation.createdAt.toISOString().slice(0, 10),
      messageCount: conversation.messages.length,
      estimatedChunks: renderConversationChunks(conversation, source).length,
    }));
  }

  private buildItems(
    conversations: readonly Conversation[],
    source: ImportSource,
  ): { items: ImportedItemInput[]; skipped: number; contributed: number } {
    const now = this.clock.now();
    const items: ImportedItemInput[] = [];
    let skipped = 0;
    let contributed = 0;
    for (const conversation of conversations) {
      const chunks = renderConversationChunks(conversation, source);
      if (chunks.length === 0) {
        skipped += 1;
        continue;
      }
      contributed += 1;
      // A conversation with no derivable date carries the epoch sentinel; stamp the import instant instead.
      const createdAt = conversation.createdAt.getTime() === 0 ? now : conversation.createdAt;
      chunks.forEach((content, chunkIndex) => {
        items.push({
          source,
          conversationId: conversation.id,
          chunkIndex,
          content,
          createdAt,
          tags: ["imported", source],
        });
      });
    }
    return { items, skipped, contributed };
  }

  private summary(
    mode: ImportMode,
    source: ImportSource,
    input: ImportConversationsInput,
    failures: ImportFailure[],
    counts: { imported?: number; conversations?: number; skipped?: number; listing?: ListingRow[] },
  ): ImportConversationsOutput {
    return {
      mode,
      source,
      ...(input.projectName === undefined ? {} : { project: input.projectName }),
      ...(counts.listing === undefined ? {} : { listing: counts.listing }),
      imported: counts.imported ?? 0,
      conversations: counts.conversations ?? 0,
      skipped: counts.skipped ?? 0,
      failed: failures.length,
      failures,
    };
  }
}
