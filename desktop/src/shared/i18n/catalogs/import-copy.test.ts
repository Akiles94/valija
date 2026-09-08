import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

/**
 * IMPORT-FEEDBACK Slice 1: honest, parameterised progress copy for the three
 * moments (reading, previewing, importing), in both languages, with matching
 * placeholders. The "no retry/another-save mention" and "busyRetrying is
 * gone" assertions land in Slice 3, once its last render is actually
 * removed — asserting them here would fail against Slice 1's own catalogs,
 * which still carry `busyRetrying` on purpose (deleting it earlier breaks
 * `typecheck`, since `TranslationKey` is derived from `en`).
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
  }
});
