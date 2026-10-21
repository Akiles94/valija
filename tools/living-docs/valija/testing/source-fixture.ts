import type { SourceFile } from "living-docs";
import { scanTypeScript } from "living-docs";

/** A scanned in-memory source file for extractor tests (no fixture files on disk, P-D17). */
export function sourceFile(path: string, text: string): SourceFile {
  const scanned = scanTypeScript(text, { jsx: path.endsWith(".tsx") });
  if (!scanned.ok) throw new Error(`fixture ${path} does not scan: ${scanned.error.reason}`);
  return { path, text, scanned: scanned.value };
}
