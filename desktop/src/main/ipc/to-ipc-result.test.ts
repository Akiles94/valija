import { describe, expect, it } from "vitest";
import { DomainError, err, ok } from "../../../../src/shared/domain/result.js";
import { VaultSchemaTooNewError, vaultError } from "../../../../src/vault/domain/errors.js";
import { toIpcResult } from "./to-ipc-result.js";

const identity = <T>(v: T) => v;

describe("toIpcResult", () => {
  it("a VaultSchemaTooNewError crosses as exactly its code and two numbers — never its message (P-21)", () => {
    const result = toIpcResult(err(new VaultSchemaTooNewError(5, 4)), identity);
    expect(result).toEqual({
      ok: false,
      error: { code: "VAULT_SCHEMA_TOO_NEW", schema: { vaultVersion: 5, supportedVersion: 4 } },
    });
    expect(JSON.stringify(result)).not.toMatch(/message|valija/i);
  });

  it("any other DomainError crosses as exactly { code } (unchanged)", () => {
    expect(toIpcResult(err(vaultError("VAULT_LOCKED", "locked")), identity)).toEqual({
      ok: false,
      error: { code: "VAULT_LOCKED" },
    });
  });

  it("a plain DomainError with the same code but no numbers carries no schema field", () => {
    const result = toIpcResult(err(new DomainError("VAULT_SCHEMA_TOO_NEW", "text")), identity);
    expect(result).toEqual({ ok: false, error: { code: "VAULT_SCHEMA_TOO_NEW" } });
  });

  it("a success maps its value through toResponse", () => {
    expect(toIpcResult(ok(2), (v) => v * 2)).toEqual({ ok: true, value: 4 });
  });
});
