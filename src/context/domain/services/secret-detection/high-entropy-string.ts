import { isPlaceholder } from "./placeholder.js";
import type { SecretMatch } from "./secret-match.js";

/**
 * The §8.3 thresholds. Changing one is a code change documented in
 * specs/context.md, never a setting (D-G), and only while both corpora and the
 * whole-document negatives stay green.
 */
export const MIN_TOKEN_LENGTH = 32;
export const MAX_TOKEN_LENGTH = 200;
export const MIN_ENTROPY_BITS = 4.3;

/** Maximal runs of base64 / base64url characters: one linear, non-backtracking scan. */
const TOKEN = /[A-Za-z0-9+/=_-]+/g;

const HEX_LIKE = /^(?:[a-z]{1,8}[-_])?[0-9a-fA-F]+$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UUID_EMBEDDED =
  /(?:^|[-_])[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:$|[-_])/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const SRI_PREFIXES = ["sha256-", "sha384-", "sha512-"];
const DATA_URI_BEFORE = /data:[^\s,]{1,200};base64,$/;
const HASH_CONTEXT =
  /\b(?:sha1?|sha256|sha512|md5|hash|digest|checksum|integrity|etag|commit|fingerprint)\b/i;
const URL_SPAN = /\b[a-z][a-z0-9+.-]{0,30}:\/\/\S{0,4096}/gi;
/** The algorithm name that opens an OpenSSH public key (`ssh-ed25519 AAAA…`). */
const SSH_PUBLIC_KEY_BEFORE =
  /(?:^|\s)(?:ssh-(?:ed25519|rsa|dss)|ecdsa-sha2-nistp(?:256|384|521)|sk-(?:ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com)\s+$/;
/** Armored blocks that hold public material only: certificates, public keys, signatures. */
const PUBLIC_BLOCK_HEADER =
  /-----BEGIN (?:CERTIFICATE|TRUSTED CERTIFICATE|CERTIFICATE REQUEST|NEW CERTIFICATE REQUEST|X509 CRL|PUBLIC KEY|RSA PUBLIC KEY|PGP PUBLIC KEY BLOCK|PGP SIGNATURE|SSH2 PUBLIC KEY)-----/;
const BLOCK_FOOTER = /-----END [A-Z0-9 ]{1,64}-----/;
/** A line that can sit inside an armored block: base64, blank, or a `Key: value` armor header. */
const BLOCK_BODY_LINE = /^(?:[A-Za-z0-9+/=]{0,4096}|[A-Za-z-]{1,64}: .{0,4096})$/;

/** Facts about a line that several exclusions share, computed at most once. */
class LineContext {
  private hashWordEndCache: number | null | undefined;
  private urlSpansCache: Array<readonly [number, number]> | undefined;

  constructor(readonly text: string) {}

  /** Where the first hash word on the line ends, or null when there is none. */
  get hashWordEnd(): number | null {
    if (this.hashWordEndCache === undefined) {
      const match = HASH_CONTEXT.exec(this.text);
      this.hashWordEndCache = match === null ? null : match.index + match[0].length;
    }
    return this.hashWordEndCache;
  }

  get urlSpans(): Array<readonly [number, number]> {
    this.urlSpansCache ??= [...this.text.matchAll(URL_SPAN)].map(
      (match) => [match.index, match.index + match[0].length] as const,
    );
    return this.urlSpansCache;
  }
}

/** Tier 3 (§8.3): a long, mixed, random-looking token that no exclusion explains. */
export function findHighEntropyStrings(lines: readonly string[]): SecretMatch[] {
  const publicLines = publicBlockLines(lines);
  return lines.flatMap((text, index) => {
    if (publicLines.has(index)) return [];
    const line = new LineContext(text);
    return [...text.matchAll(TOKEN)]
      .filter((match) => looksRandom(match[0]) && !isExplained(match[0], line, match.index))
      .map((match) => ({
        kind: "high-entropy-string" as const,
        firstLine: index + 1,
        lastLine: index + 1,
        start: match.index,
        end: match.index + match[0].length,
      }));
  });
}

/** Indexes of the lines inside certificate / public-key blocks, header through END. */
function publicBlockLines(lines: readonly string[]): Set<number> {
  const inside = new Set<number>();
  for (let index = 0; index < lines.length; index++) {
    if (!PUBLIC_BLOCK_HEADER.test(lines[index] ?? "")) continue;
    inside.add(index);
    while (index + 1 < lines.length) {
      const next = (lines[index + 1] ?? "").trim();
      if (!BLOCK_FOOTER.test(next) && !BLOCK_BODY_LINE.test(next)) break;
      inside.add(++index);
      if (BLOCK_FOOTER.test(next)) break;
    }
  }
  return inside;
}

/** Shannon entropy over the token's own character frequencies, in bits per character. */
export function shannonEntropy(token: string): number {
  const counts = new Map<string, number>();
  for (const character of token) counts.set(character, (counts.get(character) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / token.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

function looksRandom(token: string): boolean {
  if (!isCandidateLength(token)) return false;
  if (!hasCharacterMix(token)) return false;
  return shannonEntropy(token) >= MIN_ENTROPY_BITS;
}

const isCandidateLength = (token: string): boolean =>
  token.length >= MIN_TOKEN_LENGTH && token.length <= MAX_TOKEN_LENGTH;

/** At least 2 uppercase letters, 2 lowercase letters and 2 digits. */
function hasCharacterMix(token: string): boolean {
  return (
    countOf(token, /[A-Z]/g) >= 2 && countOf(token, /[a-z]/g) >= 2 && countOf(token, /[0-9]/g) >= 2
  );
}

const countOf = (token: string, pattern: RegExp): number => token.match(pattern)?.length ?? 0;

/** One check per §8.3 rule 4 exclusion. Tier 1/2 coverage is handled by precedence. */
function isExplained(token: string, line: LineContext, start: number): boolean {
  if (HEX_LIKE.test(token)) return true;
  if (isIdentifier(token)) return true;
  if (SRI_PREFIXES.some((prefix) => token.startsWith(prefix))) return true;
  const before = line.text.slice(Math.max(0, start - 256), start);
  if (DATA_URI_BEFORE.test(before)) return true;
  if (SSH_PUBLIC_KEY_BEFORE.test(before)) return true;
  if (line.hashWordEnd !== null && line.hashWordEnd <= start) return true;
  if (line.urlSpans.some(([from, to]) => start >= from && start < to)) return true;
  if (token.startsWith("/")) return true;
  if (isWordPath(token)) return true;
  return isPlaceholder(token);
}

/** A UUID or a ULID, as the whole token or as a `-`/`_`-delimited segment. */
function isIdentifier(token: string): boolean {
  if (UUID.test(token) || UUID_EMBEDDED.test(token)) return true;
  return token.split(/[-_]/).some((segment) => ULID.test(segment));
}

/** Two or more `/`, and no segment random-looking on its own (a path, not a key). */
function isWordPath(token: string): boolean {
  const segments = token.split("/");
  return segments.length >= 3 && !segments.some(hasCharacterMix);
}
