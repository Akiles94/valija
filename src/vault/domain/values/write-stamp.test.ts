import { describe, expect, it } from "vitest";
import { createWriteStamp, parseWriteStamp } from "./write-stamp.js";

describe("write-stamp", () => {
  it("accepts a well-formed ULID", () => {
    expect(parseWriteStamp("01ARZ3NDEKTSV4RRFFQ69G5FAV").ok).toBe(true);
  });

  it("rejects a malformed value", () => {
    const result = parseWriteStamp("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_WRITE_STAMP");
  });

  it("creates a fresh stamp from the injected id generator", () => {
    const stamp = createWriteStamp({ next: () => "01ARZ3NDEKTSV4RRFFQ69G5FAV" });
    expect(stamp).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });
});
