import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TypeScriptExportsExtractor } from "./typescript-exports-extractor.js";

let root: string;

function tree(files: Record<string, string>): string {
  root = mkdtempSync(join(tmpdir(), "living-docs-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("TypeScriptExportsExtractor", () => {
  it("emits sorted symbols with posix paths and a predicate-driven doc requirement", async () => {
    const repoRoot = tree({
      "src/b/z.ts": "/** Zed does z. */\nexport const z = 1;\n",
      "src/a/y.ts": "export function y() {}\nexport { z } from '../b/z.js';\n",
      "src/a/y.test.ts": "export const ignored = 1;\n",
      "src/testing/fixture.ts": "export const fixture = 1;\n",
      "src/a/types.d.ts": "export type D = 1;\n",
      "src/gen/out.ts": "export const generated = 1;\n",
    });
    const facts = await new TypeScriptExportsExtractor({
      repoRoot,
      roots: ["src"],
      exclude: (path) => path.startsWith("src/gen"),
      docRequired: (path) => path.startsWith("src/a"),
    }).extract();

    expect(facts.symbols.map((s) => [s.file, s.name, s.requiresDoc, s.doc])).toEqual([
      ["src/a/y.ts", "y", true, null],
      ["src/b/z.ts", "z", false, "Zed does z."],
    ]);
    expect(facts.findings).toEqual([]);
  });

  it("turns an unscannable file into a finding instead of skipping it", async () => {
    const repoRoot = tree({ "src/bad.ts": "export const ok = 1;\n}\n" });
    const facts = await new TypeScriptExportsExtractor({
      repoRoot,
      roots: ["src"],
      docRequired: () => true,
    }).extract();
    expect(facts.findings).toMatchObject([
      { rule: "unscannable-source", file: "src/bad.ts", line: 2 },
    ]);
  });
});
