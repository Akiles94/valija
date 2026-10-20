import {
  createExtractedFacts,
  type ExtractedFacts,
  type Extractor,
} from "../../core/application/ports/extractor.js";
import { SYMBOL_ROW_KIND } from "../../core/domain/services/guide-assembly.js";
import { createCatalogue } from "../../core/domain/values/catalogue.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";

/** A use-case class: one actor intent, one entry point (CONTRIBUTING). */
export interface UseCaseInfo {
  readonly name: string;
  readonly module: string;
  readonly file: string;
  readonly line: number;
  readonly summary: string | null;
}

/** Every `export class X implements (Async)UseCase<…>` under `src/<module>/application/use-cases/`. */
export function findUseCases(files: readonly SourceFile[]): UseCaseInfo[] {
  return files
    .filter((f) => /^src\/[^/]+\/application\/use-cases\/[^/]+\.use-case\.ts$/.test(f.path))
    .flatMap((file) =>
      file.scanned.declarations
        .filter((d) => d.exported && d.declaration === "class")
        .filter((d) => /\bimplements\s+(Async)?UseCase</.test(d.span.code))
        .map((d) => ({
          name: d.name,
          module: file.path.split("/")[1] as string,
          file: file.path,
          line: d.line,
          summary: d.doc === null ? null : firstSentence(d.doc),
        })),
    );
}

/** First sentence of a doc comment, tags removed. */
export function firstSentence(doc: string): string {
  const body = doc.split(/(?:^|\n)\s*@/)[0] ?? "";
  return (
    body
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s/)[0] ?? ""
  ).trim();
}

/** Lists use cases on `reference/use-cases.md` and requires each to be cited by a flow (D-8). */
export class UseCasesExtractor implements Extractor {
  readonly name = "valija-use-cases";

  constructor(private readonly sources: () => readonly SourceFile[]) {}

  async extract(): Promise<ExtractedFacts> {
    const useCases = findUseCases(this.sources());
    const byName = new Map(useCases.map((u) => [u.name, u]));
    return createExtractedFacts({
      catalogues: [
        createCatalogue({
          id: "use-cases",
          page: "reference/use-cases.md",
          title: "Use cases",
          intro:
            "Every business action is one use-case class: one actor intent, one entry point. Entry points (CLI, MCP, desktop) only call these.",
          columns: ["Use case", "Module", "What it does"],
          rows: useCases.map((u) => ({
            key: { kind: SYMBOL_ROW_KIND, name: u.name, label: u.name },
            cells: [{ text: u.name, href: u.file }, { text: u.module }, { text: u.summary ?? "—" }],
          })),
        }),
      ],
      requirements: [
        {
          kind: null,
          names: useCases.map((u) => u.name),
          reason: "every use case",
          locate: (name) => {
            const u = byName.get(name);
            return u ? { file: u.file, line: u.line } : { file: "src" };
          },
        },
      ],
    });
  }
}
