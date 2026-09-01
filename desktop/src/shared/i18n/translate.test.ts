import { describe, expect, it } from "vitest";
import { createTranslator, interpolate } from "./translate.js";

describe("createTranslator", () => {
  it("resolves a plain string key in English", () => {
    const { t } = createTranslator("en");
    expect(t("common.cancel")).toBe("Cancel");
  });

  it("resolves the same key in Spanish, in tú form, not English", () => {
    const { t } = createTranslator("es");
    expect(t("common.cancel")).toBe("Cancelar");
    expect(t("common.cancel")).not.toBe("Cancel");
  });

  it("interpolates named placeholders", () => {
    const { t } = createTranslator("en");
    expect(t("locked.forkBody", { vaultPath: "/Users/oscar/.valija" })).toContain(
      "/Users/oscar/.valija",
    );
  });

  it("resolves a plural form by count, in both languages", () => {
    const en = createTranslator("en");
    const es = createTranslator("es");
    expect(en.t("search.resultCount", { count: 1 })).toBe("1 result");
    expect(en.t("search.resultCount", { count: 5 })).toBe("5 results");
    expect(es.t("search.resultCount", { count: 1 })).toBe("1 resultado");
    expect(es.t("search.resultCount", { count: 5 })).toBe("5 resultados");
  });

  it("throws on a missing key in the test environment (VITEST=true)", () => {
    const { t } = createTranslator("en");
    // biome-ignore lint/suspicious/noExplicitAny: deliberately bypassing the key type to prove the missing-key path
    expect(() => t("common.definitelyNotAKey" as any)).toThrow(/Missing translation key/);
  });
});

describe("interpolate", () => {
  it("leaves an unmatched placeholder untouched rather than blanking it", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });

  it("substitutes every named placeholder present in params", () => {
    expect(interpolate("{a} and {b}", { a: "x", b: "y" })).toBe("x and y");
  });
});
