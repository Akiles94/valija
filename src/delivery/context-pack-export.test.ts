import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../context/application/use-cases/get-context-pack.use-case.js";
import { ShowProject } from "../context/application/use-cases/show-project.use-case.js";
import {
  copyGoldenVaultTo,
  GOLDEN_VAULT_DIR,
  makeGoldenVaultReader,
  readGoldenVaultManifest,
} from "../testing/golden-vault.js";
import type { Container } from "./container.js";
import { exportProjectJson, exportProjectMarkdown } from "./context-pack-export.js";

const expectedExportPath = new URL("expected-export.md", GOLDEN_VAULT_DIR);
const tmpRoots: string[] = [];
afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), `valija-export-${prefix}-`));
  tmpRoots.push(root);
  return root;
}

describe("exportProjectMarkdown — the same composition valija export uses", () => {
  it("matches expected-export.md byte-for-byte against the golden fixture", () => {
    const manifest = readGoldenVaultManifest();
    const expectedExport = readFileSync(expectedExportPath, "utf8");
    const root = tempRoot("markdown");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const container = {
      getContextPack: new GetContextPack(reader.sessions, reader.clock),
    } as unknown as Container;

    const result = exportProjectMarkdown(container, "alpha");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(expectedExport);
    reader.close();
  });
});

describe("exportProjectJson", () => {
  it("returns the project's items as JSON, matching ShowProject's own output", () => {
    const manifest = readGoldenVaultManifest();
    const root = tempRoot("json");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const showProject = new ShowProject(reader.sessions);
    const container = { showProject } as unknown as Container;

    const result = exportProjectJson(container, "alpha");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = JSON.parse(result.value) as { project: string; items: unknown[] };
    expect(parsed.project).toBe("alpha");

    const direct = showProject.execute({ project: "alpha" });
    expect(direct.ok).toBe(true);
    if (direct.ok) expect(parsed.items).toEqual(direct.value);
    reader.close();
  });
});
