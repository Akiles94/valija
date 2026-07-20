import { z } from "zod";
import { type DomainError, ok, type Result } from "../../../shared/domain/result.js";
import type {
  ConversationFailure,
  ConversationParser,
  ParsedExport,
} from "../../application/ports/parser.js";
import type { Conversation, Message, Role } from "../../domain/entities/conversation.js";
import { importerErr } from "../../domain/errors.js";

/**
 * Parses an official ChatGPT data export (`conversations.json`): an array of
 * conversations, each a `mapping` tree of nodes. We linearize the tree by
 * message `create_time` and keep user/assistant/system turns with text.
 */
const ChatgptMessage = z.object({
  author: z.object({ role: z.string().optional() }).nullish(),
  content: z.object({ parts: z.array(z.unknown()).optional() }).nullish(),
  create_time: z.number().nullish(),
});

const ChatgptConversation = z.object({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  title: z.string().optional(),
  create_time: z.number().nullish(),
  mapping: z.record(z.string(), z.object({ message: ChatgptMessage.nullish() })),
});

const HasMapping = z.object({ mapping: z.record(z.string(), z.unknown()) });

type ChatgptConversationData = z.infer<typeof ChatgptConversation>;

/** ChatGPT exports may be a bare array or a `{ conversations: [...] }` wrapper. */
function toArray(doc: unknown): unknown[] | null {
  if (Array.isArray(doc)) return doc;
  if (doc !== null && typeof doc === "object" && "conversations" in doc) {
    const inner = (doc as { conversations: unknown }).conversations;
    return Array.isArray(inner) ? inner : null;
  }
  return null;
}

function mapRole(role: string | null | undefined): Role | null {
  return role === "user" || role === "assistant" || role === "system" ? role : null;
}

function joinParts(parts: readonly unknown[] | null | undefined): string {
  if (!parts) return "";
  return parts.filter((part): part is string => typeof part === "string").join("\n");
}

function linearize(data: ChatgptConversationData, index: number): Conversation {
  const timed: { message: Message; time: number }[] = [];
  for (const node of Object.values(data.mapping)) {
    const raw = node.message;
    const role = mapRole(raw?.author?.role);
    if (raw === null || raw === undefined || role === null) continue;
    const text = joinParts(raw.content?.parts);
    if (text.trim().length === 0) continue;
    const time = typeof raw.create_time === "number" ? raw.create_time : 0;
    const message: Message = {
      role,
      content: text,
      ...(typeof raw.create_time === "number"
        ? { createdAt: new Date(raw.create_time * 1000) }
        : {}),
    };
    timed.push({ message, time });
  }
  timed.sort((a, b) => a.time - b.time);

  const firstTime = timed[0]?.time;
  const convTime = data.create_time ?? firstTime;
  return {
    id: data.id ?? data.conversation_id ?? `chatgpt-${index}`,
    title: data.title ?? "Untitled",
    createdAt: typeof convTime === "number" ? new Date(convTime * 1000) : new Date(0),
    messages: timed.map((entry) => entry.message),
  };
}

export class ChatgptParser implements ConversationParser {
  readonly source = "chatgpt" as const;

  detect(doc: unknown): boolean {
    const arr = toArray(doc);
    const first = arr?.[0];
    return first !== undefined && HasMapping.safeParse(first).success;
  }

  parse(doc: unknown): Result<ParsedExport, DomainError> {
    const arr = toArray(doc);
    if (arr === null) {
      return importerErr("MALFORMED_EXPORT", "Expected an array of ChatGPT conversations.");
    }
    const conversations: Conversation[] = [];
    const failures: ConversationFailure[] = [];
    for (const [index, raw] of arr.entries()) {
      const parsed = ChatgptConversation.safeParse(raw);
      if (!parsed.success) {
        failures.push({
          title: `Conversation ${index + 1}`,
          reason: parsed.error.issues[0]?.message ?? "invalid conversation shape",
        });
        continue;
      }
      conversations.push(linearize(parsed.data, index));
    }
    if (conversations.length === 0 && failures.length === 0) {
      return importerErr("EMPTY_EXPORT", "No conversations found in the ChatGPT export.");
    }
    return ok({ conversations, failures });
  }
}
