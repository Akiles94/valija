import type { Flow } from "../entities/flow.js";
import type { Guide, ResolvedFlow } from "../entities/guide.js";
import { byCodeUnit } from "../result.js";
import type { Catalogue, CatalogueRow, Cell } from "../values/catalogue.js";
import { createCatalogue } from "../values/catalogue.js";
import type { DocumentedSymbol } from "../values/documented-symbol.js";
import { compareFindings, type Finding } from "../values/finding.js";
import type { Graph } from "../values/graph.js";
import type { GuideSettings } from "../values/guide-settings.js";
import {
  type CoverageRequirement,
  citationKey,
  findMissingSections,
  findUndocumentedSymbols,
  findUnreferencedItems,
} from "./guide-rules.js";
import { buildReferenceIndex, type Resolution, resolveReference } from "./reference-index.js";

/** Catalogue rows keyed with this kind are back-linked from plain `{{Symbol}}` citations. */
export const SYMBOL_ROW_KIND = "symbol";

/** All facts the extractors produced, merged. */
export interface MergedFacts {
  readonly symbols: readonly DocumentedSymbol[];
  readonly catalogues: readonly Catalogue[];
  readonly graphs: readonly Graph[];
  readonly requirements: readonly CoverageRequirement[];
  readonly findings: readonly Finding[];
}

/** Resolves every citation, applies the coverage rules, and adds "Cited by" back-links. */
export function assembleGuide(
  facts: MergedFacts,
  flows: readonly Flow[],
  overview: string,
  settings: GuideSettings,
): Guide {
  const citable = facts.catalogues.map((c) => ({
    ...c,
    rows: c.rows.filter((r) => r.key?.kind !== SYMBOL_ROW_KIND),
  }));
  const index = buildReferenceIndex(facts.symbols, citable);
  const findings: Finding[] = [...facts.findings];
  const citedBy = new Map<string, Set<Flow>>();
  let citations = 0;

  const sortedFlows = [...flows].sort((a, b) => byCodeUnit(a.slug, b.slug));
  const resolved: ResolvedFlow[] = sortedFlows.map((flow) => {
    const resolutions = new Map<string, Resolution>();
    for (const { reference, line } of flow.references) {
      const outcome = resolveReference(index, reference, { file: flow.file, line });
      if ("rule" in outcome) {
        findings.push(outcome);
        continue;
      }
      resolutions.set(reference.raw, outcome);
      citations++;
      const name = outcome.target === "symbol" ? outcome.symbol.name : reference.name;
      const key = citationKey(reference.kind, name);
      citedBy.set(key, (citedBy.get(key) ?? new Set()).add(flow));
    }
    findings.push(...findMissingSections(flow));
    return { flow, resolutions };
  });

  findings.push(...findUndocumentedSymbols(facts.symbols));
  findings.push(...findUnreferencedItems(facts.requirements, new Set(citedBy.keys())));

  const catalogues = facts.catalogues.map((c) => withBackLinks(c, citedBy));
  const required = facts.symbols.filter((s) => s.requiresDoc);
  return {
    settings,
    overview,
    flows: resolved,
    catalogues,
    graphs: facts.graphs,
    findings: findings.sort(compareFindings),
    stats: {
      exports: required.length,
      documented: required.length - findings.filter(isDocFinding).length,
      flows: resolved.length,
      citations,
    },
  };
}

function isDocFinding(f: Finding): boolean {
  return f.rule === "undocumented-export" || f.rule === "trivial-doc";
}

function withBackLinks(catalogue: Catalogue, citedBy: Map<string, Set<Flow>>): Catalogue {
  if (!catalogue.rows.some((r) => r.key)) return catalogue;
  const rows: CatalogueRow[] = catalogue.rows.map((row) => {
    if (!row.key) return { ...row, cells: [...row.cells, { text: "" }] };
    const kind = row.key.kind === SYMBOL_ROW_KIND ? null : row.key.kind;
    const flows = [...(citedBy.get(citationKey(kind, row.key.name)) ?? [])].sort((a, b) =>
      byCodeUnit(a.slug, b.slug),
    );
    const cell: Cell =
      flows.length === 0
        ? { text: "—" }
        : { text: "", links: flows.map((f) => ({ text: f.title, href: `flows/${f.slug}.md` })) };
    return { ...row, cells: [...row.cells, cell] };
  });
  return createCatalogue({ ...catalogue, columns: [...catalogue.columns, "Cited by"], rows });
}
