import { describe, expect, it } from "vitest";
import { partitionPinnedItems } from "./pinned-partition.js";

interface Row {
  id: string;
  pinned: boolean;
}

function row(id: string, pinned: boolean): Row {
  return { id, pinned };
}

describe("partitionPinnedItems", () => {
  it("empty input: both groups empty", () => {
    expect(partitionPinnedItems<Row>([])).toEqual({ pinned: [], rest: [] });
  });

  it("all pinned: every item in pinned, rest empty, relative order preserved", () => {
    const items = [row("a", true), row("b", true), row("c", true)];
    expect(partitionPinnedItems(items)).toEqual({ pinned: items, rest: [] });
  });

  it("none pinned: every item in rest, pinned empty, relative order preserved", () => {
    const items = [row("a", false), row("b", false), row("c", false)];
    expect(partitionPinnedItems(items)).toEqual({ pinned: [], rest: items });
  });

  it("mixed: a stable partition, not a re-sort — relative order inside each group matches arrival order", () => {
    const items = [
      row("a", false),
      row("b", true),
      row("c", false),
      row("d", true),
      row("e", false),
    ];
    const result = partitionPinnedItems(items);
    expect(result.pinned.map((r) => r.id)).toEqual(["b", "d"]);
    expect(result.rest.map((r) => r.id)).toEqual(["a", "c", "e"]);
  });
});
