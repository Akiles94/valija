import { describe, expect, it } from "vitest";
import { parseFlow } from "../entities/flow.js";
import type { DocumentedSymbol } from "../values/documented-symbol.js";
import {
  citationKey,
  findMissingSections,
  findUndocumentedSymbols,
  findUnreferencedItems,
  isTrivialDoc,
} from "./guide-rules.js";

const symbol = (doc: string | null, requiresDoc = true): DocumentedSymbol => ({
  name: "UnlockVault",
  declaration: "class",
  file: "src/vault/x.ts",
  line: 4,
  doc,
  requiresDoc,
});

describe("findUndocumentedSymbols", () => {
  it("flags a missing doc and a doc that only restates the name", () => {
    expect(findUndocumentedSymbols([symbol(null)])).toMatchObject([
      { rule: "undocumented-export", file: "src/vault/x.ts", line: 4 },
    ]);
    expect(findUndocumentedSymbols([symbol("UnlockVault.")])).toMatchObject([
      { rule: "trivial-doc" },
    ]);
    expect(findUndocumentedSymbols([symbol("Unlock vault")])).toMatchObject([
      { rule: "trivial-doc" },
    ]);
  });

  it("accepts a real sentence and ignores symbols that do not require docs", () => {
    expect(findUndocumentedSymbols([symbol("Opens the vault with a passphrase.")])).toEqual([]);
    expect(findUndocumentedSymbols([symbol(null, false)])).toEqual([]);
  });

  it("looks only at the first sentence, without tags", () => {
    expect(isTrivialDoc("UnlockVault.\n@see docs", "UnlockVault")).toBe(true);
    expect(isTrivialDoc("@deprecated", "UnlockVault")).toBe(true);
  });
});

describe("findUnreferencedItems", () => {
  it("reports each uncited item where the requirement locates it", () => {
    const findings = findUnreferencedItems(
      [
        {
          kind: "cli",
          names: ["lock", "unlock"],
          reason: "every CLI command",
          locate: () => ({ file: "src/delivery/cli/build-program.ts" }),
        },
      ],
      new Set([citationKey("cli", "unlock")]),
    );
    expect(findings).toMatchObject([
      { rule: "unreferenced-item", subject: "cli:lock", file: "src/delivery/cli/build-program.ts" },
    ]);
  });
});

describe("findMissingSections", () => {
  it("requires both levels and a CLI and Desktop entry line", () => {
    const parsed = parseFlow(
      "docs/flows/f.md",
      "---\ntitle: T\ntheme: X\n---\n## Who\nA dev.\n## Entry points\n- CLI: {{cli:unlock}}\n## Steps\n1. [A → B] go\n",
      ["cli"],
    );
    if (!parsed.ok) throw new Error("parse failed");
    const subjects = findMissingSections(parsed.value).map((f) => f.subject);
    expect(subjects).toEqual([
      "Why",
      "Business rules",
      "What can go wrong",
      "Errors",
      "Entry points / Desktop",
    ]);
  });
});
