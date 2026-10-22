/**
 * Made-up secrets for tests (SECRET-WARN P-13). Every value is ASSEMBLED AT
 * RUNTIME from fragments, so no realistic token literal ever sits in the repo:
 * no push-protection or secret-scanner hits, and a "never echoed" sweep looks
 * for values this source file does not contain verbatim. None of them is, or
 * ever was, a real credential.
 */

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** A deterministic pseudo-random string (a tiny LCG), so fixtures are stable across runs. */
export function pseudoRandom(length: number, seed: number, alphabet = BASE64_ALPHABET): string {
  let state = seed >>> 0;
  let out = "";
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += alphabet[(state >>> 16) % alphabet.length];
  }
  return out;
}

export const pseudoRandomBase64Url = (length: number, seed: number): string =>
  pseudoRandom(length, seed, BASE64URL_ALPHABET);

const MIXED = ["Q7mZ2vK9pL4x", "R8tW1nB6cY3h", "J5gF0dS2aE7u"];

const privateKeyBlock = [
  ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
  pseudoRandom(64, 11),
  pseudoRandom(64, 12),
  pseudoRandom(24, 13),
  ["-----END", "PRIVATE KEY-----"].join(" "),
].join("\n");

export const PLANTED = {
  privateKey: privateKeyBlock,
  awsAccessKey: ["AK", "IA", "Q7MZ2VK9PL4XR8TW"].join(""),
  githubToken: ["gh", "p_", ...MIXED].join(""),
  anthropicApiKey: ["sk", "-ant-", "api03-", ...MIXED, "I9oP", "-Xw4"].join(""),
  openaiApiKey: ["sk", "-proj-", ...MIXED, "I9oP"].join(""),
  slackToken: ["xo", "xb-", "2847561093-7362514098-", MIXED[0], MIXED[1]].join(""),
  stripeSecretKey: ["sk", "_live_", MIXED[0], MIXED[1]].join(""),
  googleApiKey: ["AI", "za", "Sy", MIXED[0], MIXED[1], "J5gF0dS2a"].join(""),
  jwt: [
    ["ey", "JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"].join(""),
    ["ey", "JzdWIiOiIxMjM0NTY3ODkwIn0"].join(""),
    pseudoRandomBase64Url(43, 21),
  ].join("."),
  urlCredentials: ["postgres", "://", "admin", ":", "Zx81QpLm77Hb", "@db.internal:5432/app"].join(
    "",
  ),
  credentialAssignment: { line: "DB_PASSWORD=S3cr3t!Passw0rd", secret: "S3cr3t!Passw0rd" },
  highEntropy: [...MIXED, "I9oP"].join(""),
} as const;

/** Every planted single-line value, keyed by the kind it must be reported as. */
export const PLANTED_TIER_ONE = {
  "aws-access-key": PLANTED.awsAccessKey,
  "github-token": PLANTED.githubToken,
  "anthropic-api-key": PLANTED.anthropicApiKey,
  "openai-api-key": PLANTED.openaiApiKey,
  "slack-token": PLANTED.slackToken,
  "stripe-secret-key": PLANTED.stripeSecretKey,
  "google-api-key": PLANTED.googleApiKey,
  jwt: PLANTED.jwt,
  "url-credentials": PLANTED.urlCredentials,
} as const;

/** The three values every "never echoed" sweep looks for: one per tier (§10.1). */
export const ONE_PER_TIER = [
  PLANTED.awsAccessKey,
  PLANTED.credentialAssignment.secret,
  PLANTED.highEntropy,
] as const;

/** Every 6-character window of `secret`: a serialized output must contain none of them. */
export const fragmentsOf = (secret: string, width = 6): string[] =>
  Array.from({ length: Math.max(0, secret.length - width + 1) }, (_, i) =>
    secret.slice(i, i + width),
  );
