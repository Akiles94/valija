import type { ImportSource } from "../../domain/values/import-source.js";
import type { ConversationParser } from "./parser.js";

/**
 * The set of parsers the import use case can reach, without it depending on the
 * concrete infra registry. `autodetect` is the ordered list tried when no source
 * is named (first `detect()` wins); `forSource` resolves an explicit `--from`,
 * including `generic`, which is never auto-selected.
 */
export interface ParserRegistry {
  readonly autodetect: readonly ConversationParser[];
  forSource(source: ImportSource): ConversationParser;
}
