import { describe, expect, it } from "vitest";
import { MIN_PASSPHRASE_LENGTH, parsePassphrase } from "./passphrase.js";

describe("Passphrase", () => {
  it("accepts a passphrase at or over the minimum length", () => {
    expect(parsePassphrase("a".repeat(MIN_PASSPHRASE_LENGTH)).ok).toBe(true);
    expect(parsePassphrase("correct horse battery staple").ok).toBe(true);
  });

  it("rejects anything shorter", () => {
    const r = parsePassphrase("a".repeat(MIN_PASSPHRASE_LENGTH - 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WEAK_PASSPHRASE");
  });

  it("preserves the passphrase verbatim — surrounding spaces are entropy", () => {
    const r = parsePassphrase("  spaced out  ");
    expect(r.ok && r.value).toBe("  spaced out  ");
  });
});
