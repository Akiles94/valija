import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { scanTypeScript } from "./typescript-scanner.js";

const repoRoot = join(import.meta.dirname, "../../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$|\.d\.ts$/.test(entry.name) ? [path] : [];
  });
}

describe("scanTypeScript over the real repository", () => {
  const files = ["src", "desktop/src"].flatMap((root) => sourceFiles(join(repoRoot, root)));

  it("scans every in-scope source file without a single failure", () => {
    const failures = files.flatMap((file) => {
      const scanned = scanTypeScript(readFileSync(file, "utf8"), { jsx: file.endsWith(".tsx") });
      return scanned.ok
        ? []
        : [
            `${relative(repoRoot, file).split(sep).join("/")}:${scanned.error.line} ${scanned.error.reason}`,
          ];
    });
    expect(files.length).toBeGreaterThan(100);
    expect(failures).toEqual([]);
  });

  it("finds as many exports as a naive line count, within 5%", () => {
    let scannedCount = 0;
    let naiveCount = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      naiveCount += text.split("\n").filter((l) => l.startsWith("export ")).length;
      const scanned = scanTypeScript(text, { jsx: file.endsWith(".tsx") });
      if (scanned.ok) {
        scannedCount += scanned.value.declarations.filter((d) => d.exported).length;
      }
    }
    expect(Math.abs(scannedCount - naiveCount) / naiveCount).toBeLessThan(0.05);
  });
});
