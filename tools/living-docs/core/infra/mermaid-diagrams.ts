import type { FlowStep } from "../domain/entities/flow.js";
import type { Graph } from "../domain/values/graph.js";

/** Escapes characters Mermaid would parse as syntax, using its `#code;` entities. */
export function escapeMermaid(text: string): string {
  const entities: Record<string, string> = {
    "#": "#35;",
    ";": "#59;",
    '"': "#quot;",
    "<": "#lt;",
    ">": "#gt;",
  };
  return text.replace(/[#;"<>]/g, (c) => entities[c] as string);
}

/**
 * Step text for a diagram arrow: trailing `— {{ref}}` citations are dropped (the step list links
 * them), inline citations become their readable label, and Markdown code ticks go.
 */
export function plainStepText(text: string): string {
  return text
    .replace(/\s+[—-]\s*(?:\{\{[^{}]*\}\}[\s,]*)+$/, "")
    .replace(/\{\{([^{}]*)\}\}/g, (_, raw: string) => raw.split("/").at(-1)?.trim() ?? raw)
    .replace(/`/g, "")
    .trim();
}

/** One sequence diagram per flow: participants in first-use order, one message per step. */
export function renderSequenceDiagram(steps: readonly FlowStep[]): string {
  const ids = new Map<string, string>();
  const idOf = (name: string) => {
    let id = ids.get(name);
    if (!id) {
      id = `P${ids.size + 1}`;
      ids.set(name, id);
    }
    return id;
  };
  const messages = steps.map(
    (step) =>
      `  ${idOf(step.from)}->>${idOf(step.to)}: ${step.number}. ${escapeMermaid(plainStepText(step.text))}`,
  );
  const participants = [...ids].map(
    ([name, id]) => `  participant ${id} as ${escapeMermaid(name)}`,
  );
  return ["```mermaid", "sequenceDiagram", ...participants, ...messages, "```"].join("\n");
}

/** A flowchart from a graph: sanitized node ids, quoted labels, optional edge labels. */
export function renderFlowchart(graph: Graph): string {
  const id = (raw: string) => `n_${raw.replace(/[^A-Za-z0-9_]/g, "_")}`;
  const nodes = graph.nodes.map((n) => `  ${id(n.id)}["${escapeMermaid(n.label)}"]`);
  const edges = graph.edges.map((e) =>
    e.label
      ? `  ${id(e.from)} -->|${escapeMermaid(e.label)}| ${id(e.to)}`
      : `  ${id(e.from)} --> ${id(e.to)}`,
  );
  return ["```mermaid", `flowchart ${graph.direction}`, ...nodes, ...edges, "```"].join("\n");
}
