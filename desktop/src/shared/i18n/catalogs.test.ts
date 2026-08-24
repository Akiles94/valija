import { describe, it, expect } from "vitest";
import en from "./catalogs/en.js";
import es from "./catalogs/es.js";
import { getErrorCatalogKey } from "./error-copy.js";
import { DomainError } from "../../../src/shared/domain/result.js";

function flattenCatalog(
  obj: any,
  prefix = ""
): Record<string, string | { one: string; other: string }> {
  const result: Record<string, string | { one: string; other: string }> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      typeof value === "object" &&
      value !== null &&
      !("one" in value) &&
      !("other" in value)
    ) {
      Object.assign(result, flattenCatalog(value, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}

describe("i18n catalogs", () => {
  it("has identical key structure in both catalogs", () => {
    const enKeys = Object.keys(flattenCatalog(en)).sort();
    const esKeys = Object.keys(flattenCatalog(es)).sort();

    expect(esKeys).toEqual(enKeys);
  });

  it("has no missing keys in Spanish catalog", () => {
    const enFlat = flattenCatalog(en);
    const esFlat = flattenCatalog(es);

    for (const key of Object.keys(enFlat)) {
      expect(esFlat[key]).toBeDefined(`Missing Spanish key: ${key}`);
    }
  });

  it("has no extra keys in Spanish catalog", () => {
    const enFlat = flattenCatalog(en);
    const esFlat = flattenCatalog(es);

    for (const key of Object.keys(esFlat)) {
      expect(enFlat[key]).toBeDefined(`Extra Spanish key: ${key}`);
    }
  });

  it("plural forms exist in both languages", () => {
    const enFlat = flattenCatalog(en);
    const esFlat = flattenCatalog(es);

    for (const [key, value] of Object.entries(enFlat)) {
      if (typeof value === "object" && "one" in value) {
        const esValue = esFlat[key];
        expect(esValue).toBeDefined();
        expect(typeof esValue).toBe("object");
        if (typeof esValue === "object" && esValue !== null) {
          expect("one" in esValue && "other" in esValue).toBe(true);
        }
      }
    }
  });

  it("placeholder usage is consistent between catalogs", () => {
    const enFlat = flattenCatalog(en);
    const esFlat = flattenCatalog(es);

    for (const [key, enValue] of Object.entries(enFlat)) {
      if (typeof enValue === "string") {
        // Extract placeholders like {count}, {path}, etc
        const enPlaceholders = (enValue.match(/\{[\w]+\}/g) || []).sort();
        const esValue = esFlat[key];

        if (typeof esValue === "string") {
          const esPlaceholders = (esValue.match(/\{[\w]+\}/g) || []).sort();
          expect(esPlaceholders).toEqual(
            enPlaceholders,
            `Placeholder mismatch in ${key}`
          );
        }
      }
    }
  });

  it("every error code from vault context is in the catalog", () => {
    const vaultCodes = [
      "VAULT_NOT_FOUND",
      "VAULT_ALREADY_EXISTS",
      "VAULT_UPGRADE_REQUIRED",
      "VAULT_MUST_BE_LOCKED",
    ];

    for (const code of vaultCodes) {
      const key = `errors.${code}`;
      const enFlat = flattenCatalog(en);
      expect(enFlat[key]).toBeDefined(`Missing error copy for ${code}`);

      const esFlat = flattenCatalog(es);
      expect(esFlat[key]).toBeDefined(`Missing Spanish error copy for ${code}`);
    }
  });

  it("error copy mapping returns valid keys", () => {
    const testError = new DomainError("VAULT_NOT_FOUND", "test message");
    const key = getErrorCatalogKey(testError);

    expect(key).toBe("errors.VAULT_NOT_FOUND");
    expect(key).toMatch(/^errors\./);
  });

  it("unknown error codes get a fallback key", () => {
    const testError = new DomainError("UNKNOWN_CODE", "test message");
    const key = getErrorCatalogKey(testError);

    expect(key).toBe("errors.UNKNOWN_CODE");
    expect(key).toMatch(/^errors\./);
  });
});
