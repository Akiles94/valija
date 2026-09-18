import { describe, expect, it } from "vitest";
import { nextTabId } from "./tab-navigation.js";

const IDS = ["a", "b", "c"] as const;

describe("nextTabId (ARIA APG roving focus)", () => {
  it("ArrowRight moves to the next tab", () => {
    expect(nextTabId(IDS, "a", "ArrowRight")).toBe("b");
  });

  it("ArrowDown moves to the next tab", () => {
    expect(nextTabId(IDS, "a", "ArrowDown")).toBe("b");
  });

  it("ArrowLeft moves to the previous tab", () => {
    expect(nextTabId(IDS, "b", "ArrowLeft")).toBe("a");
  });

  it("ArrowUp moves to the previous tab", () => {
    expect(nextTabId(IDS, "b", "ArrowUp")).toBe("a");
  });

  it("Home jumps to the first tab", () => {
    expect(nextTabId(IDS, "c", "Home")).toBe("a");
  });

  it("End jumps to the last tab", () => {
    expect(nextTabId(IDS, "a", "End")).toBe("c");
  });

  it("wraps forward past the last tab", () => {
    expect(nextTabId(IDS, "c", "ArrowRight")).toBe("a");
  });

  it("wraps backward past the first tab", () => {
    expect(nextTabId(IDS, "a", "ArrowLeft")).toBe("c");
  });

  it("an unrelated key is a no-op", () => {
    expect(nextTabId(IDS, "b", "Enter")).toBe("b");
    expect(nextTabId(IDS, "b", "a")).toBe("b");
  });

  it("a single-tab list always returns that tab, for every key", () => {
    const single = ["only"] as const;
    expect(nextTabId(single, "only", "ArrowRight")).toBe("only");
    expect(nextTabId(single, "only", "ArrowLeft")).toBe("only");
    expect(nextTabId(single, "only", "Home")).toBe("only");
    expect(nextTabId(single, "only", "End")).toBe("only");
  });
});
