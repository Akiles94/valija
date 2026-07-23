import { describe, expect, it } from "vitest";
import { GENERATION_ZERO, nextGeneration, parseGeneration } from "./generation.js";

describe("generation", () => {
  it("accepts a non-negative integer, string or number", () => {
    expect(parseGeneration("0").ok).toBe(true);
    expect(parseGeneration(42).ok).toBe(true);
  });

  it("rejects negative, fractional, or non-numeric values", () => {
    expect(parseGeneration("-1").ok).toBe(false);
    expect(parseGeneration("1.5").ok).toBe(false);
    expect(parseGeneration("abc").ok).toBe(false);
  });

  it("starts at zero and increments by one", () => {
    expect(GENERATION_ZERO).toBe(0);
    expect(nextGeneration(GENERATION_ZERO)).toBe(1);
  });
});
