import { describe, expect, it } from "vitest";
import type { Content } from "../values/content.js";
import type { Tag } from "../values/tag.js";
import { createContextItem, createImportedContextItem, importedItemId } from "./context-item.js";

const now = new Date("2026-07-11T12:00:00Z");

const base = {
  id: "01ITEM0001",
  projectId: "01PROJ0001",
  type: "decision" as const,
  content: "we chose SQLCipher" as Content,
  tags: ["db"] as Tag[],
  pinned: false,
  now,
};

describe("createContextItem", () => {
  it("stamps both timestamps from the same instant and starts unarchived", () => {
    const item = createContextItem(base);
    expect(item.archived).toBe(false);
    expect(item.createdAt).toBe(now);
    expect(item.updatedAt).toBe(now);
  });

  it("carries the parsed values through untouched", () => {
    const item = createContextItem({ ...base, pinned: true });
    expect(item).toMatchObject({
      id: "01ITEM0001",
      projectId: "01PROJ0001",
      type: "decision",
      content: "we chose SQLCipher",
      tags: ["db"],
      pinned: true,
    });
  });

  it("omits source entirely when there is none", () => {
    expect("source" in createContextItem(base)).toBe(false);
    expect(createContextItem({ ...base, source: "claude-code" }).source).toBe("claude-code");
  });
});

describe("importedItemId", () => {
  it("is deterministic for the same project, source, conversation, and chunk", () => {
    expect(importedItemId("p1", "chatgpt", "conv-1", 0)).toBe(
      importedItemId("p1", "chatgpt", "conv-1", 0),
    );
  });

  it("differs across project, source, conversation, or chunk", () => {
    const id = importedItemId("p1", "chatgpt", "conv-1", 0);
    expect(importedItemId("p2", "chatgpt", "conv-1", 0)).not.toBe(id); // same conversation, other project
    expect(importedItemId("p1", "claude", "conv-1", 0)).not.toBe(id);
    expect(importedItemId("p1", "chatgpt", "conv-2", 0)).not.toBe(id);
    expect(importedItemId("p1", "chatgpt", "conv-1", 1)).not.toBe(id);
  });

  it("is an imp- prefixed hex id", () => {
    expect(importedItemId("p1", "chatgpt", "c", 0)).toMatch(/^imp-[0-9a-f]{32}$/);
  });
});

describe("createImportedContextItem", () => {
  const importedBase = {
    projectId: "01PROJ0001",
    source: "chatgpt",
    conversationId: "conv-1",
    chunkIndex: 0,
    content: "**User:** hi" as Content,
    tags: ["imported", "chatgpt"] as Tag[],
    createdAt: new Date("2024-03-15T00:00:00Z"),
    now: new Date("2026-07-17T12:00:00Z"),
  };

  it("keeps the historical createdAt but stamps updatedAt at import time", () => {
    const item = createImportedContextItem(importedBase);
    expect(item.createdAt).toEqual(new Date("2024-03-15T00:00:00Z"));
    expect(item.updatedAt).toEqual(new Date("2026-07-17T12:00:00Z"));
  });

  it("is imported, never pinned, unarchived, with a '<source>-import' source", () => {
    const item = createImportedContextItem(importedBase);
    expect(item.type).toBe("imported");
    expect(item.pinned).toBe(false);
    expect(item.archived).toBe(false);
    expect(item.source).toBe("chatgpt-import");
  });

  it("derives its id deterministically from project/source/conversation/chunk", () => {
    expect(createImportedContextItem(importedBase).id).toBe(
      importedItemId("01PROJ0001", "chatgpt", "conv-1", 0),
    );
  });
});
