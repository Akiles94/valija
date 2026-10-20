import { describe, expect, it } from "vitest";
import { createCatalogue } from "../../domain/values/catalogue.js";
import type { GuidePage } from "../../domain/values/guide-page.js";
import type { GuideSettings } from "../../domain/values/guide-settings.js";
import { MarkdownGuideRenderer } from "../../infra/markdown-guide-renderer.js";
import { formatGuideReport } from "../dto/guide-report.js";
import { createExtractedFacts, type Extractor } from "../ports/extractor.js";
import type { FlowSource, GuideWorkspace } from "../ports/guide-workspace.js";
import { GenerateGuide } from "./generate-guide.use-case.js";

const settings: GuideSettings = {
  title: "Demo guide",
  flowsDir: "docs/flows",
  guideDir: "docs/guide",
  themeOrder: ["Basics"],
  referenceKinds: ["cli"],
};

const FLOW = `---
title: Greet
theme: Basics
---
## Who
Anyone.
## Why
To say hello.
## Business rules
- Be polite.
## What can go wrong
- Nothing.
## Entry points
- CLI: {{cli:greet}}
- Desktop: none — CLI-only demo.
## Steps
1. [User → CLI] Runs the command — {{cli:greet}}
2. [CLI → Greeter] Greets — {{Greeter}}
## Errors
None.
`;

const codeFacts: Extractor = {
  name: "demo",
  extract: async () =>
    createExtractedFacts({
      symbols: [
        {
          name: "Greeter",
          declaration: "class",
          file: "src/greeter.ts",
          line: 3,
          doc: "Says hello to the user.",
          requiresDoc: true,
        },
      ],
      catalogues: [
        createCatalogue({
          id: "cli",
          page: "reference/cli.md",
          title: "CLI commands",
          columns: ["Command", "What it does"],
          rows: [
            {
              key: { kind: "cli", name: "greet", label: "demo greet" },
              cells: [{ text: "demo greet" }, { text: "Says hello." }],
            },
          ],
        }),
      ],
      requirements: [{ kind: "cli", names: ["greet"], reason: "every CLI command" }],
    }),
};

class MemoryWorkspace implements GuideWorkspace {
  written: GuidePage[] = [];
  constructor(
    private readonly flows: FlowSource[],
    public committed: GuidePage[] = [],
  ) {}
  readFlowSources = async () => this.flows;
  readOverview = async () => "A demo product.";
  readGuidePages = async () => this.committed;
  writeGuidePages = async (pages: readonly GuidePage[]) => {
    this.written = [...pages];
  };
}

const run = (workspace: GuideWorkspace, extractors: Extractor[] = [codeFacts]) =>
  new GenerateGuide(extractors, workspace, new MarkdownGuideRenderer(), settings);

describe("GenerateGuide", () => {
  it("writes pages, then a check against them is clean", async () => {
    const workspace = new MemoryWorkspace([{ path: "docs/flows/greet.md", text: FLOW }]);
    const written = await run(workspace).execute({ mode: "write" });
    expect(written.findings).toEqual([]);
    expect(workspace.written.map((p) => p.path)).toEqual([
      "README.md",
      "flows/greet.md",
      "reference/cli.md",
    ]);

    workspace.committed = workspace.written;
    const checked = await run(workspace).execute({ mode: "check" });
    expect(checked.findings).toEqual([]);
    expect(formatGuideReport(checked).at(-1)).toBe(
      "✓ Guide up to date: 1 flows, 3 citations, 1/1 exports documented.",
    );
  });

  it("reports a hand-edited page as stale", async () => {
    const workspace = new MemoryWorkspace([{ path: "docs/flows/greet.md", text: FLOW }]);
    await run(workspace).execute({ mode: "write" });
    workspace.committed = workspace.written.map((p) =>
      p.path === "README.md" ? { ...p, content: `${p.content}edited\n` } : p,
    );
    const checked = await run(workspace).execute({ mode: "check" });
    expect(checked.findings).toMatchObject([{ rule: "stale-page", file: "docs/guide/README.md" }]);
    expect(formatGuideReport(checked).at(-1)).toBe("1 problem. Guide not up to date.");
  });

  it("keeps going when one extractor throws", async () => {
    const broken: Extractor = {
      name: "broken",
      extract: async () => {
        throw new Error("boom");
      },
    };
    const workspace = new MemoryWorkspace([{ path: "docs/flows/greet.md", text: FLOW }]);
    const report = await run(workspace, [broken, codeFacts]).execute({ mode: "write" });
    expect(report.findings).toMatchObject([{ rule: "extractor-failure", subject: "broken" }]);
    expect(workspace.written).toHaveLength(3);
  });

  it("reports uncited items and broken references from flows", async () => {
    const flow = FLOW.replace("{{Greeter}}", "{{Greeterr}}").replace(/\{\{cli:greet\}\}/g, "x");
    const workspace = new MemoryWorkspace([{ path: "docs/flows/greet.md", text: flow }]);
    const report = await run(workspace).execute({ mode: "check" });
    const rules = report.findings.map((f) => f.rule);
    expect(rules).toContain("broken-reference");
    expect(rules).toContain("unreferenced-item");
  });
});
