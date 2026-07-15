import { describe, expect, it } from "vitest";
import { bytesToHex, isKeyHex } from "./key-hex.js";

describe("key-hex", () => {
  it("renders bytes as lowercase hex, zero-padded", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });

  it("accepts a 64-char key in either case", () => {
    const key = "ab".repeat(32);
    expect(isKeyHex(key)).toBe(true);
    expect(isKeyHex(key.toUpperCase())).toBe(true);
  });

  it("rejects wrong length or non-hex characters", () => {
    expect(isKeyHex("ab".repeat(31))).toBe(false);
    expect(isKeyHex("zz".repeat(32))).toBe(false);
  });
});
