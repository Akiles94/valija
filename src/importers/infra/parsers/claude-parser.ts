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
 * Parses an official Claude data export: a top-level array of conversations,
 * each with `chat_messages`. A message's text is its `text` field, or the
 * joined `text` of its typed content blocks. `sender: "human"` maps to user.
 */
const ClaudeMessage = z.object({
  sender: z.string().optional(),
  text: z.string().optional(),
  content: z
    .array(z.object({ type: z.string().optional(), text: z.string().optional() }))
    .optional(),
  created_at: z.string().optional(),
});

const ClaudeConversation = z.object({
  uuid: z.string().optional(),
  name: z.string().optional(),
  created_at: z.string().optional(),
  chat_messages: z.array(ClaudeMessage),
});

const HasChatMessages = z.object({ chat_messages: z.array(z.unknown()) });

type ClaudeMessageData = z.infer<typeof ClaudeMessage>;

/** A valid Date from an ISO string, or null when absent/unparseable. */
function parseDate(iso: string | undefined): Date | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function messageText(message: ClaudeMessageData): string {
  if (message.text !== undefined && message.text.trim().length > 0) return message.text;
  if (message.content === undefined) return "";
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

export class ClaudeParser implements ConversationParser {
  readonly source = "claude" as const;

  detect(doc: unknown): boolean {
    const first = Array.isArray(doc) ? doc[0] : undefined;
    return first !== undefined && HasChatMessages.safeParse(first).success;
  }

  parse(doc: unknown): Result<ParsedExport, DomainError> {
    if (!Array.isArray(doc)) {
      return importerErr("MALFORMED_EXPORT", "Expected an array of Claude conversations.");
    }
    const conversations: Conversation[] = [];
    const failures: ConversationFailure[] = [];
    for (const [index, raw] of doc.entries()) {
      const parsed = ClaudeConversation.safeParse(raw);
      if (!parsed.success) {
        failures.push({
          title: `Conversation ${index + 1}`,
          reason: parsed.error.issues[0]?.message ?? "invalid conversation shape",
        });
        continue;
      }
      const messages: Message[] = [];
      for (const rawMessage of parsed.data.chat_messages) {
        const role = rawMessage.sender === "human" ? "user" : "assistant";
        const text = messageText(rawMessage);
        if (text.trim().length === 0) continue;
        const at = parseDate(rawMessage.created_at);
        messages.push({ role, content: text, ...(at === null ? {} : { createdAt: at }) });
      }
      const firstAt = messages[0]?.createdAt;
      const convAt = parseDate(parsed.data.created_at) ?? firstAt ?? new Date(0);
      conversations.push({
        id: parsed.data.uuid ?? `claude-${index}`,
        title: parsed.data.name ?? "Untitled",
        createdAt: convAt,
        messages,
      });
    }
    if (conversations.length === 0 && failures.length === 0) {
      return importerErr("EMPTY_EXPORT", "No conversations found in the Claude export.");
    }
    return ok({ conversations, failures });
  }
}
