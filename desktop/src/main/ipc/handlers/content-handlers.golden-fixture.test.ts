import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GetContextPack } from "../../../../../src/context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../../../../../src/context/application/use-cases/list-projects.use-case.js";
import { SearchContext } from "../../../../../src/context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../../../../../src/context/application/use-cases/show-project.use-case.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { exportProjectMarkdown } from "../../../../../src/delivery/context-pack-export.js";
import {
  copyGoldenVaultTo,
  GOLDEN_VAULT_DIR,
  makeGoldenVaultReader,
  readGoldenVaultManifest,
} from "../../../../../src/testing/golden-vault.js";
import { en } from "../../../shared/i18n/catalogs/en.js";
import { es } from "../../../shared/i18n/catalogs/es.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createContentHandlers } from "./content-handlers.js";

const expectedExportPath = new URL("expected-export.md", GOLDEN_VAULT_DIR);
const tmpRoots: string[] = [];
afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

function goldenContainer(): Container {
  const manifest = readGoldenVaultManifest();
  const root = mkdtempSync(join(tmpdir(), "valija-content-golden-"));
  tmpRoots.push(root);
  copyGoldenVaultTo(root);
  const reader = makeGoldenVaultReader(root, manifest);
  return {
    listProjects: new ListProjects(reader.sessions),
    showProject: new ShowProject(reader.sessions),
    searchContext: new SearchContext(reader.sessions),
    getContextPack: new GetContextPack(reader.sessions, reader.clock),
    // biome-ignore lint/suspicious/noExplicitAny: only the four fields above are exercised by content-handlers.ts
  } as any as Container;
}

const filePicker: FilePicker = {
  chooseImportFile: () => null,
  chooseExportTarget: () => null,
  chooseVaultFolder: () => null,
  resolveHandle: () => undefined,
};
const clipboard: ClipboardPort = { writeText: () => {} };

describe("content-handlers — same use case, same content, against the golden fixture", () => {
  it("content:projects returns exactly what listProjects.execute() returns", () => {
    const container = goldenContainer();
    const handlers = createContentHandlers(() => container, filePicker, clipboard);

    const viaHandler = handlers["content:projects"]();
    const direct = container.listProjects.execute();

    expect(viaHandler).toEqual({ ok: true, value: direct.ok ? direct.value : [] });
    expect(direct.ok && direct.value.length).toBeGreaterThan(0);
  });

  it("content:show, with and without a type filter, matches showProject.execute() exactly", () => {
    const container = goldenContainer();
    const handlers = createContentHandlers(() => container, filePicker, clipboard);

    const viaHandlerAll = handlers["content:show"]({ project: "alpha" });
    const directAll = container.showProject.execute({ project: "alpha" });
    expect(viaHandlerAll).toEqual({ ok: true, value: directAll.ok ? directAll.value : [] });
    expect(directAll.ok && directAll.value.length).toBeGreaterThan(0);

    const viaHandlerImported = handlers["content:show"]({ project: "alpha", type: "imported" });
    const directImported = container.showProject.execute({ project: "alpha", type: "imported" });
    expect(viaHandlerImported).toEqual({
      ok: true,
      value: directImported.ok ? directImported.value : [],
    });
  });

  it("content:search matches searchContext.execute() exactly", () => {
    const container = goldenContainer();
    const handlers = createContentHandlers(() => container, filePicker, clipboard);

    const viaHandler = handlers["content:search"]({ query: "the" });
    const direct = container.searchContext.execute({ query: "the" });

    expect(viaHandler).toEqual({ ok: true, value: direct.ok ? direct.value : [] });
  });

  it("content:pack for 'alpha' matches expected-export.md byte-for-byte and exportProjectMarkdown's own output", () => {
    const container = goldenContainer();
    const handlers = createContentHandlers(() => container, filePicker, clipboard);
    const expectedExport = readFileSync(expectedExportPath, "utf8");

    const viaHandler = handlers["content:pack"]({ project: "alpha" });
    expect(viaHandler.ok).toBe(true);
    if (!viaHandler.ok) return;
    expect(viaHandler.value.markdown).toBe(expectedExport);

    const direct = exportProjectMarkdown(container, "alpha");
    expect(direct.ok).toBe(true);
    if (direct.ok) expect(viaHandler.value.markdown).toBe(direct.value);
  });

  it("the pack itself never depends on the UI language — only the one wrapper sentence is translated (D-V(d))", () => {
    const first = goldenContainer();
    const second = goldenContainer();
    const handlers1 = createContentHandlers(() => first, filePicker, clipboard);
    const handlers2 = createContentHandlers(() => second, filePicker, clipboard);

    const packAsIfEn = handlers1["content:pack"]({ project: "alpha" });
    const packAsIfEs = handlers2["content:pack"]({ project: "alpha" });
    expect(packAsIfEn.ok && packAsIfEs.ok).toBe(true);
    if (packAsIfEn.ok && packAsIfEs.ok) {
      expect(packAsIfEn.value.markdown).toBe(packAsIfEs.value.markdown);
    }

    // The one sentence *around* the pack does change — proving the pack's own
    // stability isn't just because nothing in this catalog is translated.
    expect(en.pack.notTranslatedNotice).not.toBe(es.pack.notTranslatedNotice);
  });
});
