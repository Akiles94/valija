import { describe, expect, it } from "vitest";
import { selectedHit } from "./search-selection.js";

interface Hit {
  id: string;
}

describe("selectedHit", () => {
  it("empty hits: null", () => {
    expect(selectedHit<Hit>([], null)).toBeNull();
  });

  it("selectedId === null: the first hit", () => {
    const hits = [{ id: "a" }, { id: "b" }];
    expect(selectedHit(hits, null)).toEqual({ id: "a" });
  });

  it("stale id (not in the current hits): falls back to the first hit", () => {
    const hits = [{ id: "a" }, { id: "b" }];
    expect(selectedHit(hits, "gone")).toEqual({ id: "a" });
  });

  it("matching id: that hit", () => {
    const hits = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(selectedHit(hits, "b")).toEqual({ id: "b" });
  });

  it("single hit: that hit, regardless of selectedId", () => {
    const hits = [{ id: "only" }];
    expect(selectedHit(hits, null)).toEqual({ id: "only" });
    expect(selectedHit(hits, "only")).toEqual({ id: "only" });
  });
});
