import type { Conversation, Message, Role } from "../entities/conversation.js";
import type { ImportSource } from "../values/import-source.js";

/**
 * Turn one normalized conversation into one-or-more markdown item bodies, each
 * sized to land safely inside the vault's content limit (32 KB UTF-8). The 28 KB
 * budget is deliberate headroom so the provenance header and markdown never push
 * a chunk over. Pure and deterministic — no vault, no fflate, no I/O.
 */
const DEFAULT_BYTE_BUDGET = 28 * 1024;
const HEADER_RESERVE = 768;
const SEPARATOR = "\n\n";
const MAX_TITLE_CHARS = 120;

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;

const ROLE_LABEL: Record<Role, string> = { user: "User", assistant: "Assistant", system: "System" };
const SOURCE_LABEL: Record<ImportSource, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  generic: "Generic",
};

const renderMessage = (message: Message): string =>
  `**${ROLE_LABEL[message.role]}:** ${message.content}`;

/** Split one string at codepoint boundaries so no piece exceeds `limit` bytes and UTF-8 is never cut mid-sequence. */
function hardSplit(text: string, limit: number): string[] {
  const pieces: string[] = [];
  let buffer = "";
  let bufferBytes = 0;
  for (const char of text) {
    const charBytes = byteLength(char);
    if (bufferBytes + charBytes > limit && buffer.length > 0) {
      pieces.push(buffer);
      buffer = "";
      bufferBytes = 0;
    }
    buffer += char;
    bufferBytes += charBytes;
  }
  if (buffer.length > 0) pieces.push(buffer);
  return pieces;
}

/** Greedily pack rendered messages into bodies that each fit within `limit` bytes, splitting on message boundaries first. */
function packBodies(messages: readonly Message[], limit: number): string[] {
  const bodies: string[] = [];
  let current: string[] = [];
  let currentBytes = 0;

  const flush = (): void => {
    if (current.length > 0) {
      bodies.push(current.join(SEPARATOR));
      current = [];
      currentBytes = 0;
    }
  };

  for (const message of messages) {
    const block = renderMessage(message);
    const blockBytes = byteLength(block);

    if (blockBytes > limit) {
      flush();
      for (const piece of hardSplit(block, limit)) bodies.push(piece);
      continue;
    }

    const cost = (current.length > 0 ? byteLength(SEPARATOR) : 0) + blockBytes;
    if (currentBytes + cost > limit) flush();
    current.push(block);
    currentBytes += current.length > 1 ? byteLength(SEPARATOR) + blockBytes : blockBytes;
  }
  flush();
  return bodies;
}

function provenanceHeader(
  conversation: Conversation,
  source: ImportSource,
  part: number,
  total: number,
): string {
  const title =
    conversation.title.length > MAX_TITLE_CHARS
      ? `${conversation.title.slice(0, MAX_TITLE_CHARS - 3)}...`
      : conversation.title;
  const date = conversation.createdAt.toISOString().slice(0, 10);
  return `> Imported from ${SOURCE_LABEL[source]} · "${title}" · ${date} · part ${part}/${total}`;
}

export function renderConversationChunks(
  conversation: Conversation,
  source: ImportSource,
  byteBudget: number = DEFAULT_BYTE_BUDGET,
): string[] {
  const limit = byteBudget - HEADER_RESERVE;
  const bodies = packBodies(conversation.messages, limit);
  const total = bodies.length;
  return bodies.map(
    (body, index) => `${provenanceHeader(conversation, source, index + 1, total)}\n\n${body}`,
  );
}
