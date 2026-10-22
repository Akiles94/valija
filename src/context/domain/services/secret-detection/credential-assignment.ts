import { isPlaceholder } from "./placeholder.js";
import type { SecretMatch } from "./secret-match.js";

/** `key <op> ` after a line start or a separator, optionally quoted, optionally after `export`. */
const KEY_AND_OPERATOR =
  /(?:^|[\s{,(;])(?:export\s{1,8})?["'`]?([A-Za-z0-9_.-]{1,64})["'`]?\s{0,8}(?::=|=>|=|:)\s{0,8}/g;

/** Normalized key endings that name a credential. `pwd` and `pass` are deliberately absent. */
const CREDENTIAL_KEY_ENDINGS = [
  "password",
  "passwd",
  "secret",
  "clientsecret",
  "secretkey",
  "apikey",
  "accesskey",
  "accesstoken",
  "authtoken",
  "refreshtoken",
  "token",
  "privatekey",
];

const QUOTES = new Set(['"', "'", "`"]);
const MAX_VALUE_LENGTH = 512;
const UNQUOTED_VALUE = /^[^\s,;}#]{1,512}/;
const VALUE_TERMINATORS = new Set([",", ";", "}", "#"]);
const NON_VALUES = new Set([
  "null",
  "none",
  "nil",
  "undefined",
  "true",
  "false",
  "string",
  "number",
]);
const DOTTED_PATH = /^[A-Za-z_$][\w$]{0,128}(?:\.[A-Za-z_$][\w$]{0,128}){1,16}$/;
const REFERENCE_PREFIXES = ["$", "env(", "secrets."];
const PATH_PREFIXES = ["/", "./", "~/"];

interface AssignedValue {
  readonly value: string;
  readonly quoted: boolean;
  readonly start: number;
  readonly end: number;
}

/**
 * Tier 2 (§8.2): `key <op> value` on one line, where the key names a
 * credential and the value looks real. The match spans the value's columns.
 */
export function findCredentialAssignments(lines: readonly string[]): SecretMatch[] {
  return lines.flatMap((line, index) =>
    [...line.matchAll(KEY_AND_OPERATOR)]
      .filter((match) => namesCredential(match[1] ?? ""))
      .map((match) => readValue(line, match.index + match[0].length))
      .filter((assigned): assigned is AssignedValue => assigned !== null)
      .filter((assigned) => looksLikeCredential(assigned.value, assigned.quoted))
      .map((assigned) => ({
        kind: "credential-assignment" as const,
        firstLine: index + 1,
        lastLine: index + 1,
        start: assigned.start,
        end: assigned.end,
      })),
  );
}

/** Lower-cased, `_` `-` `.` removed, and ending with a credential word. */
function namesCredential(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_.-]/g, "");
  return CREDENTIAL_KEY_ENDINGS.some((ending) => normalized.endsWith(ending));
}

/** The single value right after the operator, or null when more words follow it. */
function readValue(line: string, from: number): AssignedValue | null {
  const quote = line[from] ?? "";
  const assigned = QUOTES.has(quote) ? readQuoted(line, from, quote) : readUnquoted(line, from);
  if (assigned === null) return null;
  return endsTheStatement(line.slice(assigned.end + (assigned.quoted ? 1 : 0))) ? assigned : null;
}

function readQuoted(line: string, from: number, quote: string): AssignedValue | null {
  const window = line.slice(from + 1, from + 2 + MAX_VALUE_LENGTH);
  const close = window.indexOf(quote);
  if (close < 0) return null;
  const value = window.slice(0, close);
  if (/\s/.test(value)) return null;
  return { value, quoted: true, start: from + 1, end: from + 1 + close };
}

function readUnquoted(line: string, from: number): AssignedValue | null {
  const value = UNQUOTED_VALUE.exec(line.slice(from))?.[0];
  if (value === undefined) return null;
  return { value, quoted: false, start: from, end: from + value.length };
}

/** The tail rule: after the value, the line ends or continues with `,` `;` `}` `#`. */
function endsTheStatement(rest: string): boolean {
  const tail = rest.trimStart();
  return tail.length === 0 || VALUE_TERMINATORS.has(tail[0] ?? "");
}

/** The value looks like a credential, not code, a reference or prose. */
function looksLikeCredential(value: string, quoted: boolean): boolean {
  if (value.length < 8) return false;
  if (characterClasses(value) < 2 && value.length < 16) return false;
  if (isPlaceholder(value) || NON_VALUES.has(value.toLowerCase())) return false;
  if (value.includes("(") || value.includes(")")) return false;
  if (DOTTED_PATH.test(value)) return false;
  if (REFERENCE_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (!quoted && /^[A-Za-z_]+$/.test(value)) return false;
  return !PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** How many of {lowercase, uppercase, digit, symbol} the value uses. */
function characterClasses(value: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((cls) => cls.test(value)).length;
}
