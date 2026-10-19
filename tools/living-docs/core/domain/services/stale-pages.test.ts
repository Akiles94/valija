import { describe, expect, it } from "vitest";
import { findStalePages } from "./stale-pages.js";

describe("findStalePages", () => {
  it("reports changed, missing and orphan pages", () => {
    const findings = findStalePages(
      [
        { path: "README.md", content: "same" },
        { path: "flows/a.md", content: "new" },
        { path: "flows/b.md", content: "b" },
      ],
      [
        { path: "README.md", content: "same" },
        { path: "flows/a.md", content: "old" },
        { path: "flows/gone.md", content: "x" },
      ],
      "docs/guide",
    );
    expect(findings.map((f) => [f.rule, f.file])).toEqual([
      ["stale-page", "docs/guide/flows/a.md"],
      ["stale-page", "docs/guide/flows/b.md"],
      ["orphan-page", "docs/guide/flows/gone.md"],
    ]);
    expect(findings.every((f) => f.message.endsWith("run `npm run docs`"))).toBe(true);
  });
});
