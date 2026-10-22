import { describe, expect, it } from "vitest";
import {
  describeFindings,
  isSecretKind,
  SECRET_KIND_LABELS,
  SECRET_KINDS,
  type SecretFinding,
} from "./secret-finding.js";

const at = (
  kind: SecretFinding["kind"],
  firstLine: number,
  lastLine = firstLine,
): SecretFinding => ({
  kind,
  firstLine,
  lastLine,
});

describe("SECRET_KINDS", () => {
  it("is the closed 12-kind enum, each with an English label", () => {
    expect(SECRET_KINDS).toHaveLength(12);
    for (const kind of SECRET_KINDS) expect(SECRET_KIND_LABELS[kind]).toMatch(/\S/);
  });

  it("isSecretKind accepts every kind and rejects anything else", () => {
    for (const kind of SECRET_KINDS) expect(isSecretKind(kind)).toBe(true);
    expect(isSecretKind("password")).toBe(false);
  });
});

describe("describeFindings", () => {
  it("renders a single line and a line range (en dash)", () => {
    expect(describeFindings([at("github-token", 7), at("private-key", 12, 40)])).toBe(
      "GitHub token (line 7), private key (lines 12–40)",
    );
  });

  it("sorts by line, then by kind precedence", () => {
    expect(
      describeFindings([
        at("high-entropy-string", 5),
        at("credential-assignment", 2),
        at("jwt", 5),
      ]),
    ).toBe("credential assignment (line 2), JSON Web Token (line 5), high-entropy string (line 5)");
  });

  it("caps at 5 entries and counts the rest", () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((line) => at("aws-access-key", line));
    expect(describeFindings(seven)).toBe(
      "AWS access key (line 1), AWS access key (line 2), AWS access key (line 3), " +
        "AWS access key (line 4), AWS access key (line 5), and 2 more",
    );
  });

  it("is stable for equal lines and kinds, and honours a custom cap", () => {
    const findings = [at("slack-token", 3), at("slack-token", 3)];
    expect(describeFindings(findings, 1)).toBe("Slack token (line 3), and 1 more");
  });
});
