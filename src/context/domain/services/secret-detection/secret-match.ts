import type { SecretKind } from "../../values/secret-finding.js";

/**
 * A finding plus its column span on `firstLine`; used only to apply tier
 * precedence and never leaves this folder. Like `SecretFinding`, it has no
 * field that could hold matched text.
 */
export interface SecretMatch {
  readonly kind: SecretKind;
  readonly firstLine: number;
  readonly lastLine: number;
  readonly start: number;
  readonly end: number;
}

/** `end` for a match that covers its lines entirely (multi-line blocks). */
export const WHOLE_LINE = Number.MAX_SAFE_INTEGER;

/** The detection tier of a kind: 1 known formats, 2 credential assignments, 3 random-looking strings. */
export const tierOf = (kind: SecretKind): 1 | 2 | 3 =>
  kind === "credential-assignment" ? 2 : kind === "high-entropy-string" ? 3 : 1;
