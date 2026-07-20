import type { ParserRegistry } from "../application/ports/parser-registry.js";
import type { ConversationParser } from "../application/ports/parser.js";
import type { ImportSource } from "../domain/values/import-source.js";
import { ChatgptParser } from "./parsers/chatgpt-parser.js";
import { ClaudeParser } from "./parsers/claude-parser.js";
import { GenericParser } from "./parsers/generic-parser.js";

const chatgpt = new ChatgptParser();
const claude = new ClaudeParser();
const generic = new GenericParser();

const BY_SOURCE: Record<ImportSource, ConversationParser> = { chatgpt, claude, generic };

/**
 * The concrete parser registry. `generic` is deliberately absent from
 * `autodetect`: a permissive envelope match could swallow a malformed official
 * export, so it is reachable only via an explicit `--from generic`. Adding a
 * provider later is one new file plus one line here.
 */
export const parserRegistry: ParserRegistry = {
  autodetect: [chatgpt, claude],
  forSource: (source) => BY_SOURCE[source],
};
