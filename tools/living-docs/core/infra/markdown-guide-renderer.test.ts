import { describe, expect, it } from "vitest";
import { parseFlow } from "../domain/entities/flow.js";
import { assembleGuide } from "../domain/services/guide-assembly.js";
import { createCatalogue } from "../domain/values/catalogue.js";
import { createGraph } from "../domain/values/graph.js";
import type { GuideSettings } from "../domain/values/guide-settings.js";
import { GENERATED_BANNER } from "./file-guide-workspace.js";
import { MarkdownGuideRenderer } from "./markdown-guide-renderer.js";

const settings: GuideSettings = {
  title: "Demo guide",
  flowsDir: "docs/flows",
  guideDir: "docs/guide",
  themeOrder: [],
  referenceKinds: ["cli"],
};

const flow = parseFlow(
  "docs/flows/greet.md",
  `---
title: Greet
theme: Basics
---
## Who
Anyone.
## Why
To say hello. More detail.
## Business rules
- Be polite.
## What can go wrong
- Nothing.
## Entry points
- CLI: {{cli:greet}}
- Desktop: none.
## Steps
1. [User → CLI] Runs it — {{cli:greet}}
2. [CLI → Greeter] Greets | politely — {{Greeter}}
## Errors
None.
`,
  ["cli"],
);
if (!flow.ok) throw new Error("fixture flow does not parse");

const catalogue = (order: number[]) =>
  createCatalogue({
    id: "cli",
    page: "reference/cli.md",
    title: "CLI commands",
    columns: ["Command", "Defined in"],
    rows: order.map((i) => ({
      key: { kind: "cli", name: ["greet", "wave"][i] as string, label: `demo ${i}` },
      cells: [{ text: `demo ${i}` }, { text: "program.ts", href: "src/program.ts" }],
    })),
  });

const graph = createGraph({
  id: "modules",
  page: "architecture.md",
  title: "Modules",
  direction: "LR",
  nodes: [
    { id: "cli", label: "CLI" },
    { id: "core", label: "Core" },
  ],
  edges: [{ from: "cli", to: "core" }],
});

const render = (order: number[]) =>
  new MarkdownGuideRenderer().render(
    assembleGuide(
      {
        symbols: [
          {
            name: "Greeter",
            declaration: "class",
            file: "src/app/greeter.ts",
            line: 1,
            doc: "Greets.",
            requiresDoc: true,
          },
        ],
        catalogues: [catalogue(order)],
        graphs: [graph],
        requirements: [],
        findings: [],
      },
      [flow.value],
      "A demo.",
      settings,
    ),
  );

describe("MarkdownGuideRenderer", () => {
  const pages = render([0, 1]);
  const byPath = new Map(pages.map((p) => [p.path, p.content]));

  it("is byte-identical across runs and input orders", () => {
    expect(render([1, 0])).toEqual(pages);
    expect(render([0, 1])).toEqual(pages);
  });

  it("puts the banner on every page and leaks no absolute paths", () => {
    for (const p of pages) {
      expect(p.content.startsWith(GENERATED_BANNER)).toBe(true);
      expect(p.content).not.toMatch(/\\|C:|\/tmp\//);
    }
  });

  it("puts the business sections before How it works, and links relative to the page", () => {
    const content = byPath.get("flows/greet.md") as string;
    expect(content.indexOf("## What can go wrong")).toBeLessThan(
      content.indexOf("## How it works"),
    );
    expect(content).toContain("[`Greeter`](../../../src/app/greeter.ts)");
    expect(content).toContain("[`demo 0`](../reference/cli.md#cli-greet)");
    expect(content).toContain("participant P1 as User");
    expect(content).toContain("P2->>P3: 2. Greets | politely");
  });

  it("renders catalogues with anchors, repo links, escaped cells and back-links", () => {
    const content = byPath.get("reference/cli.md") as string;
    expect(content).toContain(
      '| <a id="cli-greet"></a>demo 0 | [program.ts](../../../src/program.ts) | [Greet](../flows/greet.md) |',
    );
    expect(content).toContain(
      '| <a id="cli-wave"></a>demo 1 | [program.ts](../../../src/program.ts) | — |',
    );
  });

  it("indexes flows by theme and lists reference pages", () => {
    const index = byPath.get("README.md") as string;
    expect(index).toContain("- [Greet](flows/greet.md) — To say hello.");
    expect(index).toContain("- [Modules](architecture.md)");
    expect(index).toContain("- [CLI commands](reference/cli.md)");
  });
});
