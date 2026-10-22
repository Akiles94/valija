import { describe, expect, it } from "vitest";
import { BUSY_MESSAGE } from "../../../context/infra/vault-sessions.js";
import { DomainError } from "../../../shared/domain/result.js";
import { VaultSchemaTooNewError } from "../../../vault/domain/errors.js";
import { VALIJA_ERROR_CODES } from "../dto/valija-error.js";
import { invalidInput, toValijaError, unexpectedError } from "./to-valija-error.js";

const SENSITIVE = "hunter2-should-never-cross";

describe("toValijaError", () => {
  it.each(VALIJA_ERROR_CODES.filter((c) => c !== "INVALID_INPUT"))("passes %s through", (code) => {
    expect(toValijaError(new DomainError(code, "a message"))).toEqual({
      code,
      message: "a message",
    });
  });

  it.each([
    "VAULT_FORK_DETECTED",
    "NOTHING_TO_EDIT",
    "BINDING_CONFLICT",
  ])("maps the unlisted %s to STORAGE_ERROR without copying its message", (code) => {
    const mapped = toValijaError(new DomainError(code, SENSITIVE));
    expect(mapped.code).toBe("STORAGE_ERROR");
    expect(mapped.message).not.toContain(SENSITIVE);
  });

  it("returns a plain { code, message } — never the DomainError, never the schema numbers", () => {
    const mapped = toValijaError(new VaultSchemaTooNewError(5, 4));
    expect(Object.keys(mapped).sort()).toEqual(["code", "message"]);
    expect(mapped).not.toBeInstanceOf(Error);
    expect(mapped.code).toBe("VAULT_SCHEMA_TOO_NEW");
    expect(JSON.parse(JSON.stringify(mapped))).toEqual(mapped);
  });
});

describe("unexpectedError (P-20)", () => {
  it("a busy SQLite error → STORAGE_ERROR with the vault-busy wording", () => {
    const busy = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
    expect(unexpectedError(busy)).toEqual({ code: "STORAGE_ERROR", message: BUSY_MESSAGE });
  });

  it("anything else → STORAGE_ERROR with a generic message; the thrown text is never copied", () => {
    for (const thrown of [new Error(SENSITIVE), SENSITIVE, { message: SENSITIVE }, undefined]) {
      const mapped = unexpectedError(thrown);
      expect(mapped.code).toBe("STORAGE_ERROR");
      expect(mapped.message).not.toContain(SENSITIVE);
      expect(Object.keys(mapped).sort()).toEqual(["code", "message"]);
    }
  });
});

describe("invalidInput", () => {
  it("builds INVALID_INPUT", () => {
    expect(invalidInput("bad")).toEqual({ code: "INVALID_INPUT", message: "bad" });
  });
});
