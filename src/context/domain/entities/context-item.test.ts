import { describe, expect, it } from "vitest";
import { MAX_CONTENT_BYTES, validateContent } from "./context-item.js";

describe("Content", () => {
  it("trims and accepts normal content", () => {
    const r = validateContent("  we chose SQLCipher  ");
    expect(r.ok && r.value).toBe("we chose SQLCipher");
  });

  it("rejects empty content", () => {
    const r = validateContent("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTENT_EMPTY");
  });

  it("rejects content over 32 KB (measured in bytes, not chars)", () => {
    const r = validateContent("ñ".repeat(MAX_CONTENT_BYTES / 2 + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONTENT_TOO_LARGE");
  });

  it("accepts content at exactly the limit", () => {
    expect(validateContent("a".repeat(MAX_CONTENT_BYTES)).ok).toBe(true);
  });
});
