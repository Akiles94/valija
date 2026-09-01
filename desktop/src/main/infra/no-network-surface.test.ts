import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// §8.3/§8.5: no crash reporting, no telemetry, no network call of any kind. This
// scans the desktop tree's own source (not this file, and not test files, which
// are allowed to name the forbidden strings while asserting their absence) for the
// shapes those integrations always start from.
const FORBIDDEN_PATTERNS = [
  "crashReporter",
  "setInterval",
  "fetch(",
  "XMLHttpRequest",
  "http://",
  "https://",
] as const;

const SRC_ROOT = join(import.meta.dirname, "../../../src");
const THIS_FILE = import.meta.url.replace("file://", "");

// .css joins .ts/.tsx from item 89b (Slice 11) on: the first stylesheet in
// the tree is the first place a remote `@font-face` or background URL could
// enter (P-D20) — the same forbidden patterns apply, since none of them is
// valid CSS either.
const SCANNED_EXTENSIONS = [".ts", ".tsx", ".css"];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (SCANNED_EXTENSIONS.includes(extname(full)) && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("no crash reporting, timers, or network calls anywhere in desktop/src", () => {
  const files = collectSourceFiles(SRC_ROOT).filter((f) => f !== THIS_FILE);

  it.each(
    files.map((f) => relative(SRC_ROOT, f)),
  )("%s contains none of the forbidden patterns", (relPath) => {
    const full = join(SRC_ROOT, relPath);
    const lines = readFileSync(full, "utf8").split("\n");
    const offending = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => !line.trim().startsWith("//"))
      .filter(({ line }) => FORBIDDEN_PATTERNS.some((pattern) => line.includes(pattern)));
    expect(
      offending,
      JSON.stringify(offending.map((o) => `${relPath}:${o.i + 1}: ${o.line}`)),
    ).toEqual([]);
  });
});
