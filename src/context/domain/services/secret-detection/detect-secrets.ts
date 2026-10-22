import {
  compareFindings,
  type SecretFinding,
  secretKindRank,
} from "../../values/secret-finding.js";
import { findCredentialAssignments } from "./credential-assignment.js";
import { findKnownFormats } from "./known-formats.js";
import { type SecretMatch, tierOf, WHOLE_LINE } from "./secret-match.js";

/**
 * Every possible secret in `text`: one finding per span, highest tier wins,
 * kind + lines only. Pure and runtime-agnostic, so the desktop renderer can
 * bundle it.
 */
export function detectSecrets(text: string): SecretFinding[] {
  const lines = text.split(/\r?\n/);
  const matches = [...findKnownFormats(lines), ...findCredentialAssignments(lines)];
  const byLine = indexByLine(matches);
  const kept = matches.filter((match) => !isOutranked(match, byLine));
  return uniqueFindings(kept.map(toFinding));
}

/** Every match, filed under each line it covers, so precedence only compares neighbours. */
function indexByLine(matches: readonly SecretMatch[]): Map<number, SecretMatch[]> {
  const byLine = new Map<number, SecretMatch[]>();
  for (const match of matches) {
    for (let line = match.firstLine; line <= match.lastLine; line++) {
      const bucket = byLine.get(line) ?? [];
      bucket.push(match);
      byLine.set(line, bucket);
    }
  }
  return byLine;
}

/** Another match of higher precedence covers the same span. */
function isOutranked(match: SecretMatch, byLine: Map<number, SecretMatch[]>): boolean {
  for (let line = match.firstLine; line <= match.lastLine; line++) {
    const neighbours = byLine.get(line) ?? [];
    if (neighbours.some((other) => outranks(other, match) && overlaps(other, match))) return true;
  }
  return false;
}

function outranks(other: SecretMatch, match: SecretMatch): boolean {
  const tierGap = tierOf(other.kind) - tierOf(match.kind);
  if (tierGap !== 0) return tierGap < 0;
  return secretKindRank(other.kind) < secretKindRank(match.kind);
}

function overlaps(a: SecretMatch, b: SecretMatch): boolean {
  if (a.end === WHOLE_LINE || b.end === WHOLE_LINE) return true;
  return a.start < b.end && b.start < a.end;
}

function toFinding(match: SecretMatch): SecretFinding {
  return { kind: match.kind, firstLine: match.firstLine, lastLine: match.lastLine };
}

function uniqueFindings(findings: readonly SecretFinding[]): SecretFinding[] {
  const seen = new Map<string, SecretFinding>();
  for (const finding of findings) {
    seen.set(`${finding.kind}:${finding.firstLine}:${finding.lastLine}`, finding);
  }
  return [...seen.values()].sort(compareFindings);
}
