import { FLOW_SECTIONS, type Flow } from "../entities/flow.js";
import type { DocumentedSymbol } from "../values/documented-symbol.js";
import { createFinding, type Finding } from "../values/finding.js";

/** "Every item of this kind must be cited by at least one flow" (D-8). `kind: null` = symbols. */
export interface CoverageRequirement {
  readonly kind: string | null;
  readonly names: readonly string[];
  readonly reason: string;
  /** Where to point the finding when an item is uncited (e.g. the declaring file). */
  readonly locate?: (name: string) => { file: string; line?: number };
}

/** D-7: a required doc must exist and must say more than the symbol's own name. */
export function findUndocumentedSymbols(symbols: readonly DocumentedSymbol[]): Finding[] {
  return symbols.flatMap((symbol) => {
    if (!symbol.requiresDoc) return [];
    const at = { file: symbol.file, line: symbol.line, subject: symbol.name };
    if (symbol.doc === null || symbol.doc.trim() === "") {
      return [
        createFinding({
          ...at,
          rule: "undocumented-export",
          message: `exported ${symbol.declaration} \`${symbol.name}\` has no TSDoc`,
        }),
      ];
    }
    if (isTrivialDoc(symbol.doc, symbol.name)) {
      return [
        createFinding({
          ...at,
          rule: "trivial-doc",
          message: `the TSDoc of \`${symbol.name}\` only restates its name; say what it does or why`,
        }),
      ];
    }
    return [];
  });
}

/** A doc is trivial when its first sentence, tags removed, is empty or just the name again. */
export function isTrivialDoc(doc: string, name: string): boolean {
  const summary = (doc.split(/(?:^|\n)\s*@/)[0] ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const text = squash(summary);
  return text === "" || text === squash(name) || text === squash(splitCamel(name));
}

function splitCamel(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/** D-8: every required item must be cited by at least one flow. */
export function findUnreferencedItems(
  requirements: readonly CoverageRequirement[],
  cited: ReadonlySet<string>,
): Finding[] {
  return requirements.flatMap((requirement) =>
    requirement.names
      .filter((name) => !cited.has(citationKey(requirement.kind, name)))
      .map((name) => {
        const where = requirement.locate?.(name) ?? { file: "docs/flows" };
        const label = requirement.kind === null ? name : `${requirement.kind}:${name}`;
        return createFinding({
          rule: "unreferenced-item",
          file: where.file,
          line: where.line,
          subject: label,
          message: `${label} is not cited by any flow (${requirement.reason}); add it to a flow in docs/flows/`,
        });
      }),
  );
}

/** Key a citation is recorded under, shared by assembly and the coverage rule. */
export function citationKey(kind: string | null, name: string): string {
  return kind === null ? `symbol:${name}` : `${kind}:${name}`;
}

/** D-15: both reading levels must be present; entry points must speak for CLI and desktop. */
export function findMissingSections(flow: Flow): Finding[] {
  const missing = [...FLOW_SECTIONS.business, ...FLOW_SECTIONS.technical]
    .filter((heading) => !flow.sections.has(heading) || flow.sections.get(heading)?.text === "")
    .map((heading) =>
      createFinding({
        rule: "missing-section",
        file: flow.file,
        subject: heading,
        message: `flow "${flow.title}" needs a non-empty \`## ${heading}\` section`,
      }),
    );

  const entry = flow.sections.get("Entry points");
  if (entry && entry.text !== "") {
    for (const surface of ["CLI", "Desktop"]) {
      if (!new RegExp(`^\\s*[-*]?\\s*\\**${surface}:`, "m").test(entry.text)) {
        missing.push(
          createFinding({
            rule: "missing-section",
            file: flow.file,
            line: entry.line,
            subject: `Entry points / ${surface}`,
            message: `\`## Entry points\` needs a \`${surface}:\` line (a reference, or why there is none)`,
          }),
        );
      }
    }
  }
  if (flow.sections.has("Steps") && flow.steps.length === 0) {
    missing.push(
      createFinding({
        rule: "missing-section",
        file: flow.file,
        line: flow.sections.get("Steps")?.line,
        subject: "Steps",
        message: "`## Steps` needs at least one `N. [From → To] text` step",
      }),
    );
  }
  return missing;
}
