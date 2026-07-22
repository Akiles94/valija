import { describe, expect, it } from "vitest";
import { IMPORT_SOURCES, parseImportSource } from "./import-source.js";

describe("ImportSource", () => {
  it("accepts all three sources", () => {
    for (const s of IMPORT_SOURCES) expect(parseImportSource(s).ok).toBe(true);
  });

  it("rejects unknown sources", () => {
    const r = parseImportSource("gemini");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_SOURCE");
  });
});
