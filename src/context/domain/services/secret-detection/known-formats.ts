import type { SecretKind } from "../../values/secret-finding.js";
import { isPlaceholder } from "./placeholder.js";
import { type SecretMatch, WHOLE_LINE } from "./secret-match.js";

interface FormatRule {
  readonly kind: SecretKind;
  readonly pattern: RegExp;
}

/**
 * Tier 1 single-line shapes. Every pattern is global, anchored on a literal
 * prefix and uses bounded quantifiers (ReDoS-safe); the minimums are the
 * "realistic length" that keeps prose mentions of a prefix silent.
 * Anthropic is listed before OpenAI; precedence also follows SECRET_KINDS.
 */
const FORMAT_RULES: readonly FormatRule[] = [
  { kind: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g },
  { kind: "github-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}/g },
  { kind: "anthropic-api-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{32,255}/g },
  { kind: "openai-api-key", pattern: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,255}/g },
  { kind: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,255}/g },
  { kind: "stripe-secret-key", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,255}/g },
  { kind: "stripe-secret-key", pattern: /\bsk_test_[A-Za-z0-9]{16,255}/g },
  { kind: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g },
  {
    kind: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,2048}/g,
  },
];

/** `scheme://user:password@` — the groups are inspected in memory, never stored. */
const URL_CREDENTIALS = /\b[a-z][a-z0-9+.-]{0,30}:\/\/([^\s/:@]{1,256}):([^\s/@]{1,256})@/gi;
/** Eight or more of one character in a row: a mask, not random key material. */
const MASK_RUN = /(.)\1{7}/;
const OBVIOUS_PASSWORDS = new Set(["password", "pass", "secret", "changeme"]);

const PRIVATE_KEY_HEADER =
  /-----BEGIN (?:(?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----/;
const PRIVATE_KEY_FOOTER = /-----END [A-Z ]{1,64}-----/;
/** A base64 body line of a PEM/OpenSSH/PGP block. */
const KEY_BODY_LINE = /^[A-Za-z0-9+/=]{32,4096}$/;
/** Same-line body after the header (a key pasted with escaped `\n`). */
const INLINE_KEY_BODY = /[A-Za-z0-9+/=]{32}/;
/** How far below a header the first body line may start (legacy PEM puts two headers and a blank line first). */
const BODY_SEARCH_LINES = 4;

/** Tier 1: provider formats and structural secrets. Each rule needs a realistic length or structure. */
export function findKnownFormats(lines: readonly string[]): SecretMatch[] {
  return [...findPrivateKeys(lines), ...lines.flatMap(findOnLine)];
}

function findOnLine(line: string, index: number): SecretMatch[] {
  const matches = FORMAT_RULES.flatMap((rule) =>
    [...line.matchAll(rule.pattern)]
      .filter((match) => !isPlaceholderToken(match[0]))
      .map((match) => singleLine(rule.kind, index, match.index, match[0].length)),
  );
  return [...matches, ...findUrlCredentials(line, index)];
}

/** A placeholder, or a mask after a real prefix (`sk_live_xxxxxxxx…`). */
function isPlaceholderToken(token: string): boolean {
  return isPlaceholder(token) || MASK_RUN.test(token);
}

function findUrlCredentials(line: string, index: number): SecretMatch[] {
  return [...line.matchAll(URL_CREDENTIALS)]
    .filter((match) => isRealPassword(match[2] ?? ""))
    .map((match) => singleLine("url-credentials", index, match.index, match[0].length));
}

function isRealPassword(password: string): boolean {
  if (OBVIOUS_PASSWORDS.has(password.toLowerCase())) return false;
  if (password.includes("*")) return false;
  return !isPlaceholder(password);
}

/** A private-key header followed by key material, spanning through its END line. */
function findPrivateKeys(lines: readonly string[]): SecretMatch[] {
  const found: SecretMatch[] = [];
  for (let header = 0; header < lines.length; header++) {
    const line = lines[header] ?? "";
    const at = line.search(PRIVATE_KEY_HEADER);
    if (at < 0) continue;
    const last = blockEnd(lines, header, line.slice(at));
    if (last === null) continue;
    found.push({
      kind: "private-key",
      firstLine: header + 1,
      lastLine: last + 1,
      start: 0,
      end: WHOLE_LINE,
    });
    header = last;
  }
  return found;
}

/** Index of the block's last line, or null when no key material follows the header. */
function blockEnd(lines: readonly string[], header: number, headerText: string): number | null {
  if (INLINE_KEY_BODY.test(headerText.replace(PRIVATE_KEY_HEADER, ""))) return header;
  const body = firstBodyLine(lines, header);
  if (body === null) return null;
  let last = body;
  for (let index = body + 1; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (PRIVATE_KEY_FOOTER.test(line)) return index;
    if (!/^[A-Za-z0-9+/=]{1,4096}$/.test(line.trim())) break;
    last = index;
  }
  return last;
}

function firstBodyLine(lines: readonly string[], header: number): number | null {
  const limit = Math.min(lines.length - 1, header + BODY_SEARCH_LINES);
  for (let index = header + 1; index <= limit; index++) {
    if (KEY_BODY_LINE.test((lines[index] ?? "").trim())) return index;
  }
  return null;
}

function singleLine(kind: SecretKind, index: number, start: number, length: number): SecretMatch {
  return { kind, firstLine: index + 1, lastLine: index + 1, start, end: start + length };
}
