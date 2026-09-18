import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../ports/app-preferences.js";
import { resolveLanguage } from "./language-resolution.js";

describe("resolveLanguage", () => {
  it("follows the OS locale when the preference is 'system'", () => {
    expect(resolveLanguage({ ...DEFAULT_PREFERENCES, language: "system" }, "es-419")).toBe("es");
    expect(resolveLanguage({ ...DEFAULT_PREFERENCES, language: "system" }, "fr-FR")).toBe("en");
  });

  it("a manual override wins over the OS locale", () => {
    expect(resolveLanguage({ ...DEFAULT_PREFERENCES, language: "en" }, "es-EC")).toBe("en");
    expect(resolveLanguage({ ...DEFAULT_PREFERENCES, language: "es" }, "en-US")).toBe("es");
  });

  it("theme and language share the same underlying resolver", async () => {
    const { resolveSystemOrOverride } = await import("./system-or-override.js");
    const { matchLanguage } = await import("../../../shared/i18n/languages.js");
    const direct = resolveSystemOrOverride("system", matchLanguage("es-419"));
    expect(resolveLanguage({ ...DEFAULT_PREFERENCES, language: "system" }, "es-419")).toBe(direct);
  });
});
