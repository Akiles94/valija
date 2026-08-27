import { describe, expect, it } from "vitest";
import { checkRowDetail } from "./diagnostic-detail.js";

describe("checkRowDetail", () => {
  it("returns the check's own detail verbatim when there is no errorCode", () => {
    const check = { name: "sqlcipher", ok: true, detail: "native module loads" };
    const errorCopy = (code: string) => `should not be called (${code})`;

    expect(checkRowDetail(check, errorCopy)).toBe("native module loads");
  });

  it("localizes from errorCode instead of rendering the raw DomainError.message when errorCode is set", () => {
    const check = {
      name: "vault",
      ok: false,
      detail: "Vault header at /tmp/x/vault.json is malformed: some zod internals",
      errorCode: "STORAGE_ERROR",
    };
    const errorCopy = (code: string) =>
      code === "STORAGE_ERROR" ? "Something went wrong reading or writing the vault files." : code;

    const shown = checkRowDetail(check, errorCopy);

    expect(shown).toBe("Something went wrong reading or writing the vault files.");
    expect(shown).not.toBe(check.detail);
    expect(shown).not.toContain("zod internals");
  });
});
