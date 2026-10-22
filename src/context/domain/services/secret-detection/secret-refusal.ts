import { type DomainError, ok, type Result } from "../../../../shared/domain/result.js";
import { contextErr } from "../../errors.js";
import { describeFindings } from "../../values/secret-finding.js";
import { detectSecrets } from "./detect-secrets.js";

/**
 * Refuse content that looks like it contains a secret (D-A). Callers that allow
 * a human override skip the call. The message is surface-neutral: each
 * delivery surface appends its own remedy (P-2). It names kinds and lines,
 * never matched text.
 */
export function refusePossibleSecrets(content: string): Result<void, DomainError> {
  const findings = detectSecrets(content);
  if (findings.length === 0) return ok(undefined);
  return contextErr(
    "POSSIBLE_SECRET",
    `The content looks like it contains a secret — ${describeFindings(findings)}. Nothing was saved.`,
  );
}

/** All-or-nothing (D-E): any flagged chunk refuses the whole batch. */
export function refuseFlaggedImport(contents: readonly string[]): Result<void, DomainError> {
  const flagged = contents.filter((content) => detectSecrets(content).length > 0).length;
  if (flagged === 0) return ok(undefined);
  return contextErr("POSSIBLE_SECRET", importRefusedMessage(flagged));
}

/** The surface-neutral message for an import refused because some chunks look like secrets. */
export const importRefusedMessage = (flaggedChunks: number): string =>
  `Import refused: ${flaggedChunks} chunk(s) look like they contain secrets. Nothing was imported.`;
