import { z } from "zod";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type {
  ConversationFailure,
  ConversationParser,
  ParsedExport,
} from "../../application/ports/parser.js";
import type { Conversation, Message } from "../../domain/entities/conversation.js";
import { importerErr } from "../../domain/errors.js";

/**
 * Parses valija's own generic import envelope — the universal escape hatch for
 * any provider without a dedicated parser. Versioned so it can evolve loudly:
 * an unknown version is rejected, never mis-read. Never auto-selected; reachable
 * only via an explicit `--from generic`.
 */
export const GENERIC_IMPORT_VERSION = 1;

const GenericMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string().optional(),
});

const GenericConversation = z.object({
  id: z.string(),
  title: z.string().optional(),
  createdAt: z.string(),
  messages: z.array(GenericMessage),
});

const GenericEnvelope = z.object({
  valija_import_version: z.number(),
  conversations: z.array(z.unknown()),
});

function parseDate(iso: string | undefined): Date | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export class GenericParser implements ConversationParser {
  readonly source = "generic" as const;

  detect(doc: unknown): boolean {
    return (
      doc !== null &&
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      "valija_import_version" in doc
    );
  }

  parse(doc: unknown): Result<ParsedExport, DomainError> {
    const envelope = GenericEnvelope.safeParse(doc);
    if (!envelope.success) {
      return importerErr("MALFORMED_EXPORT", "Not a valija generic import envelope.");
    }
    if (envelope.data.valija_import_version !== GENERIC_IMPORT_VERSION) {
      return importerErr(
        "UNSUPPORTED_GENERIC_VERSION",
        `Unsupported generic import version ${envelope.data.valija_import_version}; this valija supports version ${GENERIC_IMPORT_VERSION}.`,
      );
    }

    const conversations: Conversation[] = [];
    const failures: ConversationFailure[] = [];
    for (const [index, raw] of envelope.data.conversations.entries()) {
      const parsed = GenericConversation.safeParse(raw);
      if (!parsed.success) {
        failures.push({
          title: `Conversation ${index + 1}`,
          reason: parsed.error.issues[0]?.message ?? "invalid conversation shape",
        });
        continue;
      }
      const createdAt = parseDate(parsed.data.createdAt);
      if (createdAt === null) {
        failures.push({
          title: parsed.data.title ?? parsed.data.id,
          reason: `Invalid createdAt: "${parsed.data.createdAt}"`,
        });
        continue;
      }
      const messages: Message[] = parsed.data.messages.map((message) => {
        const at = parseDate(message.createdAt);
        return {
          role: message.role,
          content: message.content,
          ...(at === null ? {} : { createdAt: at }),
        };
      });
      conversations.push({
        id: parsed.data.id,
        title: parsed.data.title ?? "Untitled",
        createdAt,
        messages,
      });
    }
    if (conversations.length === 0 && failures.length === 0) {
      return importerErr("EMPTY_EXPORT", "No conversations found in the generic export.");
    }
    return ok({ conversations, failures });
  }
}
