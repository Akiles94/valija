/**
 * Closed and ordered by precedence: tier 1 (known formats), then tier 2
 * (credential assignments), then tier 3 (random-looking strings). The order is
 * also the tie-break inside tier 1 (Anthropic before OpenAI).
 */
export const SECRET_KINDS = [
  "private-key",
  "aws-access-key",
  "github-token",
  "anthropic-api-key",
  "openai-api-key",
  "slack-token",
  "stripe-secret-key",
  "google-api-key",
  "jwt",
  "url-credentials",
  "credential-assignment",
  "high-entropy-string",
] as const;

export type SecretKind = (typeof SECRET_KINDS)[number];

/**
 * WHERE a possible secret is, never WHAT it is: by design there is no field
 * that could hold matched text (SECRET-WARN D-H).
 */
export interface SecretFinding {
  readonly kind: SecretKind;
  /** 1-based. */
  readonly firstLine: number;
  /** Equal to `firstLine` except for multi-line blocks (private keys). */
  readonly lastLine: number;
}

/** English, mid-sentence (CLI and MCP). Product names keep their case. */
export const SECRET_KIND_LABELS: Record<SecretKind, string> = {
  "private-key": "private key",
  "aws-access-key": "AWS access key",
  "github-token": "GitHub token",
  "anthropic-api-key": "Anthropic API key",
  "openai-api-key": "OpenAI API key",
  "slack-token": "Slack token",
  "stripe-secret-key": "Stripe secret key",
  "google-api-key": "Google API key",
  jwt: "JSON Web Token",
  "url-credentials": "credentials in a URL",
  "credential-assignment": "credential assignment",
  "high-entropy-string": "high-entropy string",
};

export const isSecretKind = (value: string): value is SecretKind =>
  (SECRET_KINDS as readonly string[]).includes(value);

/** Position of a kind in the precedence order (lower wins). */
export const secretKindRank = (kind: SecretKind): number => SECRET_KINDS.indexOf(kind);

/** Orders findings by line, then by kind precedence. */
export const compareFindings = (a: SecretFinding, b: SecretFinding): number =>
  a.firstLine - b.firstLine || secretKindRank(a.kind) - secretKindRank(b.kind);

/**
 * "GitHub token (line 7), private key (lines 12–40)", capped: "…, and 3 more"
 * (D-H). Called only with a non-empty list.
 */
export function describeFindings(findings: readonly SecretFinding[], cap = 5): string {
  const sorted = [...findings].sort(compareFindings);
  const shown = sorted.slice(0, cap).map(describeFinding).join(", ");
  const hidden = sorted.length - Math.min(cap, sorted.length);
  return hidden > 0 ? `${shown}, and ${hidden} more` : shown;
}

function describeFinding(finding: SecretFinding): string {
  const where =
    finding.firstLine === finding.lastLine
      ? `line ${finding.firstLine}`
      : `lines ${finding.firstLine}–${finding.lastLine}`;
  return `${SECRET_KIND_LABELS[finding.kind]} (${where})`;
}
