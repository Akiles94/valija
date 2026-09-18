import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

/**
 * IMPORT-FEEDBACK: the import screen must show honest, parameterised progress
 * copy for all three moments (reading, previewing, importing), never reuse the
 * SQLITE_BUSY-retry wording, and never claim another save is already running.
 */
describe("import progress copy", () => {
  for (const [lang, catalog] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const { importing, previewing, importingShort, previewingShort, mayStopResponding } =
      catalog.import;

    it(`${lang}: importing and previewing carry both itemCount and conversationCount`, () => {
      for (const text of [importing, previewing]) {
        expect(text).toContain("{itemCount}");
        expect(text).toContain("{conversationCount}");
      }
    });

    it(`${lang}: the short button labels carry no placeholder`, () => {
      for (const text of [importingShort, previewingShort]) {
        expect(text).not.toMatch(/\{.+\}/);
      }
    });

    it(`${lang}: mayStopResponding exists`, () => {
      expect(typeof mayStopResponding).toBe("string");
      expect(mayStopResponding.length).toBeGreaterThan(0);
    });

    it(`${lang}: the new progress copy never claims another save is already running`, () => {
      for (const text of [importing, previewing, importingShort, previewingShort]) {
        expect(text).not.toMatch(/retry|reintent/i);
        expect(text).not.toMatch(/another save|otro guardado/i);
      }
    });

    it(`${lang}: busyRetrying is gone — its last render disappeared in Slice 3`, () => {
      expect(Object.hasOwn(catalog.import, "busyRetrying")).toBe(false);
    });
  }
});
