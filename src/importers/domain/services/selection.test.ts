import { describe, expect, it } from "vitest";
import type { Conversation } from "../entities/conversation.js";
import { parsePickSpec, selectConversations } from "./selection.js";

const convo = (id: string, title: string, date: string): Conversation => ({
  id,
  title,
  createdAt: new Date(date),
  messages: [],
});

const list: Conversation[] = [
  convo("a", "Alpha planning", "2024-01-01"),
  convo("b", "Beta notes", "2024-02-01"),
  convo("c", "Gamma review", "2024-03-01"),
  convo("d", "Delta alpha", "2024-04-01"),
];

describe("parsePickSpec", () => {
  it("parses indices and ranges into sorted, unique, 0-based indices", () => {
    const r = parsePickSpec("1,3-4", 4);
    expect(r.ok && r.value).toEqual([0, 2, 3]);
  });

  it("dedupes overlapping picks", () => {
    const r = parsePickSpec("1,1,1", 4);
    expect(r.ok && r.value).toEqual([0]);
  });

  it("rejects a non-numeric token", () => {
    const r = parsePickSpec("1,abc", 4);
    expect(!r.ok && r.error.code).toBe("INVALID_SELECTION");
  });

  it("rejects an out-of-range index", () => {
    const r = parsePickSpec("9", 4);
    expect(!r.ok && r.error.code).toBe("INVALID_SELECTION");
  });

  it("rejects a reversed range", () => {
    const r = parsePickSpec("3-1", 4);
    expect(!r.ok && r.error.code).toBe("INVALID_SELECTION");
  });
});

describe("selectConversations", () => {
  it("picks by index against the full printed order", () => {
    const r = selectConversations(list, { pick: "1,3" });
    expect(r.ok && r.value.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("filters by case-insensitive title query", () => {
    const r = selectConversations(list, { query: "alpha" });
    expect(r.ok && r.value.map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("filters by since date, inclusive", () => {
    const r = selectConversations(list, { since: "2024-03-01" });
    expect(r.ok && r.value.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("keeps everything with --all", () => {
    const r = selectConversations(list, { all: true });
    expect(r.ok && r.value).toHaveLength(4);
  });

  it("rejects an invalid since date", () => {
    const r = selectConversations(list, { since: "not-a-date" });
    expect(!r.ok && r.error.code).toBe("INVALID_SELECTION");
  });

  it("errors when nothing matches", () => {
    const r = selectConversations(list, { query: "nonexistent" });
    expect(!r.ok && r.error.code).toBe("NO_CONVERSATIONS_SELECTED");
  });
});
