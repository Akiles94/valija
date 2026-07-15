import { describe, expect, it } from "vitest";
import type { ContextItem } from "../context/domain/entities/context-item.js";
import { assembleContextPack } from "../context/domain/services/context-pack.js";
import type { Content } from "../context/domain/values/content.js";
import type { ItemType } from "../context/domain/values/item-type.js";
import type { ProjectName } from "../context/domain/values/project-name.js";
import type { Tag } from "../context/domain/values/tag.js";
import { renderContextPackMarkdown } from "./context-pack-markdown.js";

const generatedAt = new Date("2026-07-11T12:00:00Z");

let seq = 0;
const item = (
  content: string,
  overrides: { type?: ItemType; pinned?: boolean; tags?: string[]; minutes?: number } = {},
): ContextItem => {
  seq++;
  const at = new Date(Date.UTC(2026, 6, 11, 12, overrides.minutes ?? seq));
  return {
    id: `01ITEM${String(seq).padStart(4, "0")}`,
    projectId: "01PROJ0001",
    type: overrides.type ?? "decision",
    content: content as Content,
    tags: (overrides.tags ?? []) as Tag[],
    pinned: overrides.pinned ?? false,
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
};

const render = (items: ContextItem[]): string =>
  renderContextPackMarkdown(
    assembleContextPack({
      projectName: "renderable" as ProjectName,
      items: [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      generatedAt,
    }),
  );

describe("renderContextPackMarkdown", () => {
  it("opens with the project header and the vault total", () => {
    const md = render([item("solo item", { type: "fact" })]);
    expect(md).toContain("# Context pack: renderable");
    expect(md).toContain("> 1 items in vault · generated 2026-07-11T12:00:00.000Z");
  });

  it("titles each section and keeps the domain's order", () => {
    const md = render([
      item("a decision", { type: "decision", minutes: 1 }),
      item("the compass", { type: "preference", pinned: true, minutes: 2 }),
      item("continue at restore flow", { type: "handoff", minutes: 3 }),
    ]);
    const iPinned = md.indexOf("## Pinned");
    const iHandoff = md.indexOf("## Latest handoff");
    const iDecisions = md.indexOf("## Decisions");
    expect(iPinned).toBeGreaterThan(-1);
    expect(iHandoff).toBeGreaterThan(iPinned);
    expect(iDecisions).toBeGreaterThan(iHandoff);
  });

  it("renders an item as a heading of type · date · tags, then its body", () => {
    const md = render([
      item("we chose sqlcipher", { type: "decision", tags: ["db", "crypto"], minutes: 1 }),
    ]);
    expect(md).toContain("### decision · 2026-07-11 · #db #crypto\n\nwe chose sqlcipher");
  });

  it("omits the tag run when an item has no tags", () => {
    const md = render([item("untagged", { type: "fact", minutes: 1 })]);
    expect(md).toContain("### fact · 2026-07-11\n\nuntagged");
  });

  it("renders a header-only pack when the project is empty", () => {
    const md = render([]);
    expect(md).toContain("# Context pack: renderable");
    expect(md).not.toContain("##");
  });
});
