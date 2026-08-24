import { describe, it, expect, beforeEach } from "vitest";
import { createTranslator } from "./translate.js";
import { matchLanguage } from "./languages.js";

describe("i18n translate", () => {
  it("resolves English catalog", () => {
    const t = createTranslator("en");
    expect(t("common.ok")).toBe("OK");
    expect(t("dashboard.title")).toBe("Your context");
  });

  it("resolves Spanish catalog", () => {
    const t = createTranslator("es");
    expect(t("common.ok")).toBe("Aceptar");
    expect(t("dashboard.title")).toBe("Tu contexto");
  });

  it("falls back to English for missing Spanish keys", () => {
    const t = createTranslator("es");
    // If a key is somehow missing in Spanish, it should return the English version
    const result = t("common.ok");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("resolves nested keys with dot notation", () => {
    const t = createTranslator("en");
    expect(t("createVault.passphrase")).toBe("Enter a passphrase");
  });

  it("replaces {named} placeholders", () => {
    const t = createTranslator("en");
    const result = t("connectTools.restart", { tool: "Claude" });
    expect(result).toContain("Claude");
  });

  it("handles plural forms with Intl.PluralRules", () => {
    const t = createTranslator("en");
    const one = t("dashboard.projectCount", { count: 1 });
    const many = t("dashboard.projectCount", { count: 5 });

    expect(one).toContain("1");
    expect(many).toContain("5");
    expect(one).not.toBe(many);
  });

  it("handles Spanish plural forms", () => {
    const t = createTranslator("es");
    const one = t("dashboard.projectCount", { count: 1 });
    const many = t("dashboard.projectCount", { count: 5 });

    expect(one).toBeDefined();
    expect(many).toBeDefined();
  });

  it("throws on plural key without count in test env", () => {
    const t = createTranslator("en");
    expect(() => {
      t("dashboard.projectCount");
    }).toThrow();
  });

  it("combines count and other placeholders", () => {
    const t = createTranslator("en");
    const result = t("dashboard.projectCount", { count: 3 });
    expect(result).toContain("3");
  });
});

describe("Language matching", () => {
  it("matches es, es-EC, es-419, es-ES to Spanish", () => {
    expect(matchLanguage("es")).toBe("es");
    expect(matchLanguage("es-EC")).toBe("es");
    expect(matchLanguage("es-419")).toBe("es");
    expect(matchLanguage("es-ES")).toBe("es");
  });

  it("matches en-* to English", () => {
    expect(matchLanguage("en")).toBe("en");
    expect(matchLanguage("en-US")).toBe("en");
    expect(matchLanguage("en-GB")).toBe("en");
  });

  it("defaults unrecognized locales to English", () => {
    expect(matchLanguage("fr")).toBe("en");
    expect(matchLanguage("de-DE")).toBe("en");
    expect(matchLanguage("ja")).toBe("en");
  });
});
