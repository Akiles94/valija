import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GetContextPack } from "../../../../../src/context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../../../../../src/context/application/use-cases/list-projects.use-case.js";
import { SaveContext } from "../../../../../src/context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../../../../src/context/application/use-cases/search-context.use-case.js";
import { SetItemArchived } from "../../../../../src/context/application/use-cases/set-item-archived.use-case.js";
import { SetItemPinned } from "../../../../../src/context/application/use-cases/set-item-pinned.use-case.js";
import { ShowProject } from "../../../../../src/context/application/use-cases/show-project.use-case.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { makeUnlockedVault, SeqIds } from "../../../../../src/testing/test-vault.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createContentHandlers } from "./content-handlers.js";

/**
 * §5.1: "sessions per action, never long-lived." Every content handler calls
 * a use case that goes through `VaultSessions.withSession`, which opens and
 * closes the database within one call — nothing here should ever leave a
 * `-wal`/`-shm`/`-journal` sidecar behind, on a real vault, after a real
 * scripted sequence of handler calls.
 *
 * Uses a hand-built Container over `makeUnlockedVault`'s fakes rather than
 * `buildContainer()` — the real container always wires the real OS keychain,
 * which this sandboxed test environment cannot use (no secret-service
 * backend; see advances/GUI/spike.md).
 */
describe("content handlers never leave a sidecar behind", () => {
  it("a scripted sequence of reads leaves the vault folder at rest", () => {
    const vault = makeUnlockedVault();
    const container = {
      paths: vault.paths,
      listProjects: new ListProjects(vault.sessions),
      showProject: new ShowProject(vault.sessions),
      searchContext: new SearchContext(vault.sessions),
      getContextPack: new GetContextPack(vault.sessions, vault.clock),
      setItemPinned: new SetItemPinned(vault.sessions, vault.clock),
      setItemArchived: new SetItemArchived(vault.sessions, vault.clock),
      // biome-ignore lint/suspicious/noExplicitAny: only the fields above are exercised by content-handlers.ts
    } as any as Container;

    const filePicker: FilePicker = {
      chooseImportFile: () => null,
      chooseExportTarget: () => null,
      chooseVaultFolder: () => null,
      resolveHandle: () => undefined,
    };
    const clipboard: ClipboardPort = { writeText: () => {} };
    const handlers = createContentHandlers(() => container, filePicker, clipboard);

    handlers["content:projects"]();
    handlers["content:show"]({ project: "does-not-exist" });
    handlers["content:search"]({ query: "anything" });
    handlers["content:pack"]({ project: "does-not-exist" });

    // The two curation writes, against a real item — a write must leave no sidecar either.
    const saved = new SaveContext(vault.sessions, vault.clock, new SeqIds()).execute({
      project: "at-rest",
      content: "an item to curate",
    });
    if (!saved.ok) throw new Error(saved.error.message);
    handlers["content:setPinned"]({ id: saved.value.itemId, pinned: true });
    handlers["content:setArchived"]({ id: saved.value.itemId, archived: true });

    for (const suffix of ["-wal", "-shm", "-journal"]) {
      expect(existsSync(`${vault.paths.db}${suffix}`)).toBe(false);
    }
  });
});
