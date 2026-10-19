import { byCodeUnit } from "../result.js";
import type { Reference } from "./reference.js";

/** Identity of a citable catalogue item, e.g. `{ kind: "cli", name: "unlock" }`. */
export interface ItemKey {
  readonly kind: string;
  readonly name: string;
  readonly label: string;
}

/** A link to a guide page (guide-relative) or a repo file (repo-relative); see `Cell`. */
export interface Link {
  readonly text: string;
  readonly href: string;
}

/**
 * One table cell: plain text, optionally linking to a repo file (`href`, repo-relative), to a
 * cited item (`ref`), or to several guide pages at once (`links`, guide-relative).
 */
export interface Cell {
  readonly text: string;
  readonly href?: string;
  readonly ref?: Reference;
  readonly links?: readonly Link[];
}

/** One table row; keyed rows can be cited from flows and get "Cited by" back-links. */
export interface CatalogueRow {
  readonly key?: ItemKey;
  readonly cells: readonly Cell[];
}

/** A reference table an extractor contributes (commands, channels, error codes…). */
export interface Catalogue {
  readonly id: string;
  /** Guide-relative posix path of the page the table renders on. */
  readonly page: string;
  readonly title: string;
  readonly intro?: string;
  readonly columns: readonly string[];
  readonly rows: readonly CatalogueRow[];
}

/** Total factory that sorts rows by key name (or first cell), so extractors never have to. */
export function createCatalogue(input: {
  id: string;
  page: string;
  title: string;
  intro?: string | undefined;
  columns: readonly string[];
  rows: readonly CatalogueRow[];
}): Catalogue {
  const sortKey = (row: CatalogueRow) => row.key?.name ?? row.cells[0]?.text ?? "";
  const rows = [...input.rows].sort((a, b) => byCodeUnit(sortKey(a), sortKey(b)));
  const { intro, ...rest } = input;
  return intro === undefined ? { ...rest, rows } : { ...rest, intro, rows };
}

/** The anchor id a keyed row renders with, shared by renderer and back-link resolution. */
export function itemAnchor(key: Pick<ItemKey, "kind" | "name">): string {
  return `${key.kind}-${key.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.replace(/-+$/, "");
}
