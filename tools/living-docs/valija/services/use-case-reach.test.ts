import { describe, expect, it } from "vitest";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";
import { scanTypeScript } from "../../core/infra/typescript-scanner.js";
import { indexCallables, reachContainerKeys, readContainerUseCases } from "./use-case-reach.js";

const file = (path: string, text: string): SourceFile => {
  const scanned = scanTypeScript(text, { jsx: false });
  if (!scanned.ok) throw new Error(scanned.error.reason);
  return { path, text, scanned: scanned.value };
};

const files = [
  file(
    "src/delivery/cli/commands.ts",
    "export function exportCommand(c) { return render(c); }\nfunction render(c) { return exportPack(c); }\n",
  ),
  file(
    "src/delivery/pack.ts",
    "export function exportPack(c) { return c.getContextPack.execute({}); }\nexport function loop(c) { return loop(c); }\n",
  ),
  file(
    "desktop/src/main/h.ts",
    "function helper(c) { return c.lockVault.execute(); }\nexport const h = { a: () => helper(c) };\n",
  ),
];
const index = indexCallables(files);

describe("reachContainerKeys", () => {
  it("follows hops through same-file helpers and delivery exports, up to the depth", () => {
    expect(reachContainerKeys("exportCommand(container)", "x.ts", index, 3)).toEqual([
      "getContextPack",
    ]);
    expect(reachContainerKeys("exportCommand(container)", "x.ts", index, 2)).toEqual([]);
  });

  it("follows same-file non-exported helpers", () => {
    expect(reachContainerKeys("helper(c)", "desktop/src/main/h.ts", index)).toEqual(["lockVault"]);
  });

  it("terminates on cycles", () => {
    expect(reachContainerKeys("loop(c)", "x.ts", index, 5)).toEqual([]);
  });

  it("ignores .execute( in comments (masked code)", () => {
    const masked = file("y.ts", "// c.unlockVault.execute()\nconst a = 1;\n").scanned.code;
    expect(reachContainerKeys(masked, "y.ts", index)).toEqual([]);
  });
});

describe("readContainerUseCases", () => {
  it("maps container keys to use-case classes", () => {
    const container = file(
      "src/delivery/container.ts",
      "export function buildContainer() {\n  const items = new ImportItems(s);\n  return { saveContext: new SaveContext(s), paths };\n}\n",
    );
    expect([...readContainerUseCases(container)]).toEqual([["saveContext", "SaveContext"]]);
  });
});
