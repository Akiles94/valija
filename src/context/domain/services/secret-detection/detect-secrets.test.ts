import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fragmentsOf,
  PLANTED,
  PLANTED_TIER_ONE,
  pseudoRandom,
} from "../../../../testing/fake-secrets.js";
import { detectSecrets } from "./detect-secrets.js";

const REPO_ROOT = join(import.meta.dirname, "../../../../..");

const planted = [PLANTED.privateKey, ...Object.values(PLANTED_TIER_ONE)];

describe("detectSecrets: findings carry no text", () => {
  it.each(
    planted,
  )("no 6-character fragment of a planted value survives serialization (%#)", (secret) => {
    const findings = detectSecrets(`intro\n${secret}\noutro`);
    expect(findings.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(findings);
    for (const fragment of fragmentsOf(secret)) expect(serialized).not.toContain(fragment);
    for (const finding of findings) {
      expect(Object.keys(finding).sort()).toEqual(["firstLine", "kind", "lastLine"]);
    }
  });
});

describe("detectSecrets: lines", () => {
  it("numbers lines from 1", () => {
    expect(detectSecrets(`a\nb\n${PLANTED.awsAccessKey}`)).toEqual([
      { kind: "aws-access-key", firstLine: 3, lastLine: 3 },
    ]);
  });

  it("CRLF input yields the same lines as LF", () => {
    const lf = `a\n${PLANTED.githubToken}\nc\n${PLANTED.privateKey}`;
    expect(detectSecrets(lf.replaceAll("\n", "\r\n"))).toEqual(detectSecrets(lf));
  });

  it("clean text yields nothing", () => {
    expect(detectSecrets("We chose SQLCipher over plain SQLite.\nNo secrets here.")).toEqual([]);
  });

  it("two identical kinds on one line are reported once", () => {
    expect(detectSecrets(`${PLANTED.awsAccessKey} and ${PLANTED.awsAccessKey}`)).toEqual([
      { kind: "aws-access-key", firstLine: 1, lastLine: 1 },
    ]);
  });
});

describe("detectSecrets: precedence within tier 1", () => {
  it("an Anthropic key is reported once, never also as an OpenAI key", () => {
    expect(detectSecrets(PLANTED.anthropicApiKey)).toEqual([
      { kind: "anthropic-api-key", firstLine: 1, lastLine: 1 },
    ]);
  });
});

describe("detectSecrets: precedence across tiers", () => {
  it("a tier-1 token used as an assignment's value is reported as tier 1 only", () => {
    expect(detectSecrets(`OPENAI_API_KEY=${PLANTED.openaiApiKey}`)).toEqual([
      { kind: "openai-api-key", firstLine: 1, lastLine: 1 },
    ]);
  });

  it("a tier-1 token and a separate assignment on one line are both reported", () => {
    const line = `${PLANTED.awsAccessKey} ; ${PLANTED.credentialAssignment.line}`;
    expect(detectSecrets(line).map((finding) => finding.kind)).toEqual([
      "aws-access-key",
      "credential-assignment",
    ]);
  });
});

describe("detectSecrets: precedence across all three tiers", () => {
  it("a JWT is reported only as a JWT", () => {
    expect(detectSecrets(`token ${PLANTED.jwt}`)).toEqual([
      { kind: "jwt", firstLine: 1, lastLine: 1 },
    ]);
  });

  it("a random-looking assignment value is reported only as a credential assignment", () => {
    expect(detectSecrets(`API_KEY=${PLANTED.highEntropy}`)).toEqual([
      { kind: "credential-assignment", firstLine: 1, lastLine: 1 },
    ]);
  });

  it("a private-key block is one finding, with no high-entropy finding on its body lines", () => {
    expect(detectSecrets(`intro\n${PLANTED.privateKey}`)).toEqual([
      { kind: "private-key", firstLine: 2, lastLine: 6 },
    ]);
  });

  it("one planted value per tier in one document yields exactly three findings", () => {
    const text = [
      "# Deploy notes",
      `export AWS_ACCESS_KEY_ID=${PLANTED.awsAccessKey}`,
      "",
      PLANTED.credentialAssignment.line,
      `The session cookie was ${PLANTED.highEntropy} yesterday.`,
    ].join("\n");
    expect(detectSecrets(text)).toEqual([
      { kind: "aws-access-key", firstLine: 2, lastLine: 2 },
      { kind: "credential-assignment", firstLine: 4, lastLine: 4 },
      { kind: "high-entropy-string", firstLine: 5, lastLine: 5 },
    ]);
  });
});

describe("detectSecrets: whole-document negatives (§8.4)", () => {
  it.each([
    "docs/SPEC.md",
    "src/testing/__fixtures__/golden-vault/expected-pack.md",
    "src/context/domain/services/secret-detection/__fixtures__/package-lock-excerpt.json",
  ])("%s yields zero findings", (relativePath) => {
    expect(detectSecrets(readFileSync(join(REPO_ROOT, relativePath), "utf8"))).toEqual([]);
  });

  it("a note with a certificate, an SSH public key and a SHA after a key header yields zero findings", () => {
    const keyHeader = PLANTED.privateKey.split("\n")[0] ?? "";
    const note = [
      "Server setup:",
      "-----BEGIN CERTIFICATE-----",
      pseudoRandom(64, 41),
      pseudoRandom(64, 42),
      "-----END CERTIFICATE-----",
      `Deploy key: ssh-ed25519 ${pseudoRandom(68, 43)} deploy@ci`,
      `The ${keyHeader} lint rule landed in`,
      pseudoRandom(40, 44, "0123456789abcdef"),
    ].join("\n");
    expect(detectSecrets(note)).toEqual([]);
  });
});

describe("detectSecrets: adversarial input completes within a time bound (§10.9)", () => {
  const SIZE = 32 * 1024;
  const BOUND_MS = 250;
  const fill = (unit: string) => unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);
  const randomLines = () => {
    const lines: string[] = [];
    for (let seed = 0; lines.length * 41 < SIZE; seed++) lines.push(pseudoRandom(40, seed));
    return lines.join("\n");
  };

  it.each([
    ["repeated `a=`", fill("a=")],
    ["one 32 KB line of A", "A".repeat(SIZE)],
    ["repeated private-key headers", fill(`${PLANTED.privateKey.split("\n")[0]}\n`)],
    ["repeated `x://a:`", fill("x://a:")],
    ['repeated `password: "`', fill('password: "')],
    ["32 KB of random base64 lines", randomLines()],
  ])("%s", (_label, text) => {
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      detectSecrets(text);
      best = Math.min(best, performance.now() - started);
    }
    expect(best).toBeLessThan(BOUND_MS);
  });
});

describe("detectSecrets: Node-free (the desktop renderer bundles it)", () => {
  it("no detection source imports node:, or uses Buffer or process", () => {
    const folder = import.meta.dirname;
    const sources = readdirSync(folder)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => join(folder, name));
    sources.push(join(folder, "../../values/secret-finding.ts"));
    expect(sources.length).toBeGreaterThan(3);
    for (const source of sources) {
      expect(readFileSync(source, "utf8"), source).not.toMatch(
        /from "node:|\bBuffer\b|\bprocess\./,
      );
    }
  });
});
