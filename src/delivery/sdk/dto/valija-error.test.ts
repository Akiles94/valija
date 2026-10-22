import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { ItemType } from "../../../context/domain/values/item-type.js";
import type { SaveableType } from "./requests.js";
import { VALIJA_ERROR_CODES } from "./valija-error.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The same union reader as the desktop's error-copy test. */
function errorCodesIn(relPath: string): string[] {
  const source = readFileSync(join(SRC, relPath), "utf8");
  const union = source.match(/type\s+\w*ErrorCode\s*=([\s\S]*?);/)?.[1];
  if (union === undefined) throw new Error(`no ErrorCode union in ${relPath}`);
  return [...union.matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1] as string);
}

const DOMAIN_CODES = new Set([
  ...errorCodesIn("vault/domain/errors.ts"),
  ...errorCodesIn("context/domain/errors.ts"),
]);

/** Codes only curation, detection, bindings or relocation produce — never reachable from the SDK (D-J). */
const NOT_SDK = [
  "NOTHING_TO_EDIT",
  "ITEM_ID_AMBIGUOUS",
  "PROJECT_NOT_DETECTED",
  "PROJECT_AMBIGUOUS",
  "BINDING_CONFLICT",
  "BINDING_NOT_FOUND",
  "NO_GIT_REMOTE",
  "INVALID_WORKSPACE_PATH",
  "VAULT_FORK_DETECTED",
  "VAULT_MUST_BE_LOCKED",
  "RELOCATION_DESTINATION_OCCUPIED",
];

describe("VALIJA_ERROR_CODES (closed, §7)", () => {
  it("every code but INVALID_INPUT is an existing domain code", () => {
    const strangers = VALIJA_ERROR_CODES.filter(
      (c) => c !== "INVALID_INPUT" && !DOMAIN_CODES.has(c),
    );
    expect(strangers).toEqual([]);
    expect(DOMAIN_CODES.has("INVALID_INPUT")).toBe(false);
  });

  it("has no duplicates", () => {
    expect(new Set(VALIJA_ERROR_CODES).size).toBe(VALIJA_ERROR_CODES.length);
  });

  it("holds no curation, detection, binding or relocation code", () => {
    for (const code of NOT_SDK) expect(VALIJA_ERROR_CODES).not.toContain(code);
  });

  it("includes the newer-schema refusal and the lock codes", () => {
    expect(VALIJA_ERROR_CODES).toContain("VAULT_SCHEMA_TOO_NEW");
    expect(VALIJA_ERROR_CODES).toContain("VAULT_LOCKED");
    expect(VALIJA_ERROR_CODES).toContain("POSSIBLE_SECRET");
  });
});

describe("SaveableType", () => {
  it("is exactly the domain's saveable ItemType (no imported)", () => {
    expectTypeOf<SaveableType>().toEqualTypeOf<ItemType>();
  });
});
