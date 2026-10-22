import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { ImportItems } from "./import-items.use-case.js";
import { SaveContext } from "./save-context.use-case.js";
import { SetItemArchived } from "./set-item-archived.use-case.js";
import { SetItemPinned } from "./set-item-pinned.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const save = new SaveContext(vault.sessions, clock, ids);
const pin = new SetItemPinned(vault.sessions, clock);
const archive = new SetItemArchived(vault.sessions, clock);
const show = new ShowProject(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const saved = (content: string, project = "pins") => {
  const r = save.execute({ project, content, type: "decision" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);

describe("SetItemPinned", () => {
  it("pins an item with one lineage bump and advances updatedAt", () => {
    const id = saved("pin me");
    const before = generation();
    clock.advanceMinutes(5);
    const r = pin.execute({ item: id, pinned: true });
    expect(r.ok && r.value).toEqual({
      itemId: id,
      project: "pins",
      type: "decision",
      changed: true,
    });
    expect(generation()).toBe(before + 1);
    const shown = show.execute({ project: "pins" });
    expect(shown.ok && shown.value.find((v) => v.id === id)?.pinned).toBe(true);
  });

  it("reports a repeat pin as unchanged, with no lineage bump", () => {
    const id = saved("pin twice");
    pin.execute({ item: id, pinned: true });
    const before = generation();
    const r = pin.execute({ item: id, pinned: true });
    expect(r.ok && r.value.changed).toBe(false);
    expect(generation()).toBe(before);
  });

  it("resolves a unique prefix", () => {
    const id = saved("by prefix", "prefix-only");
    const r = pin.execute({ item: id.toLowerCase(), pinned: true });
    expect(r.ok && r.value.itemId).toBe(id);
  });

  it("refuses an ambiguous prefix, naming the candidates, with no bump", () => {
    const first = saved("one");
    const second = saved("two");
    const before = generation();
    const r = pin.execute({ item: "01SEQ0", pinned: true });
    expect(codeOf(r)).toBe("ITEM_ID_AMBIGUOUS");
    expect(!r.ok && r.error.message).toContain(first.slice(0, 6));
    expect(second).toBeDefined();
    expect(generation()).toBe(before);
  });

  it("reports an unknown reference as ITEM_NOT_FOUND", () => {
    expect(codeOf(pin.execute({ item: "01ZZZZZZZZ", pinned: true }))).toBe("ITEM_NOT_FOUND");
  });

  it("rejects a malformed reference before opening a session", () => {
    vault.keychain.deleteKey(vault.vaultId);
    expect(codeOf(pin.execute({ item: "abc", pinned: true }))).toBe("INVALID_ITEM_ID");
    expect(codeOf(pin.execute({ item: "01SEQ000001", pinned: true }))).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("refuses an archived item with no bump", () => {
    const id = saved("archived first");
    archive.execute({ item: id, archived: true });
    const before = generation();
    expect(codeOf(pin.execute({ item: id, pinned: true }))).toBe("ITEM_ARCHIVED");
    expect(generation()).toBe(before);
  });

  it("refuses an imported item", () => {
    new ImportItems(vault.sessions, clock, ids).execute({
      projectName: "imports",
      items: [
        {
          source: "chatgpt",
          conversationId: "c1",
          chunkIndex: 0,
          content: "imported chunk",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          tags: [],
        },
      ],
    });
    const shown = show.execute({ project: "imports" });
    const id = shown.ok ? shown.value[0]?.id : undefined;
    if (id === undefined) throw new Error("expected the imported item");
    expect(codeOf(pin.execute({ item: id, pinned: true }))).toBe("ITEM_NOT_CURATABLE");
  });
});
