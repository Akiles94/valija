import { describe, expect, it } from "vitest";
import { parseFlow } from "./flow.js";

const KINDS = ["cli", "ipc", "err"];

const SOURCE = `---
title: Unlock the vault
theme: Vault lifecycle
---

## Who
A developer.

## Why
To let AI tools read context.

## Business rules
- Nothing is ever deleted.

## What can go wrong
- Wrong passphrase.

## Entry points
- CLI: {{cli:unlock}}
- Desktop: {{ipc:vault:unlock}}

## Steps
1. [User → CLI] Types the passphrase — {{cli:unlock}}
2. [CLI -> UnlockVault] Asks to unlock — {{vault/UnlockVault}}
3. [UnlockVault → User] Done

## Errors
- {{err:WRONG_PASSPHRASE}}
`;

describe("parseFlow", () => {
  it("reads front matter, sections, steps and every located reference", () => {
    const flow = parseFlow("docs/flows/unlock.md", SOURCE, KINDS);
    if (!flow.ok) throw new Error(JSON.stringify(flow.error));
    expect(flow.value.slug).toBe("unlock");
    expect(flow.value.title).toBe("Unlock the vault");
    expect(flow.value.theme).toBe("Vault lifecycle");
    expect([...flow.value.sections.keys()]).toEqual([
      "Who",
      "Why",
      "Business rules",
      "What can go wrong",
      "Entry points",
      "Steps",
      "Errors",
    ]);
    expect(flow.value.steps.map((s) => [s.number, s.from, s.to])).toEqual([
      [1, "User", "CLI"],
      [2, "CLI", "UnlockVault"],
      [3, "UnlockVault", "User"],
    ]);
    expect(flow.value.steps[2]?.references).toEqual([]);
    expect(flow.value.steps[1]?.line).toBe(24);
    expect(flow.value.references.map((r) => [r.reference.raw, r.line])).toEqual([
      ["cli:unlock", 19],
      ["ipc:vault:unlock", 20],
      ["cli:unlock", 23],
      ["vault/UnlockVault", 24],
      ["err:WRONG_PASSPHRASE", 28],
    ]);
  });

  it("treats `->` and `→` alike and CRLF like LF", () => {
    const crlf = parseFlow("docs/flows/unlock.md", SOURCE.replace(/\n/g, "\r\n"), KINDS);
    const lf = parseFlow("docs/flows/unlock.md", SOURCE, KINDS);
    if (!crlf.ok || !lf.ok) throw new Error("parse failed");
    expect(crlf.value.steps).toEqual(lf.value.steps);
    expect(crlf.value.references).toEqual(lf.value.references);
  });

  it("reports out-of-order steps with their line", () => {
    const flow = parseFlow("f.md", SOURCE.replace("3. [UnlockVault", "5. [UnlockVault"), KINDS);
    expect(flow.ok).toBe(false);
    if (flow.ok) return;
    expect(flow.error).toContainEqual(
      expect.objectContaining({ rule: "malformed-flow", line: 25, subject: "step 5" }),
    );
  });

  it("collects every problem: missing front matter and an unknown reference kind", () => {
    const flow = parseFlow("f.md", "## Steps\n1. [A → B] uses {{mcp:save}}\n", KINDS);
    expect(flow.ok).toBe(false);
    if (flow.ok) return;
    expect(flow.error.map((f) => f.rule).sort()).toEqual([
      "malformed-flow",
      "malformed-flow",
      "unknown-reference-kind",
    ]);
  });
});
