import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

/**
 * IMPORT-FEEDBACK: honest, parameterised progress copy for the three moments
 * (reading, previewing, importing), in both languages, with matching
 * placeholders (Slice 1), and — once Slice 3 removed its last render —
 * `busyRetrying`'s removal and the V1 "no retry/another-save" promise
 * (Slice 3).
 */
describe("import progress copy — placeholder parity and short-label shape", () => {
  for (const [lang, catalog] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${lang}: importing and previewing both carry itemCount and conversationCount`, () => {
      expect(catalog.import.importing).toContain("{itemCount}");
      expect(catalog.import.importing).toContain("{conversationCount}");
      expect(catalog.import.previewing).toContain("{itemCount}");
      expect(catalog.import.previewing).toContain("{conversationCount}");
    });

    it(`${lang}: the short button labels carry no placeholder`, () => {
      expect(catalog.import.importingShort).not.toMatch(/\{.*\}/);
      expect(catalog.import.previewingShort).not.toMatch(/\{.*\}/);
    });

    it(`${lang}: mayStopResponding exists`, () => {
      expect(catalog.import.mayStopResponding.length).toBeGreaterThan(0);
    });

    it(`${lang}: busyRetrying is gone — its last render was removed in Slice 3`, () => {
      expect(Object.hasOwn(catalog.import, "busyRetrying")).toBe(false);
    });

    it(`${lang}: no import.* string ever claims another save is in progress (V1)`, () => {
      for (const value of Object.values(catalog.import)) {
        if (typeof value !== "string") continue;
        expect(value).not.toMatch(/another save|otro guardado/i);
        expect(value).not.toMatch(/retrying|reintentando/i);
      }
    });
  }
});
