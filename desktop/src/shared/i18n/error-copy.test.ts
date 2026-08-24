import { describe, it, expect } from "vitest";
import { getErrorCatalogKey } from "./error-copy.js";
import { DomainError } from "../../../src/shared/domain/result.js";

describe("error-copy", () => {
  it("maps known vault error codes to catalog keys", () => {
    const tests = [
      ["VAULT_NOT_FOUND", "errors.VAULT_NOT_FOUND"],
      ["VAULT_ALREADY_EXISTS", "errors.VAULT_ALREADY_EXISTS"],
      ["VAULT_UPGRADE_REQUIRED", "errors.VAULT_UPGRADE_REQUIRED"],
      ["VAULT_MUST_BE_LOCKED", "errors.VAULT_MUST_BE_LOCKED"],
      ["VAULT_FORK_DETECTED", "errors.VAULT_FORK_DETECTED"],
    ];

    for (const [code, expectedKey] of tests) {
      const error = new DomainError(code, "message");
      expect(getErrorCatalogKey(error)).toBe(expectedKey);
    }
  });

  it("maps relocation error codes to catalog keys", () => {
    const tests = [
      ["RELOCATION_DESTINATION_OCCUPIED", "errors.RELOCATION_DESTINATION_OCCUPIED"],
      ["RELOCATION_DESTINATION_UNUSABLE", "errors.RELOCATION_DESTINATION_UNUSABLE"],
      ["RELOCATION_DESTINATION_NESTED", "errors.RELOCATION_DESTINATION_NESTED"],
      ["RELOCATION_SOURCE_UNSETTLED", "errors.RELOCATION_SOURCE_UNSETTLED"],
      ["RELOCATION_COPY_FAILED", "errors.RELOCATION_COPY_FAILED"],
      ["RELOCATION_VERIFY_FAILED", "errors.RELOCATION_VERIFY_FAILED"],
      ["RELOCATION_ROLLBACK_FAILED", "errors.RELOCATION_ROLLBACK_FAILED"],
    ];

    for (const [code, expectedKey] of tests) {
      const error = new DomainError(code, "message");
      expect(getErrorCatalogKey(error)).toBe(expectedKey);
    }
  });

  it("provides fallback for unmapped error codes", () => {
    const error = new DomainError("UNKNOWN_ERROR", "message");
    const key = getErrorCatalogKey(error);

    expect(key).toBe("errors.UNKNOWN_ERROR");
    expect(key).toMatch(/^errors\./);
  });

  it("never returns the raw error message", () => {
    const error = new DomainError("VAULT_NOT_FOUND", "Custom error message");
    const key = getErrorCatalogKey(error);

    expect(key).not.toContain("Custom error message");
    expect(key).toMatch(/^errors\./);
  });
});
