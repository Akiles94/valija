import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { GetContextPack } from "./get-context-pack.use-case.js";
import { type ImportedItemInput, ImportItems } from "./import-items.use-case.js";
import { SearchContext } from "./search-context.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock(new Date("2026-07-17T12:00:00Z"));
const importItems = new ImportItems(vault.sessions, clock, new SeqIds());
const show = new ShowProject(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const draft = (chunkIndex: number, content: string): ImportedItemInput => ({
  source: "chatgpt",
  conversationId: "conv-1",
  chunkIndex,
  content,
  createdAt: new Date("2024-03-15T00:00:00Z"),
  tags: ["imported", "chatgpt"],
});

describe("ImportItems", () => {
  it("imports chunks into an auto-created project, preserving the historical date", () => {
    const r = importItems.execute({
      projectName: "history",
      items: [draft(0, "**User:** one"), draft(1, "**User:** two")],
    });
    expect(r.ok && r.value).toMatchObject({ projectCreated: true, imported: 2, failed: 0 });

    const shown = show.execute({ project: "history", type: "imported" });
    expect(shown.ok && shown.value).toHaveLength(2);
    if (!shown.ok) return;
    const item = shown.value[0];
    expect(item?.type).toBe("imported");
    expect(item?.createdAt).toBe("2024-03-15T00:00:00.000Z");
    expect(item?.tags).toEqual(["imported", "chatgpt"]);
    expect(item?.source).toBe("chatgpt-import");
  });

  it("upserts on re-import, never duplicating", () => {
    const items = [draft(0, "a"), draft(1, "b")];
    importItems.execute({ projectName: "dup", items });
    importItems.execute({ projectName: "dup", items });
    const shown = show.execute({ project: "dup", type: "imported" });
    expect(shown.ok && shown.value).toHaveLength(2); // still 2, not 4
  });

  it("excludes imported items from a context pack", () => {
    importItems.execute({
      projectName: "packless",
      items: [draft(0, "**User:** secret imported note")],
    });
    const pack = new GetContextPack(vault.sessions, clock).execute({ project: "packless" });
    expect(pack.ok).toBe(true);
    if (pack.ok) {
      expect(pack.value.includedCount).toBe(0);
      expect(pack.value.sections).toEqual([]);
    }
  });

  it("returns imported items from search", () => {
    importItems.execute({
      projectName: "searchable",
      items: [draft(0, "**User:** kubernetes ingress")],
    });
    const hits = new SearchContext(vault.sessions).execute({ query: "kubernetes" });
    expect(hits.ok).toBe(true);
    if (hits.ok) expect(hits.value.some((hit) => hit.type === "imported")).toBe(true);
  });

  it("collects a chunk that fails validation as a failure, never throwing", () => {
    const tooBig = "x".repeat(40 * 1024); // over the 32 KB content limit
    const r = importItems.execute({
      projectName: "failing",
      items: [draft(0, tooBig), draft(1, "ok")],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.imported).toBe(1);
    expect(r.value.failed).toBe(1);
    expect(r.value.failures[0]?.conversationId).toBe("conv-1");
  });

  it("fails with VAULT_LOCKED when the vault is locked", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = importItems.execute({ projectName: "locked", items: [draft(0, "x")] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});
