import type { CoverageRequirement } from "../../domain/services/guide-rules.js";
import type { Catalogue } from "../../domain/values/catalogue.js";
import type { DocumentedSymbol } from "../../domain/values/documented-symbol.js";
import type { Finding } from "../../domain/values/finding.js";
import type { Graph } from "../../domain/values/graph.js";

/** Everything one extractor learned about a repository — data only, never Markdown (D-14). */
export interface ExtractedFacts {
  readonly symbols: readonly DocumentedSymbol[];
  readonly catalogues: readonly Catalogue[];
  readonly graphs: readonly Graph[];
  /** "Every item of this kind/name must be cited by ≥ 1 flow" (D-8). */
  readonly requirements: readonly CoverageRequirement[];
  /** Problems only this extractor can see (e.g. parity gaps, undocumented error codes). */
  readonly findings: readonly Finding[];
}

/** The only contract a repository-specific extractor implements. No discovery, no plugins. */
export interface Extractor {
  readonly name: string;
  extract(): Promise<ExtractedFacts>;
}

/** Total factory: omitted parts are empty, so extractors only spell out what they found. */
export function createExtractedFacts(parts: Partial<ExtractedFacts>): ExtractedFacts {
  return {
    symbols: parts.symbols ?? [],
    catalogues: parts.catalogues ?? [],
    graphs: parts.graphs ?? [],
    requirements: parts.requirements ?? [],
    findings: parts.findings ?? [],
  };
}
