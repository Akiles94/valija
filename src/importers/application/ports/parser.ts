import type { DomainError, Result } from "../../../shared/domain/result.js";
import type { Conversation } from "../../domain/entities/conversation.js";
import type { ImportSource } from "../../domain/values/import-source.js";

/** One conversation that could not be parsed — collected, never fatal to the run. */
export interface ConversationFailure {
  readonly title: string;
  readonly reason: string;
}

export interface ParsedExport {
  readonly conversations: Conversation[];
  readonly failures: ConversationFailure[];
}

/**
 * A provider-export parser. `detect` recognizes an already-decoded JSON document
 * by its structure (robust to renamed files); `parse` converts it to the
 * normalized IR. Whole-document problems return `err`; per-conversation problems
 * go into `failures`.
 */
export interface ConversationParser {
  readonly source: ImportSource;
  detect(doc: unknown): boolean;
  parse(doc: unknown): Result<ParsedExport, DomainError>;
}
