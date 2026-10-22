import { describe, expect, it } from "vitest";
import type { ContextItem } from "../entities/context-item.js";
import type { Content } from "../values/content.js";
import type { Tag } from "../values/tag.js";
import { applyEdit, archiveSuperseded, setArchived, setPinned } from "./item-curation.js";

const created = new Date("2026-07-01T00:00:00Z");
const now = new Date("2026-10-17T12:00:00Z");

const item: ContextItem = {
  id: "01ITEM0001",
  projectId: "01PROJ0001",
  type: "decision",
  content: "we chose SQLCipher" as Content,
  tags: ["db", "crypto"] as Tag[],
  pinned: false,
  source: "claude-code",
  archived: false,
  createdAt: created,
  updatedAt: created,
};
const archived: ContextItem = { ...item, archived: true };
const imported: ContextItem = { ...item, id: "imp-0123456789abcdef", type: "imported" };

const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);

describe("setPinned", () => {
  it("pins an unpinned item and stamps updatedAt", () => {
    const r = setPinned(item, true, now);
    expect(r.ok && r.value).toEqual({
      item: { ...item, pinned: true, updatedAt: now },
      changed: true,
    });
  });

  it("reports a no-op when the item is already pinned", () => {
    const pinned = { ...item, pinned: true };
    const r = setPinned(pinned, true, now);
    expect(r.ok && r.value).toEqual({ item: pinned, changed: false });
  });

  it("refuses to pin an archived item", () => {
    expect(codeOf(setPinned(archived, true, now))).toBe("ITEM_ARCHIVED");
  });

  it("refuses to pin an imported item", () => {
    expect(codeOf(setPinned(imported, true, now))).toBe("ITEM_NOT_CURATABLE");
  });

  it("checks rejections before no-ops: an archived, already-pinned item is ITEM_ARCHIVED", () => {
    expect(codeOf(setPinned({ ...archived, pinned: true }, true, now))).toBe("ITEM_ARCHIVED");
  });

  it("unpins anything that exists, archived or imported", () => {
    for (const target of [
      { ...archived, pinned: true },
      { ...imported, pinned: true },
    ]) {
      const r = setPinned(target, false, now);
      expect(r.ok && r.value.changed).toBe(true);
      expect(r.ok && r.value.item.pinned).toBe(false);
    }
  });
});

describe("setArchived", () => {
  it("archives and keeps the pin", () => {
    const r = setArchived({ ...item, pinned: true }, true, now);
    expect(r).toEqual({
      item: { ...item, pinned: true, archived: true, updatedAt: now },
      changed: true,
    });
  });

  it("unarchives and keeps the pin", () => {
    const r = setArchived({ ...archived, pinned: true }, false, now);
    expect(r.item).toMatchObject({ archived: false, pinned: true });
  });

  it("works on imported items", () => {
    expect(setArchived(imported, true, now).changed).toBe(true);
  });

  it("reports a no-op when the state already matches", () => {
    expect(setArchived(archived, true, now)).toEqual({ item: archived, changed: false });
  });
});

describe("applyEdit", () => {
  it.each([
    ["content", { content: "we chose libsodium" as Content }],
    ["tags", { tags: ["db"] as Tag[] }],
    ["type", { type: "fact" as const }],
  ])("changes %s alone and reports exactly that field", (field, edit) => {
    const r = applyEdit(item, edit, now);
    expect(r.ok && r.value.changedFields).toEqual([field]);
    expect(r.ok && r.value.item.updatedAt).toBe(now);
  });

  it("reports an empty change list for identical values", () => {
    const r = applyEdit(item, { content: item.content, tags: item.tags, type: "decision" }, now);
    expect(r.ok && r.value).toEqual({ item, changedFields: [] });
  });

  it("keeps id, createdAt, source and pinned", () => {
    const r = applyEdit({ ...item, pinned: true }, { content: "new" as Content }, now);
    expect(r.ok && r.value.item).toMatchObject({
      id: item.id,
      createdAt: created,
      source: "claude-code",
      pinned: true,
    });
  });

  it("counts a reordered tag list as a change", () => {
    const r = applyEdit(item, { tags: ["crypto", "db"] as Tag[] }, now);
    expect(r.ok && r.value.changedFields).toEqual(["tags"]);
  });

  it("refuses archived and imported items", () => {
    expect(codeOf(applyEdit(archived, { type: "fact" }, now))).toBe("ITEM_ARCHIVED");
    expect(codeOf(applyEdit(imported, { type: "fact" }, now))).toBe("ITEM_NOT_CURATABLE");
  });
});

describe("archiveSuperseded", () => {
  it("archives a healthy item and leaves pinned untouched", () => {
    const r = archiveSuperseded(item, now);
    expect(r.ok && r.value).toEqual({ ...item, archived: true, updatedAt: now });
  });

  it.each([
    ["ITEM_PINNED", { ...item, pinned: true }],
    ["ITEM_NOT_CURATABLE", imported],
    ["ITEM_ARCHIVED", archived],
  ])("refuses with %s", (code, target) => {
    expect(codeOf(archiveSuperseded(target, now))).toBe(code);
  });
});
