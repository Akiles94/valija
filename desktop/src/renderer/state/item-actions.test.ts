import { describe, expect, it, vi } from "vitest";
import type { ValijaBridge } from "./bridge.js";
import { type ItemAction, itemActionsFor, performItemAction } from "./item-actions.js";

describe("itemActionsFor", () => {
  it.each([
    ["a live item", { type: "decision", pinned: false }, ["pin", "archive"]],
    ["a pinned item", { type: "decision", pinned: true }, ["unpin", "archive"]],
    ["an archived item", { type: "decision", pinned: false, archived: true }, ["unarchive"]],
    ["an archived, pinned item", { type: "fact", pinned: true, archived: true }, ["unarchive"]],
    ["an imported item", { type: "imported", pinned: false }, ["archive"]],
  ])("offers the right actions for %s", (_, item, expected) => {
    expect(itemActionsFor(item)).toEqual(expected);
  });
});

describe("performItemAction", () => {
  const changed = { ok: true as const, value: { changed: true } };
  const bridge = {
    content: { setPinned: vi.fn(async () => changed), setArchived: vi.fn(async () => changed) },
  } as unknown as ValijaBridge;

  it.each([
    ["pin", "setPinned", { id: "01A", pinned: true }],
    ["unpin", "setPinned", { id: "01A", pinned: false }],
    ["archive", "setArchived", { id: "01A", archived: true }],
    ["unarchive", "setArchived", { id: "01A", archived: false }],
  ] as const)("%s calls %s with the right flag", async (action, method, request) => {
    await expect(performItemAction(bridge, "01A", action as ItemAction)).resolves.toEqual(changed);
    expect(bridge.content[method]).toHaveBeenLastCalledWith(request);
  });
});
