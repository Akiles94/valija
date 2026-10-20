import {
  createExtractedFacts,
  type ExtractedFacts,
  type Extractor,
} from "../../core/application/ports/extractor.js";
import { byCodeUnit } from "../../core/domain/result.js";
import { createCatalogue } from "../../core/domain/values/catalogue.js";
import { createFinding, type Finding } from "../../core/domain/values/finding.js";
import type { SourceFile } from "../../core/infra/typescript-exports-extractor.js";

/** One member of an `XErrorCode` union with its one-line meaning (D-11). */
export interface ErrorCode {
  readonly code: string;
  readonly union: string;
  readonly module: string;
  readonly file: string;
  readonly line: number;
  readonly doc: string | null;
}

const RAISE = /\b(?:vaultErr|vaultError|contextErr|importerErr)\(\s*"|\bnew DomainError\(\s*"/g;

/** Reads every `type XErrorCode = | "A" | "B";` in `src/<module>/domain/errors.ts`. */
export function readErrorCodes(files: readonly SourceFile[]): ErrorCode[] {
  return files
    .filter((f) => /^src\/[^/]+\/domain\/errors\.ts$/.test(f.path))
    .flatMap((file) => {
      const union = file.scanned.declarations.find(
        (d) => d.declaration === "type" && d.name.endsWith("ErrorCode"),
      );
      if (!union) return [];
      const codes: ErrorCode[] = [];
      let doc: string[] | null = null;
      let collecting: string[] | null = null;
      union.span.source.split("\n").forEach((text, i) => {
        let rest = text.trim();
        while (rest !== "") {
          if (collecting) {
            const end = rest.indexOf("*/");
            collecting.push(stripDoc(end < 0 ? rest : rest.slice(0, end)));
            if (end < 0) break;
            doc = collecting.filter((l) => l !== "");
            collecting = null;
            rest = rest.slice(end + 2).trim();
            continue;
          }
          if (rest.startsWith("|")) {
            rest = rest.slice(1).trim();
            continue;
          }
          if (rest.startsWith("/**")) {
            collecting = [];
            rest = rest.slice(3);
            continue;
          }
          const member = /^"([A-Z0-9_]+)"/.exec(rest);
          if (member) {
            codes.push({
              code: member[1] as string,
              union: union.name,
              module: file.path.split("/")[1] as string,
              file: file.path,
              line: union.line + i,
              doc: doc ? (doc as string[]).join(" ") : null,
            });
            doc = null;
            rest = rest.slice(member[0].length).trim();
            continue;
          }
          break;
        }
      });
      return codes;
    });
}

function stripDoc(line: string): string {
  return line.replace(/^\s*\*?\s?/, "").trim();
}

/** Error catalogue per module: code, meaning, where it is raised, which flows cite it. */
export class ErrorCodesExtractor implements Extractor {
  readonly name = "valija-error-codes";

  constructor(private readonly sources: () => readonly SourceFile[]) {}

  async extract(): Promise<ExtractedFacts> {
    const files = this.sources();
    const codes = readErrorCodes(files);
    const sites = raiseSites(files);
    const modules = [...new Set(codes.map((c) => c.module))].sort(byCodeUnit);

    const findings: Finding[] = codes
      .filter((c) => c.doc === null || c.doc.trim() === "")
      .map((c) =>
        createFinding({
          rule: "undocumented-export",
          file: c.file,
          line: c.line,
          subject: `${c.union} › ${c.code}`,
          message: `error code ${c.code} has no one-line doc in ${c.union} (D-11)`,
        }),
      );

    return createExtractedFacts({
      catalogues: modules.map((module) =>
        createCatalogue({
          id: `errors-${module}`,
          page: "reference/errors.md",
          title: `${module} errors`,
          intro: `Codes in \`${codes.find((c) => c.module === module)?.union}\`. Raise sites are found statically; desktop handlers that raise with \`new DomainError\` are included.`,
          columns: ["Code", "Meaning", "Raised in"],
          rows: codes
            .filter((c) => c.module === module)
            .map((c) => {
              const where = sites.get(c.code) ?? [];
              return {
                key: { kind: "err", name: c.code, label: c.code },
                cells: [
                  { text: c.code, href: c.file },
                  { text: c.doc ?? "—" },
                  where.length === 0
                    ? { text: "declared, never raised (statically)" }
                    : {
                        text: "",
                        links: where.map((p) => ({
                          text: p.split("/").at(-1) ?? p,
                          href: p,
                          repo: true,
                        })),
                      },
                ],
              };
            }),
        }),
      ),
      findings,
    });
  }
}

/** `code → files that raise it`, deduplicated and sorted. */
function raiseSites(files: readonly SourceFile[]): Map<string, string[]> {
  const sites = new Map<string, Set<string>>();
  for (const file of files) {
    for (const match of file.scanned.code.matchAll(RAISE)) {
      const open = (match.index as number) + match[0].length;
      const close = file.text.indexOf('"', open);
      const code = file.text.slice(open, close);
      if (!/^[A-Z0-9_]+$/.test(code)) continue;
      sites.set(code, (sites.get(code) ?? new Set()).add(file.path));
    }
  }
  return new Map([...sites].map(([code, set]) => [code, [...set].sort(byCodeUnit)]));
}
