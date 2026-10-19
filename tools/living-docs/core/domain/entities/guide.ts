import type { Resolution } from "../services/reference-index.js";
import type { Catalogue } from "../values/catalogue.js";
import type { Finding } from "../values/finding.js";
import type { Graph } from "../values/graph.js";
import type { GuideSettings } from "../values/guide-settings.js";
import type { Flow } from "./flow.js";

/** A flow plus what each of its `{{…}}` citations resolved to (unresolved ones are absent). */
export interface ResolvedFlow {
  readonly flow: Flow;
  readonly resolutions: ReadonlyMap<string, Resolution>;
}

/** Headline numbers for the check summary. */
export interface GuideStats {
  readonly exports: number;
  readonly documented: number;
  readonly flows: number;
  readonly citations: number;
}

/** The assembled read model a renderer turns into pages; built once per run. */
export interface Guide {
  readonly settings: GuideSettings;
  readonly overview: string;
  readonly flows: readonly ResolvedFlow[];
  readonly catalogues: readonly Catalogue[];
  readonly graphs: readonly Graph[];
  readonly findings: readonly Finding[];
  readonly stats: GuideStats;
}
