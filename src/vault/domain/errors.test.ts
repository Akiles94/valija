import { describe, expect, it } from "vitest";
import { DomainError } from "../../shared/domain/result.js";
import { schemaTooNewErr, VaultSchemaTooNewError } from "./errors.js";

describe("VaultSchemaTooNewError", () => {
  it("is a DomainError carrying the code, both numbers and a message naming them", () => {
    const error = new VaultSchemaTooNewError(5, 4);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(error.vaultVersion).toBe(5);
    expect(error.supportedVersion).toBe(4);
    expect(error.message).toContain("schema 5");
    expect(error.message).toContain("up to schema 4");
    expect(error.message).toMatch(/update valija/i);
  });

  it("schemaTooNewErr wraps the typed error in a failed Result", () => {
    const result = schemaTooNewErr(7, 4);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(VaultSchemaTooNewError);
    expect(result.error.code).toBe("VAULT_SCHEMA_TOO_NEW");
  });
});
