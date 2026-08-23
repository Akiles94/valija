import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ImportItems } from "../../../../../src/context/application/use-cases/import-items.use-case.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { ImportConversations } from "../../../../../src/importers/application/use-cases/import-conversations.use-case.js";
import { FileExportReader } from "../../../../../src/importers/infra/file-export-reader.js";
import { parserRegistry } from "../../../../../src/importers/infra/parser-registry.js";
import { makeUnlockedVault } from "../../../../../src/testing/test-vault.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createImportHandlers } from "./import-handlers.js";

const tmp = mkdtempSync(join(tmpdir(), "valija-import-handlers-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fakeFilePicker(handleToPath: Record<string, string>): FilePicker {
  return {
    chooseImportFile: () => null,
    chooseExportTarget: () => null,
    chooseVaultFolder: () => null,
    resolveHandle: (handle) => handleToPath[handle],
  };
}

describe("import-handlers", () => {
  it("import:list refuses with UNREADABLE_FILE when the handle has expired, without touching the vault", () => {
    const vault = makeUnlockedVault();
    const container = {
      paths: vault.paths,
      importConversations: new ImportConversations(
        new FileExportReader(),
        parserRegistry,
        new ImportItems(vault.sessions, vault.clock, vault.idGen),
        vault.clock,
      ),
      // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
    } as any as Container;

    const handlers = createImportHandlers(() => container, fakeFilePicker({}));
    const result = handlers["import:list"]({ handle: "fh-expired" });
    expect(!result.ok && result.error.code).toBe("UNREADABLE_FILE");
  });

  it("import:list resolves the handle to a real path and lists conversations from it", () => {
    // Reuses the real ChatgptParser fixture rather than a hand-written payload,
    // so this test proves the handler wiring, not a guess at the export format.
    const fixtureUrl = new URL(
      "../../../../../src/importers/infra/parsers/__fixtures__/chatgpt.json",
      import.meta.url,
    );
    const filePath = join(tmp, "export.json");
    writeFileSync(filePath, readFileSync(fixtureUrl, "utf8"), "utf8");

    const vault = makeUnlockedVault();
    const container = {
      paths: vault.paths,
      importConversations: new ImportConversations(
        new FileExportReader(),
        parserRegistry,
        new ImportItems(vault.sessions, vault.clock, vault.idGen),
        vault.clock,
      ),
      // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
    } as any as Container;

    const handlers = createImportHandlers(() => container, fakeFilePicker({ "fh-1": filePath }));
    const result = handlers["import:list"]({ handle: "fh-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.listing.length).toBeGreaterThan(0);
    }
  });
});
