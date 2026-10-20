import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileGuideWorkspace, GENERATED_BANNER } from "./file-guide-workspace.js";

let root: string;
let workspace: FileGuideWorkspace;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "living-docs-ws-"));
  mkdirSync(join(root, "docs/flows"), { recursive: true });
  mkdirSync(join(root, "docs/guide/flows"), { recursive: true });
  workspace = new FileGuideWorkspace({
    repoRoot: root,
    flowsDir: "docs/flows",
    guideDir: "docs/guide",
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("FileGuideWorkspace", () => {
  it("reads flow sources sorted, skipping README and _ files, with CRLF normalised", async () => {
    writeFileSync(join(root, "docs/flows/b.md"), "b\r\nline");
    writeFileSync(join(root, "docs/flows/a.md"), "a");
    writeFileSync(join(root, "docs/flows/README.md"), "readme");
    writeFileSync(join(root, "docs/flows/_overview.md"), "Overview.\r\n");
    expect(await workspace.readFlowSources()).toEqual([
      { path: "docs/flows/a.md", text: "a" },
      { path: "docs/flows/b.md", text: "b\nline" },
    ]);
    expect(await workspace.readOverview()).toBe("Overview.");
  });

  it("refuses paths that escape the guide directory", async () => {
    await expect(workspace.writeGuidePages([{ path: "../x.md", content: "x" }])).rejects.toThrow();
    await expect(workspace.writeGuidePages([{ path: "/abs.md", content: "x" }])).rejects.toThrow();
    await expect(workspace.writeGuidePages([{ path: "a.txt", content: "x" }])).rejects.toThrow();
  });

  it("deletes generated orphans but never a hand-written file", async () => {
    writeFileSync(join(root, "docs/guide/flows/old.md"), `${GENERATED_BANNER}\nold`);
    writeFileSync(join(root, "docs/guide/notes.md"), "hand-written");
    await workspace.writeGuidePages([{ path: "README.md", content: `${GENERATED_BANNER}\r\nhi` }]);
    expect(existsSync(join(root, "docs/guide/flows/old.md"))).toBe(false);
    expect(existsSync(join(root, "docs/guide/notes.md"))).toBe(true);
    expect(readFileSync(join(root, "docs/guide/README.md"), "utf8")).toBe(
      `${GENERATED_BANNER}\nhi\n`,
    );
  });
});
