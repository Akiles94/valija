import type { ConversationParser } from "../application/ports/parser.js";
import type { ImportSource } from "../domain/values/import-source.js";
import { ChatgptParser } from "./parsers/chatgpt-parser.js";
import { ClaudeParser } from "./parsers/claude-parser.js";
import { GenericParser } from "./parsers/generic-parser.js";

const chatgpt = new ChatgptParser();
const claude = new ClaudeParser();
const generic = new GenericParser();

/**
 * The parsers auto-detection tries, in order — first `detect()` wins. `generic`
 * is deliberately excluded: a permissive envelope match could swallow a
 * malformed official export, so it is reachable only via an explicit `--from
 * generic`. Adding a provider later is one new file plus one line here.
 */
export const AUTODETECT_PARSERS: readonly ConversationParser[] = [chatgpt, claude];

const BY_SOURCE: Record<ImportSource, ConversationParser> = { chatgpt, claude, generic };

export function parserBySource(source: ImportSource): ConversationParser {
  return BY_SOURCE[source];
}
