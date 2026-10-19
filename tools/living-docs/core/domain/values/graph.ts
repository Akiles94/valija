import { byCodeUnit } from "../result.js";

/** A diagram node; `id` is stable, `label` is what readers see. */
export interface GraphNode {
  readonly id: string;
  readonly label: string;
}

/** A directed edge, optionally labelled (e.g. with the port it goes through). */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

/** A flowchart an extractor contributes (module dependencies, composition wiring…). */
export interface Graph {
  readonly id: string;
  /** Guide-relative posix path of the page the diagram renders on. */
  readonly page: string;
  readonly title: string;
  readonly intro?: string;
  /** Order among the items sharing a page (default 0); ties sort by id. */
  readonly position?: number;
  readonly direction: "LR" | "TD";
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Total factory that de-duplicates and sorts nodes and edges, so output never depends on order. */
export function createGraph(input: {
  id: string;
  page: string;
  title: string;
  intro?: string | undefined;
  position?: number;
  direction: "LR" | "TD";
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}): Graph {
  const nodes = [...new Map(input.nodes.map((n) => [n.id, n])).values()].sort((a, b) =>
    byCodeUnit(a.id, b.id),
  );
  const edgeKey = (e: GraphEdge) => `${e.from}\u0000${e.to}\u0000${e.label ?? ""}`;
  const edges = [...new Map(input.edges.map((e) => [edgeKey(e), e])).values()].sort((a, b) =>
    byCodeUnit(edgeKey(a), edgeKey(b)),
  );
  const { intro, ...rest } = input;
  return intro === undefined ? { ...rest, nodes, edges } : { ...rest, intro, nodes, edges };
}
