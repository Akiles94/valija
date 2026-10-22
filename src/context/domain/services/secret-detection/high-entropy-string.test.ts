import { describe, expect, it } from "vitest";
import { PLANTED, pseudoRandom } from "../../../../testing/fake-secrets.js";
import { findHighEntropyStrings, shannonEntropy } from "./high-entropy-string.js";

const kindsIn = (text: string) =>
  findHighEntropyStrings(text.split("\n")).map((match) => match.kind);

const hex = (length: number, seed: number) => pseudoRandom(length, seed, "0123456789abcdef");

/** A 48-character base64url token that uses both `-` and `_`. */
const base64Url48 = ["Zx81-QpLm_77Hb", "Q7mZ2vK9pL4x-R8tW1nB6cY3h", "_J5gF0dS2"].join("");

describe("tier 3: high-entropy-string must fire (§8.4)", () => {
  it("a bare 40-character mixed token in prose", () => {
    expect(kindsIn(`The value was ${PLANTED.highEntropy} before the rotation.`)).toEqual([
      "high-entropy-string",
    ]);
  });

  it("a bearer token", () => {
    expect(kindsIn("Authorization: Bearer 8fJ2kL9mQ4rT7vX1zB5nC3pD6sG0hW2y")).toEqual([
      "high-entropy-string",
    ]);
  });

  it("a 48-character base64url token on its own line", () => {
    expect(base64Url48).toHaveLength(48);
    expect(kindsIn(`notes\n${base64Url48}\n`)).toEqual(["high-entropy-string"]);
  });

  it("reports the token's line and column span", () => {
    const [match] = findHighEntropyStrings(["a", `x ${PLANTED.highEntropy}`]);
    expect(match).toEqual({
      kind: "high-entropy-string",
      firstLine: 2,
      lastLine: 2,
      start: 2,
      end: 42,
    });
  });
});

describe("tier 3: high-entropy-string must not fire (§8.4)", () => {
  it.each([
    ["a 7-character git SHA", `fixed in ${hex(7, 1)}`],
    ["a 40-character git SHA", hex(40, 2)],
    ["a 64-character sha256", hex(64, 3)],
    ["a commit line", `commit ${hex(40, 4)}`],
    ["an upper-case hex dump", hex(64, 5).toUpperCase()],
    ["a UUID", "550e8400-e29b-41d4-a716-446655440000"],
    ["a ULID", "01J3Q8Z6M4X5Y7T9B2C1D0E8F6"],
    ["an imported item id", `imp-${hex(32, 6)}`],
    ["a lockfile integrity value", `"integrity": "sha512-${pseudoRandom(86, 7)}=="`],
    [
      "a data URI longer than 200 characters",
      `data:image/png;base64,iVBORw0KGgo${pseudoRandom(400, 8)}`,
    ],
    ["a short data URI", `data:image/png;base64,${pseudoRandom(60, 9)}`],
    ["a repository path", "src/context/domain/services/item-curation.ts"],
    ["an absolute path", "/Users/Oscar/Projects/App2024/src/Main.ts"],
    ["a GitHub blob URL", `https://github.com/oscar/valija/blob/${hex(40, 10)}/docs/SPEC.md`],
    ["an identifier", "createImportedContextItemFromDraft"],
    ["a low-entropy run", "A".repeat(36)],
    [
      "a search_context result line",
      "- [valija] (decision, 2026-07-20, id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6) Use SQLCipher.",
    ],
    ["a hash in context", `checksum: ${PLANTED.highEntropy}`],
    ["a token inside a URL", `https://example.org/callback?state=${PLANTED.highEntropy}`],
    ["a relative path", `./${PLANTED.highEntropy}`],
    ["a home path", `~/${PLANTED.highEntropy}`],
    ["a too-long run", pseudoRandom(201, 11)],
  ])("%s", (_label, text) => {
    expect(kindsIn(text)).toEqual([]);
  });
});

describe("tier 3: public key material is not a secret", () => {
  const block = (label: string, body: string[]) =>
    [`-----BEGIN ${label}-----`, ...body, `-----END ${label}-----`].join("\n");

  it.each([
    "CERTIFICATE",
    "PUBLIC KEY",
    "PGP PUBLIC KEY BLOCK",
    "CERTIFICATE REQUEST",
  ])("the body of a %s block", (label) => {
    const body = ["Version: GnuPG v2", "", pseudoRandom(64, 31), pseudoRandom(64, 32)];
    expect(kindsIn(block(label, body))).toEqual([]);
  });

  it.each([
    ["ssh-ed25519", pseudoRandom(68, 33)],
    ["ecdsa-sha2-nistp256", pseudoRandom(140, 34)],
    ["sk-ssh-ed25519@openssh.com", pseudoRandom(100, 35)],
  ])("an OpenSSH %s public key", (algorithm, blob) => {
    expect(kindsIn(`${algorithm} ${blob} oscar@laptop`)).toEqual([]);
  });

  it("a token after a certificate's END line still fires", () => {
    const text = `${block("CERTIFICATE", [pseudoRandom(64, 36)])}\ntoken ${PLANTED.highEntropy}`;
    expect(findHighEntropyStrings(text.split("\n"))).toMatchObject([
      { kind: "high-entropy-string", firstLine: 4 },
    ]);
  });

  it("a certificate header does not hide a private key pasted right after it", () => {
    const text = `${block("CERTIFICATE", [pseudoRandom(64, 37)])}\n${PLANTED.privateKey}`;
    expect(kindsIn(text)).toContain("high-entropy-string");
  });
});

describe("shannonEntropy", () => {
  it("is 0 for one repeated character", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
  });

  it("is 5 bits for 32 distinct characters", () => {
    expect(shannonEntropy("ABCDEFGHIJKLMNOPQRSTUVWXYZ012345")).toBeCloseTo(5, 10);
  });
});
