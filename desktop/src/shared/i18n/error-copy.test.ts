import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./catalogs/en.js";
import { es } from "./catalogs/es.js";
import { copyForErrorCode } from "./error-copy.js";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

const ERROR_SOURCE_FILES = [
  "src/vault/domain/errors.ts",
  "src/context/domain/errors.ts",
  "src/importers/domain/errors.ts",
];

/**
 * Extracts the string-literal members of the first `type ...ErrorCode = ... ;`
 * union in a file — the same shape every `*ErrorCode` type in `src/` uses
 * (`"CODE_ONE" | "CODE_TWO" | ...`).
 */
function extractErrorCodes(source: string): string[] {
  const match = source.match(/type\s+\w*ErrorCode\s*=([\s\S]*?);/);
  const union = match?.[1];
  if (!union) throw new Error("No `type ...ErrorCode = ...;` union found");
  return [...union.matchAll(/"([A-Z0-9_]+)"/g)]
    .map((m) => m[1])
    .filter((code): code is string => code !== undefined);
}

describe("every DomainError code src/ defines has copy in both catalogs", () => {
  const allCodes = ERROR_SOURCE_FILES.flatMap((relPath) =>
    extractErrorCodes(readFileSync(join(REPO_ROOT, relPath), "utf8")),
  );

  it("found at least one code per source file (the scan itself isn't silently empty)", () => {
    expect(allCodes.length).toBeGreaterThan(0);
  });

  it.each(allCodes)("%s has English copy", (code) => {
    expect(Object.hasOwn(en.errors, code)).toBe(true);
  });

  it.each(allCodes)("%s has Spanish copy", (code) => {
    expect(Object.hasOwn(es.errors, code)).toBe(true);
  });
});

describe("copyForErrorCode", () => {
  it("renders a known code's plain-language copy, in the requested language", () => {
    expect(copyForErrorCode("VAULT_LOCKED", "en")).toBe(en.errors.VAULT_LOCKED);
    expect(copyForErrorCode("VAULT_LOCKED", "es")).toBe(es.errors.VAULT_LOCKED);
  });

  it("never returns a DomainError.message-shaped string for a known code", () => {
    // A real DomainError.message for WRONG_PASSPHRASE is English prose describing
    // the exact failure to a developer; the catalog copy is deliberately different
    // wording aimed at D-N's audience. The two must not coincidentally match.
    const rendered = copyForErrorCode("WRONG_PASSPHRASE", "en");
    expect(rendered).toBe(en.errors.WRONG_PASSPHRASE);
  });

  it("falls back to the generic sentence and still names the code for an unrecognized code", () => {
    const rendered = copyForErrorCode("SOME_FUTURE_CODE_NOT_YET_CATALOGED", "en");
    expect(rendered).toContain("SOME_FUTURE_CODE_NOT_YET_CATALOGED");
  });

  it("the generic fallback is also localized", () => {
    const renderedEn = copyForErrorCode("SOME_FUTURE_CODE_NOT_YET_CATALOGED", "en");
    const renderedEs = copyForErrorCode("SOME_FUTURE_CODE_NOT_YET_CATALOGED", "es");
    expect(renderedEs).not.toBe(renderedEn);
    expect(renderedEs).toContain("SOME_FUTURE_CODE_NOT_YET_CATALOGED");
  });
});
