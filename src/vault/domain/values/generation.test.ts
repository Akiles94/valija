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

  it("rejects blanks and non-decimal notations Number() would otherwise coerce", () => {
    expect(parseGeneration("").ok).toBe(false); // Number("") === 0
    expect(parseGeneration("   ").ok).toBe(false); // Number("  ") === 0
    expect(parseGeneration("0x10").ok).toBe(false); // Number("0x10") === 16
    expect(parseGeneration("1e3").ok).toBe(false); // Number("1e3") === 1000
  });

  it("starts at zero and increments by one", () => {
    expect(GENERATION_ZERO).toBe(0);
    expect(nextGeneration(GENERATION_ZERO)).toBe(1);
  });
});
