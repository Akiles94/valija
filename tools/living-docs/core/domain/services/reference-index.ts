import { byCodeUnit } from "../result.js";
import type { Catalogue, CatalogueRow } from "../values/catalogue.js";
import type { DocumentedSymbol } from "../values/documented-symbol.js";
import { createFinding, type Finding } from "../values/finding.js";
import { type Reference, referenceLabel } from "../values/reference.js";

/** Everything a flow can cite: exported symbols by name, catalogue rows by `kind:name`. */
export interface ReferenceIndex {
  readonly symbols: ReadonlyMap<string, readonly DocumentedSymbol[]>;
  readonly items: ReadonlyMap<string, { catalogue: Catalogue; row: CatalogueRow }>;
}

/** What a reference points at once resolved. */
export type Resolution =
  | { readonly target: "symbol"; readonly reference: Reference; readonly symbol: DocumentedSymbol }
  | {
      readonly target: "item";
      readonly reference: Reference;
      readonly catalogue: Catalogue;
      readonly row: CatalogueRow;
    };

/** Builds the lookup tables reference resolution runs against. */
export function buildReferenceIndex(
  symbols: readonly DocumentedSymbol[],
  catalogues: readonly Catalogue[],
): ReferenceIndex {
  const byName = new Map<string, DocumentedSymbol[]>();
  for (const symbol of symbols) {
    const list = byName.get(symbol.name) ?? [];
    if (!list.some((s) => s.file === symbol.file)) list.push(symbol);
    byName.set(symbol.name, list);
  }
  const items = new Map<string, { catalogue: Catalogue; row: CatalogueRow }>();
  for (const catalogue of catalogues) {
    for (const row of catalogue.rows) {
      if (row.key) items.set(`${row.key.kind}:${row.key.name}`, { catalogue, row });
    }
  }
  return { symbols: byName, items };
}

/**
 * Resolves one reference. A symbol exported from several files is ambiguous unless its
 * qualifier segments appear, in order, among the declaring file's directories (P-D6).
 */
export function resolveReference(
  index: ReferenceIndex,
  reference: Reference,
  at: { file: string; line: number },
): Resolution | Finding {
  const fail = (rule: "broken-reference" | "ambiguous-reference", message: string) =>
    createFinding({ rule, file: at.file, line: at.line, subject: `{{${reference.raw}}}`, message });

  if (reference.kind !== null) {
    const hit = index.items.get(`${reference.kind}:${reference.name}`);
    if (!hit) return fail("broken-reference", `${referenceLabel(reference)} does not exist`);
    return { target: "item", reference, catalogue: hit.catalogue, row: hit.row };
  }

  const candidates = (index.symbols.get(reference.name) ?? []).filter((s) =>
    qualifierMatches(reference.qualifier, s.file),
  );
  if (candidates.length === 0) {
    return fail("broken-reference", `no exported symbol \`${reference.raw}\` exists`);
  }
  if (candidates.length > 1) {
    const files = candidates.map((c) => c.file).sort(byCodeUnit);
    return fail(
      "ambiguous-reference",
      `\`${reference.name}\` is exported from ${files.join(", ")}; qualify it, e.g. {{folder/${reference.name}}}`,
    );
  }
  return { target: "symbol", reference, symbol: candidates[0] as DocumentedSymbol };
}

/** True when every qualifier segment appears, in order, among the file's directory segments. */
export function qualifierMatches(qualifier: readonly string[], file: string): boolean {
  const dirs = file.split("/").slice(0, -1);
  let from = 0;
  for (const segment of qualifier) {
    const at = dirs.indexOf(segment, from);
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}
