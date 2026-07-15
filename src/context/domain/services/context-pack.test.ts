import { describe, expect, it } from "vitest";
import type { ContextItem } from "../entities/context-item.js";
import type { Content } from "../values/content.js";
import type { ItemType } from "../values/item-type.js";
import type { ProjectName } from "../values/project-name.js";
import type { Tag } from "../values/tag.js";
import {
  assembleContextPack,
  type ContextPack,
  DEFAULT_BUDGET_TOKENS,
  estimateTokens,
  type PackSection,
} from "./context-pack.js";

const projectName = "packable" as ProjectName;
const generatedAt = new Date("2026-07-11T12:00:00Z");

let seq = 0;
const item = (
  content: string,
  overrides: { type?: ItemType; pinned?: boolean; minutes?: number } = {},
): ContextItem => {
  seq++;
  const at = new Date(Date.UTC(2026, 6, 11, 12, overrides.minutes ?? seq));
  return {
    id: `01ITEM${String(seq).padStart(4, "0")}`,
    projectId: "01PROJ0001",
    type: overrides.type ?? "decision",
    content: content as Content,
    tags: [] as Tag[],
    pinned: overrides.pinned ?? false,
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
};

/** Newest first — the repository contract assembleContextPack relies on. */
const newestFirst = (items: ContextItem[]): ContextItem[] =>
  [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

const assemble = (items: ContextItem[], budgetTokens?: number): ContextPack =>
  assembleContextPack({
    projectName,
    items: newestFirst(items),
    generatedAt,
    ...(budgetTokens === undefined ? {} : { budgetTokens }),
  });

const kinds = (pack: ContextPack): string[] =>
  pack.sections.map((s: PackSection) => (s.kind === "by-type" ? s.type : s.kind));

const contentsOf = (pack: ContextPack): string[] =>
  pack.sections.flatMap((s) => s.items.map((i) => i.content as string));

describe("assembleContextPack", () => {
  it("orders sections: pinned, latest handoff, then types in reading order", () => {
    const pack = assemble([
      item("old decision alpha", { type: "decision", minutes: 1 }),
      item("new decision beta", { type: "decision", minutes: 2 }),
      item("the compass", { type: "preference", pinned: true, minutes: 3 }),
      item("continue at restore flow", { type: "handoff", minutes: 4 }),
      item("a plain fact", { type: "fact", minutes: 5 }),
    ]);

    expect(kinds(pack)).toEqual(["pinned", "latest-handoff", "decision", "fact"]);
    expect(pack.includedCount).toBe(5);
    expect(pack.totalCount).toBe(5);
  });

  it("orders items newest first inside a section", () => {
    const pack = assemble([
      item("older", { type: "decision", minutes: 1 }),
      item("newer", { type: "decision", minutes: 2 }),
    ]);
    expect(contentsOf(pack)).toEqual(["newer", "older"]);
  });

  it("never repeats an item across sections", () => {
    const pack = assemble([
      item("pinned handoff", { type: "handoff", pinned: true, minutes: 1 }),
      item("a decision", { type: "decision", minutes: 2 }),
    ]);
    const ids = pack.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(kinds(pack)).toEqual(["pinned", "decision"]);
  });

  it("stops adding unpinned items when the budget is spent", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      item(`decision number ${i} ${"x".repeat(380)}`, { type: "decision", minutes: i + 1 }),
    );
    const pack = assemble(items, 500);

    expect(pack.includedCount).toBeGreaterThan(0);
    expect(pack.includedCount).toBeLessThan(30);
    expect(pack.estimatedTokens).toBeLessThanOrEqual(500);
    // Newest survive the cut.
    expect(contentsOf(pack)[0]).toContain("decision number 29");
  });

  it("keeps the newest pinned item even when it alone blows the budget", () => {
    const pack = assemble(
      [
        item(`oldest pinned ${"y".repeat(800)}`, { type: "fact", pinned: true, minutes: 1 }),
        item(`newest pinned ${"z".repeat(800)}`, { type: "fact", pinned: true, minutes: 2 }),
      ],
      100,
    );
    const contents = contentsOf(pack);
    expect(contents.some((c) => c.startsWith("newest pinned"))).toBe(true);
    expect(contents.some((c) => c.startsWith("oldest pinned"))).toBe(false);
  });

  it("includes everything when no budget is given, where the default would cut", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      item(`decision number ${i} ${"x".repeat(800)}`, { type: "decision", minutes: i + 1 }),
    );
    const budgeted = assemble(items, DEFAULT_BUDGET_TOKENS);
    const unbounded = assemble(items);

    expect(budgeted.includedCount).toBeLessThan(30);
    expect(unbounded.includedCount).toBe(30);
    expect(unbounded.estimatedTokens).toBeGreaterThan(DEFAULT_BUDGET_TOKENS);
  });

  it("handles a project with no items", () => {
    const pack = assemble([]);
    expect(pack.sections).toEqual([]);
    expect(pack.includedCount).toBe(0);
    expect(pack.totalCount).toBe(0);
  });

  it("estimates ~4 characters per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(DEFAULT_BUDGET_TOKENS).toBe(4000);
  });
});
