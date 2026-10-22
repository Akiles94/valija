import { describe, expect, it } from "vitest";
import { PLANTED, PLANTED_TIER_ONE, pseudoRandom } from "../../../../testing/fake-secrets.js";
import { findKnownFormats } from "./known-formats.js";

const kindsIn = (text: string) => findKnownFormats(text.split("\n")).map((match) => match.kind);

describe("tier 1: every known format fires on its planted value", () => {
  it.each(Object.entries(PLANTED_TIER_ONE))("%s", (kind, secret) => {
    expect(kindsIn(`Deploy notes.\nexport VALUE=${secret} # from the log\n`)).toContain(kind);
  });

  it("a private-key block fires once, spanning header through END", () => {
    const text = `notes\n${PLANTED.privateKey}\nafter`;
    const matches = findKnownFormats(text.split("\n"));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ kind: "private-key", firstLine: 2, lastLine: 6 });
  });

  it("a private-key block without an END line spans through its last body line", () => {
    const text = [
      PLANTED.privateKey.split("\n")[0] ?? "",
      pseudoRandom(64, 3),
      pseudoRandom(20, 4),
      "",
    ];
    expect(findKnownFormats(text)).toMatchObject([{ firstLine: 1, lastLine: 3 }]);
  });

  it("each variant private-key header fires with a body", () => {
    for (const variant of ["RSA PRIVATE KEY", "OPENSSH PRIVATE KEY", "PGP PRIVATE KEY BLOCK"]) {
      const header = ["-----BEGIN", `${variant}-----`].join(" ");
      expect(kindsIn(`${header}\n${pseudoRandom(64, 9)}\n`), variant).toEqual(["private-key"]);
    }
  });
});

describe("tier 1: negatives stay silent", () => {
  it.each([
    [
      "a prose mention of a prefix",
      "OpenAI keys start with `sk-` and Anthropic ones with `sk-ant-`.",
    ],
    [
      "a GitHub prefix in prose",
      "Classic tokens start with ghp_ and fine-grained ones github_pat_.",
    ],
    ["a too-short AWS id", `export AWS_ACCESS_KEY_ID=${PLANTED.awsAccessKey.slice(0, 15)}`],
    ["a too-short GitHub token", PLANTED.githubToken.slice(0, 20)],
    ["a too-short Stripe key", ["sk", "_live_", "abc123"].join("")],
    ["a too-short Slack token", ["xo", "xb-", "123"].join("")],
    ["a too-short Google key", ["AI", "za", "Sy123"].join("")],
    ["a too-short OpenAI key", ["sk", "-proj-", "abc"].join("")],
    ["a placeholder token", ["gh", "p_", "x".repeat(36)].join("")],
    ["the AWS documented example key", ["AK", "IA", "IOSFODNN7", "EXAMPLE"].join("")],
    ["a JWT-ish prefix", "eyJ is how a JSON header looks once base64url-encoded."],
    ["a URL with a placeholder password", "postgres://user:password@host/db"],
    ["a URL with a template password", ["https://u:", "$", "{PASS}@h"].join("")],
    ["a URL with a masked password", "redis://user:****@cache"],
    ["a URL without credentials", "https://github.com/oscar/valija"],
  ])("%s", (_label, text) => {
    expect(kindsIn(text)).toEqual([]);
  });

  it("public keys and certificates are never flagged", () => {
    for (const label of ["PUBLIC KEY", "CERTIFICATE", "RSA PUBLIC KEY"]) {
      const block = [`-----BEGIN ${label}-----`, pseudoRandom(64, 5), `-----END ${label}-----`];
      expect(findKnownFormats(block), label).toEqual([]);
    }
  });

  it("a bare private-key header with no body does not fire (P-16)", () => {
    const header = PLANTED.privateKey.split("\n")[0] ?? "";
    expect(kindsIn(`Look for the ${header} line in the file.\nIt starts the block.`)).toEqual([]);
  });

  it("credentials in a URL fire only for a real-looking password", () => {
    expect(kindsIn(PLANTED.urlCredentials)).toEqual(["url-credentials"]);
    expect(kindsIn("postgres://admin:changeme@db")).toEqual([]);
  });
});

describe("tier 1: spans", () => {
  it("records the column span of a single-line match", () => {
    const line = `key: ${PLANTED.awsAccessKey}`;
    expect(findKnownFormats([line])).toEqual([
      { kind: "aws-access-key", firstLine: 1, lastLine: 1, start: 5, end: line.length },
    ]);
  });
});
