import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { GetContextPack } from "../../../../../src/context/application/use-cases/get-context-pack.use-case.js";
import { ImportItems } from "../../../../../src/context/application/use-cases/import-items.use-case.js";
import { createContextItem } from "../../../../../src/context/domain/entities/context-item.js";
import { parseContent } from "../../../../../src/context/domain/values/content.js";
import { parseProjectName } from "../../../../../src/context/domain/values/project-name.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { ImportConversations } from "../../../../../src/importers/application/use-cases/import-conversations.use-case.js";
import { FileExportReader } from "../../../../../src/importers/infra/file-export-reader.js";
import { parserRegistry } from "../../../../../src/importers/infra/parser-registry.js";
import { ok } from "../../../../../src/shared/domain/result.js";
import { makeUnlockedVault } from "../../../../../src/testing/test-vault.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createImportHandlers, IMPORT_BUSY_RETRY_ATTEMPTS } from "./import-handlers.js";

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

/** A two-conversation valija generic-format export — used where a fixture with more than one conversation matters (item 74). */
function twoConversationGenericExport(): string {
  return JSON.stringify({
    valija_import_version: 1,
    conversations: [
      {
        id: "conv-1",
        title: "First chat",
        createdAt: "2024-05-01T09:00:00Z",
        messages: [
          { role: "user", content: "Hello there." },
          { role: "assistant", content: "Hi! How can I help?" },
        ],
      },
      {
        id: "conv-2",
        title: "Second chat",
        createdAt: "2024-05-02T09:00:00Z",
        messages: [
          { role: "user", content: "Another question." },
          { role: "assistant", content: "Sure, go ahead." },
        ],
      },
    ],
  });
}

/** A real, curated (non-imported) item — the baseline a project's pack should still show after an unrelated import. */
function seedCuratedItem(vault: ReturnType<typeof makeUnlockedVault>, projectName: string): void {
  const name = parseProjectName(projectName);
  const content = parseContent("A curated decision, made by a person.");
  if (!name.ok || !content.ok) throw new Error("bad test fixture");
  vault.sessions.withSession((session) =>
    session.write(() => {
      const project = {
        id: vault.idGen.next(),
        name: name.value,
        createdAt: vault.clock.now(),
        updatedAt: vault.clock.now(),
      };
      session.projects.save(project);
      session.items.save(
        createContextItem({
          id: vault.idGen.next(),
          projectId: project.id,
          type: "decision",
          content: content.value,
          tags: [],
          pinned: false,
          now: vault.clock.now(),
        }),
      );
      return ok(undefined);
    }),
  );
}

function realImportContainer(vault: ReturnType<typeof makeUnlockedVault>): Container {
  return {
    paths: vault.paths,
    importConversations: new ImportConversations(
      new FileExportReader(),
      parserRegistry,
      new ImportItems(vault.sessions, vault.clock, vault.idGen),
      vault.clock,
    ),
    // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
  } as any as Container;
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

  it("import:list fails to auto-detect a generic-format export, and only succeeds once `from` overrides it (§9 item 72)", () => {
    const filePath = join(tmp, "generic-export.json");
    writeFileSync(filePath, twoConversationGenericExport(), "utf8");

    const vault = makeUnlockedVault();
    const handlers = createImportHandlers(
      () => realImportContainer(vault),
      fakeFilePicker({ "fh-generic": filePath }),
    );

    const undetected = handlers["import:list"]({ handle: "fh-generic" });
    expect(!undetected.ok && undetected.error.code).toBe("UNSUPPORTED_SOURCE");

    const overridden = handlers["import:list"]({ handle: "fh-generic", from: "generic" });
    expect(overridden.ok).toBe(true);
    if (overridden.ok) expect(overridden.value.listing).toHaveLength(2);
  });

  it("one import:run call for N conversations bumps the lineage generation exactly once (§9 item 74)", async () => {
    const filePath = join(tmp, "two-conversations.json");
    writeFileSync(filePath, twoConversationGenericExport(), "utf8");
    const warmupPath = join(tmp, "warmup.json");
    writeFileSync(
      warmupPath,
      JSON.stringify({
        valija_import_version: 1,
        conversations: [
          {
            id: "warmup",
            title: "Warmup",
            createdAt: "2024-01-01T00:00:00Z",
            messages: [{ role: "user", content: "warmup" }],
          },
        ],
      }),
      "utf8",
    );

    const vault = makeUnlockedVault();
    const handlers = createImportHandlers(
      () => realImportContainer(vault),
      fakeFilePicker({ "fh-two": filePath, "fh-warmup": warmupPath }),
    );

    // A generation of 0 is itself a real, meaningful "one bump happened" value
    // (the store's first bump on a fresh vault) — not distinguishable from
    // "no bump yet" via `?? 0`. A throwaway warmup write establishes a real
    // baseline generation to diff against, rather than assuming one.
    await handlers["import:run"]({
      handle: "fh-warmup",
      projectName: "warmup-project",
      all: true,
      from: "generic",
    });
    const before = vault.deviceIdentity.lastSeen(vault.vaultId)?.generation;
    expect(before).toBeDefined();

    const result = await handlers["import:run"]({
      handle: "fh-two",
      projectName: "imported-chats",
      all: true,
      from: "generic",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.conversations).toBe(2);
      expect(result.value.imported).toBeGreaterThan(0);
    }
    const after = vault.deviceIdentity.lastSeen(vault.vaultId)?.generation;
    expect(after).toBeDefined();
    expect((after as number) - (before as number)).toBe(1);
  });

  it("import:run reads the file directly — no temp file is written for the import itself", async () => {
    const isolatedDir = mkdtempSync(join(tmpdir(), "valija-import-no-temp-"));
    const filePath = join(isolatedDir, "export.json");
    writeFileSync(filePath, twoConversationGenericExport(), "utf8");

    const vault = makeUnlockedVault();
    const handlers = createImportHandlers(
      () => realImportContainer(vault),
      fakeFilePicker({ "fh-notemp": filePath }),
    );
    await handlers["import:run"]({
      handle: "fh-notemp",
      projectName: "p",
      all: true,
      from: "generic",
    });

    expect(readdirSync(isolatedDir)).toEqual(["export.json"]);
    rmSync(isolatedDir, { recursive: true, force: true });
  });

  it("a project's context pack content is unchanged by an import into that same project (§9 item 76)", async () => {
    const filePath = join(tmp, "pack-unchanged.json");
    writeFileSync(filePath, twoConversationGenericExport(), "utf8");

    const vault = makeUnlockedVault();
    seedCuratedItem(vault, "notes");
    const getContextPack = new GetContextPack(vault.sessions, vault.clock);

    const before = getContextPack.execute({ project: "notes" });
    expect(before.ok).toBe(true);

    const handlers = createImportHandlers(
      () => realImportContainer(vault),
      fakeFilePicker({ "fh-pack": filePath }),
    );
    const imported = await handlers["import:run"]({
      handle: "fh-pack",
      projectName: "notes",
      all: true,
      from: "generic",
    });
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value.imported).toBeGreaterThan(0);

    const after = getContextPack.execute({ project: "notes" });
    expect(after.ok).toBe(true);
    // The pack's *sections* — what a user would actually paste — are exactly
    // unchanged: no imported item joins a section. `totalCount` legitimately
    // grows (it counts every item in the project, imported or not — an
    // honest number, not a leak) so the two full packs are not compared as a
    // whole; the sections are the property item 76 actually cares about.
    if (before.ok && after.ok) expect(after.value.sections).toEqual(before.value.sections);
  });

  it("import:run retries a SQLITE_BUSY throw a bounded number of times, then succeeds if it clears", async () => {
    let calls = 0;
    const container = {
      paths: { root: tmp, header: "", db: "" },
      importConversations: {
        execute: vi.fn(() => {
          calls += 1;
          if (calls <= IMPORT_BUSY_RETRY_ATTEMPTS) {
            throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
          }
          return ok({ imported: 1, conversations: 1, skipped: 0, failed: 0, failures: [] });
        }),
      },
      // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
    } as any as Container;

    const handlers = createImportHandlers(() => container, fakeFilePicker({ "fh-busy": "/x" }));
    const result = await handlers["import:run"]({ handle: "fh-busy", projectName: "p" });

    expect(calls).toBe(IMPORT_BUSY_RETRY_ATTEMPTS + 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.imported).toBe(1);
  });

  it("import:run gives up after exhausting the retries, surfacing a typed code — never a raw SQLite string", async () => {
    const container = {
      paths: { root: tmp, header: "", db: "" },
      importConversations: {
        execute: vi.fn(() => {
          throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
        }),
      },
      // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
    } as any as Container;

    const handlers = createImportHandlers(() => container, fakeFilePicker({ "fh-busy": "/x" }));
    const result = await handlers["import:run"]({ handle: "fh-busy", projectName: "p" });

    expect(container.importConversations.execute).toHaveBeenCalledTimes(
      IMPORT_BUSY_RETRY_ATTEMPTS + 1,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("STORAGE_ERROR");
  });

  it("a non-busy throw is never retried, and still never surfaces a raw message", async () => {
    const container = {
      paths: { root: tmp, header: "", db: "" },
      importConversations: {
        execute: vi.fn(() => {
          throw new Error("something else entirely");
        }),
      },
      // biome-ignore lint/suspicious/noExplicitAny: only importConversations is exercised here
    } as any as Container;

    const handlers = createImportHandlers(() => container, fakeFilePicker({ "fh-other": "/x" }));
    const result = await handlers["import:run"]({ handle: "fh-other", projectName: "p" });

    expect(container.importConversations.execute).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("STORAGE_ERROR");
  });
});
