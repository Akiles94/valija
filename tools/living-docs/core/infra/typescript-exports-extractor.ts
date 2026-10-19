import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedFacts, Extractor } from "../application/ports/extractor.js";
import { createExtractedFacts } from "../application/ports/extractor.js";
import { byCodeUnit } from "../domain/result.js";
import type { DocumentedSymbol } from "../domain/values/documented-symbol.js";
import { createFinding, type Finding } from "../domain/values/finding.js";
import { type ScannedFile, scanTypeScript } from "./typescript-scanner.js";

/** Where to look, what to skip, and which files owe TSDoc on their exports. */
export interface TypeScriptExportsOptions {
  readonly repoRoot: string;
  /** Repo-relative posix directories to walk. */
  readonly roots: readonly string[];
  /** Extra exclusions on top of tests, `.d.ts`, `__dom-tests__` and `testing/` folders. */
  readonly exclude?: (path: string) => boolean;
  readonly docRequired: (path: string) => boolean;
}

/** A scanned source file, shared with repository extractors that need more than exports. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
  readonly scanned: ScannedFile;
}

/**
 * Generic TSDoc-coverage extractor for any TypeScript repo: every exported declaration becomes a
 * `DocumentedSymbol`, and every file it cannot scan becomes an `unscannable-source` finding.
 */
export class TypeScriptExportsExtractor implements Extractor {
  readonly name = "typescript-exports";
  private cache: { files: SourceFile[]; findings: Finding[] } | null = null;

  constructor(private readonly options: TypeScriptExportsOptions) {}

  async extract(): Promise<ExtractedFacts> {
    const { files, findings } = this.sources();
    const symbols: DocumentedSymbol[] = files.flatMap((file) =>
      file.scanned.declarations
        .filter((d) => d.exported && !d.reexport)
        .map((d) => ({
          name: d.name,
          declaration: d.declaration,
          file: file.path,
          line: d.line,
          doc: d.doc,
          requiresDoc: this.options.docRequired(file.path),
        })),
    );
    return createExtractedFacts({ symbols, findings });
  }

  /** Every in-scope file, scanned once and shared; sorted by path. */
  sources(): { files: SourceFile[]; findings: Finding[] } {
    if (this.cache) return this.cache;
    const files: SourceFile[] = [];
    const findings: Finding[] = [];
    for (const path of this.options.roots.flatMap((root) => this.walk(root))) {
      const text = readFileSync(join(this.options.repoRoot, path), "utf8").replace(/\r\n/g, "\n");
      const scanned = scanTypeScript(text, { jsx: path.endsWith(".tsx") });
      if (scanned.ok) {
        files.push({ path, text, scanned: scanned.value });
      } else {
        findings.push(
          createFinding({
            rule: "unscannable-source",
            file: path,
            line: scanned.error.line,
            subject: path,
            message: `cannot scan this file with confidence (${scanned.error.reason}); it is not silently skipped`,
          }),
        );
      }
    }
    this.cache = { files, findings };
    return this.cache;
  }

  private walk(dir: string): string[] {
    const entries = readdirSync(join(this.options.repoRoot, dir), { withFileTypes: true }).sort(
      (a, b) => byCodeUnit(a.name, b.name),
    );
    return entries.flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (this.excluded(path, entry.isDirectory())) return [];
      if (entry.isDirectory()) return this.walk(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  private excluded(path: string, isDirectory: boolean): boolean {
    const name = path.split("/").at(-1) ?? "";
    if (isDirectory) {
      return (
        ["node_modules", "testing", "__dom-tests__"].includes(name) || this.isUserExcluded(path)
      );
    }
    return /\.test\.tsx?$|\.d\.ts$/.test(name) || this.isUserExcluded(path);
  }

  private isUserExcluded(path: string): boolean {
    return this.options.exclude?.(path) ?? false;
  }
}
