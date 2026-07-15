import { describe, expect, it } from "vitest";
import type { Content } from "../values/content.js";
import type { Tag } from "../values/tag.js";
import { createContextItem } from "./context-item.js";

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
