import { describe, expect, it } from "vitest";
import { validateNewPassphrase } from "./create-vault-validation.js";

describe("validateNewPassphrase", () => {
  it("rejects a passphrase shorter than the minimum, even if confirmation matches", () => {
    expect(validateNewPassphrase("short1", "short1")).toBe("tooShort");
  });

  it("rejects a mismatched passphrase/confirmation pair, both long enough on their own", () => {
    expect(validateNewPassphrase("longenough1", "longenough2")).toBe("mismatch");
  });

  it("the length check takes priority — a too-short pair is never reported as a mismatch", () => {
    expect(validateNewPassphrase("short", "short")).toBe("tooShort");
  });

  it("accepts a long-enough, matching pair", () => {
    expect(validateNewPassphrase("longenough1", "longenough1")).toBeNull();
  });
});
