import { describe, expect, it } from "vitest";
import { isLongContent, LONG_CONTENT_CHARS, LONG_CONTENT_NEWLINES } from "./long-content.js";

describe("isLongContent — character threshold", () => {
  it("exactly at the threshold is not long; one over is", () => {
    expect(isLongContent("a".repeat(LONG_CONTENT_CHARS))).toBe(false);
    expect(isLongContent("a".repeat(LONG_CONTENT_CHARS + 1))).toBe(true);
  });

  it("419/420/421 characters straddle the boundary as documented", () => {
    expect(isLongContent("a".repeat(419))).toBe(false);
    expect(isLongContent("a".repeat(420))).toBe(false);
    expect(isLongContent("a".repeat(421))).toBe(true);
  });
});

describe("isLongContent — newline threshold", () => {
  it("5 newlines is not long; 6 is, even with few characters", () => {
    expect(isLongContent("a\n".repeat(5))).toBe(false);
    expect(isLongContent("a\n".repeat(6))).toBe(true);
  });

  it("a short string with many newlines is long", () => {
    expect(isLongContent("\n".repeat(LONG_CONTENT_NEWLINES))).toBe(true);
  });
});

describe("isLongContent — edges", () => {
  it("the empty string is not long", () => {
    expect(isLongContent("")).toBe(false);
  });

  it("a plain one-sentence item is not long", () => {
    expect(isLongContent("Client wants CSV export by Friday.")).toBe(false);
  });
});
