import { createFinding, type Finding } from "../values/finding.js";
import type { GuidePage } from "../values/guide-page.js";

/** Compares the pages the code implies with the committed ones: changed, missing, orphaned. */
export function findStalePages(
  expected: readonly GuidePage[],
  actual: readonly GuidePage[],
  guideDir: string,
): Finding[] {
  const committed = new Map(actual.map((p) => [p.path, p.content]));
  const wanted = new Set(expected.map((p) => p.path));
  const at = (path: string) => `${guideDir}/${path}`;

  const stale = expected.flatMap((page) => {
    const current = committed.get(page.path);
    if (current === page.content) return [];
    return [
      createFinding({
        rule: "stale-page",
        file: at(page.path),
        subject: page.path,
        message:
          current === undefined
            ? "page is missing from the guide; run `npm run docs`"
            : "page differs from what the code and flows produce; run `npm run docs`",
      }),
    ];
  });
  const orphans = actual
    .filter((page) => !wanted.has(page.path))
    .map((page) =>
      createFinding({
        rule: "orphan-page",
        file: at(page.path),
        subject: page.path,
        message: "page is no longer produced by the generator; run `npm run docs`",
      }),
    );
  return [...stale, ...orphans];
}
