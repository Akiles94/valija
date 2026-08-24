import { describe, it, expect } from "vitest";
import { resolveSystemOrOverride } from "./system-or-override.js";
import { resolveLanguage } from "./language-resolution.js";
import { resolveTheme } from "./theme-resolution.js";
import {
  shouldPlayTour,
  nextSlide,
  previousSlide,
  markTourSeen,
  TOUR_SLIDES,
} from "./onboarding-tour.js";
import { resolveVaultRoot } from "./vault-location.ts";
import type { AppPreferences } from "../ports/app-preferences.js";

describe("Policies", () => {
  describe("systemOrOverride", () => {
    it("returns system value when choice is 'system'", () => {
      expect(resolveSystemOrOverride("system", "dark")).toBe("dark");
      expect(resolveSystemOrOverride("system", "en")).toBe("en");
    });

    it("returns override when choice is not 'system'", () => {
      expect(resolveSystemOrOverride("light", "dark")).toBe("light");
      expect(resolveSystemOrOverride("es", "en")).toBe("es");
    });
  });

  describe("languageResolution", () => {
    it("returns system locale when preferences is 'system'", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      expect(resolveLanguage(prefs, "es-EC")).toBe("es");
      expect(resolveLanguage(prefs, "en-US")).toBe("en");
    });

    it("returns override when language is explicitly set", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "es",
        tourSeen: false,
      };
      expect(resolveLanguage(prefs, "en-US")).toBe("es");
    });

    it("matches es variants to Spanish", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      expect(resolveLanguage(prefs, "es")).toBe("es");
      expect(resolveLanguage(prefs, "es-419")).toBe("es");
      expect(resolveLanguage(prefs, "es-MX")).toBe("es");
    });

    it("defaults unknown locales to English", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      expect(resolveLanguage(prefs, "fr-FR")).toBe("en");
      expect(resolveLanguage(prefs, "ja")).toBe("en");
    });
  });

  describe("onboardingTour", () => {
    it("should play tour when tourSeen is false", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      expect(shouldPlayTour(prefs)).toBe(true);
    });

    it("should not play tour when tourSeen is true", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: true,
      };
      expect(shouldPlayTour(prefs)).toBe(false);
    });

    it("navigates forward through slides", () => {
      expect(nextSlide("welcome")).toBe("save");
      expect(nextSlide("save")).toBe("use");
      expect(nextSlide("use")).toBe("privacy");
      expect(nextSlide("privacy")).toBeNull();
    });

    it("navigates backward through slides", () => {
      expect(previousSlide("privacy")).toBe("use");
      expect(previousSlide("use")).toBe("save");
      expect(previousSlide("save")).toBe("welcome");
      expect(previousSlide("welcome")).toBeNull();
    });

    it("marks tour as seen", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      const updated = markTourSeen(prefs);
      expect(updated.tourSeen).toBe(true);
      expect(prefs.tourSeen).toBe(false); // Original unchanged
    });

    it("has the correct slide order", () => {
      expect(TOUR_SLIDES).toEqual(["welcome", "save", "use", "privacy"]);
    });
  });

  describe("vaultLocation", () => {
    it("VALIJA_HOME always wins", () => {
      const prefs: AppPreferences = {
        vaultPath: "/remembered/path",
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      const result = resolveVaultRoot(
        { VALIJA_HOME: "/env/path" },
        prefs
      );
      expect(result).toBe("/env/path");
    });

    it("uses remembered location when VALIJA_HOME is unset", () => {
      const prefs: AppPreferences = {
        vaultPath: "/remembered/path",
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      const result = resolveVaultRoot({}, prefs);
      expect(result).toBe("/remembered/path");
    });

    it("returns undefined when neither env nor prefs set", () => {
      const prefs: AppPreferences = {
        vaultPath: null,
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      const result = resolveVaultRoot({}, prefs);
      expect(result).toBeUndefined();
    });

    it("has precedence: env > prefs > undefined", () => {
      const prefs: AppPreferences = {
        vaultPath: "/pref/path",
        theme: "system",
        language: "system",
        tourSeen: false,
      };
      // Env wins when both set
      expect(
        resolveVaultRoot({ VALIJA_HOME: "/env/path" }, prefs)
      ).toBe("/env/path");
      // Prefs used when env not set
      expect(resolveVaultRoot({}, prefs)).toBe("/pref/path");
      // Undefined when neither set
      expect(
        resolveVaultRoot({}, { ...prefs, vaultPath: null })
      ).toBeUndefined();
    });
  });
});
