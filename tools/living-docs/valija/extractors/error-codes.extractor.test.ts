import { describe, expect, it } from "vitest";
import { sourceFile } from "../testing/source-fixture.js";
import { ErrorCodesExtractor, readErrorCodes } from "./error-codes.extractor.js";

const errors = sourceFile(
  "src/demo/domain/errors.ts",
  [
    "/** Errors of the demo context. */",
    "export type DemoErrorCode =",
    "  /** The thing is missing. */",
    '  | "THING_MISSING"',
    '  | /** Doc placed after the bar. */ "AFTER_BAR"',
    '  | "NO_DOC"',
    "  /**",
    "   * A multi-line doc",
    "   * for the last code.",
    "   */",
    '  | "LAST_CODE";',
    "",
  ].join("\n"),
);
const raiser = sourceFile(
  "src/demo/application/use-cases/x.use-case.ts",
  [
    '// demoErr("LAST_CODE") in a comment does not count',
    'export const a = () => vaultErr("THING_MISSING", "m");',
    'export const b = () => new DomainError("AFTER_BAR", "m");',
    "",
  ].join("\n"),
);

describe("readErrorCodes", () => {
  it("attaches docs placed before or after the bar, single or multi-line", () => {
    expect(readErrorCodes([errors]).map((c) => [c.code, c.doc])).toEqual([
      ["THING_MISSING", "The thing is missing."],
      ["AFTER_BAR", "Doc placed after the bar."],
      ["NO_DOC", null],
      ["LAST_CODE", "A multi-line doc for the last code."],
    ]);
  });
});

describe("ErrorCodesExtractor", () => {
  it("requires a doc on every code (D-11) and finds raise sites in code only", async () => {
    const facts = await new ErrorCodesExtractor(() => [errors, raiser]).extract();
    expect(facts.findings).toMatchObject([
      { rule: "undocumented-export", subject: "DemoErrorCode › NO_DOC", file: errors.path },
    ]);
    const rows = facts.catalogues[0]?.rows ?? [];
    const raisedIn = Object.fromEntries(
      rows.map((r) => [r.key?.name, r.cells[2]?.links?.map((l) => l.href) ?? r.cells[2]?.text]),
    );
    expect(raisedIn).toEqual({
      AFTER_BAR: [raiser.path],
      LAST_CODE: "declared, never raised (statically)",
      NO_DOC: "declared, never raised (statically)",
      THING_MISSING: [raiser.path],
    });
  });
});
