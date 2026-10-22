import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fragmentsOf, PLANTED, PLANTED_TIER_ONE } from "../../../../testing/fake-secrets.js";
import { detectSecrets } from "./detect-secrets.js";

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
