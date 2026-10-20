import { describe, expect, it } from "vitest";
import type { FlowStep } from "../domain/entities/flow.js";
import { createGraph } from "../domain/values/graph.js";
import { escapeMermaid, renderFlowchart, renderSequenceDiagram } from "./mermaid-diagrams.js";

const step = (number: number, from: string, to: string, text: string): FlowStep => ({
  number,
  from,
  to,
  text,
  references: [],
  line: number,
});

describe("renderSequenceDiagram", () => {
  it("declares participants in first-use order and numbers every message", () => {
    const diagram = renderSequenceDiagram([
      step(1, "User", "CLI", "Types `valija unlock` — {{cli:unlock}}"),
      step(2, "CLI", "UnlockVault", "Asks {{vault/UnlockVault}} to unlock"),
      step(3, "UnlockVault", "User", "Replies; done"),
    ]);
    expect(diagram.split("\n")).toEqual([
      "```mermaid",
      "sequenceDiagram",
      "  participant P1 as User",
      "  participant P2 as CLI",
      "  participant P3 as UnlockVault",
      "  P1->>P2: 1. Types valija unlock",
      "  P2->>P3: 2. Asks UnlockVault to unlock",
      "  P3->>P1: 3. Replies#59; done",
      "```",
    ]);
  });

  it("escapes characters Mermaid treats as syntax", () => {
    expect(escapeMermaid('a;b#c"d<e>')).toBe("a#59;b#35;c#quot;d#lt;e#gt;");
  });
});

describe("renderFlowchart", () => {
  it("sanitizes ids and labels edges", () => {
    const chart = renderFlowchart(
      createGraph({
        id: "g",
        page: "a.md",
        title: "G",
        direction: "TD",
        nodes: [
          { id: "vault/use-case", label: "UnlockVault" },
          { id: "port", label: "VaultStore" },
        ],
        edges: [{ from: "vault/use-case", to: "port", label: "store" }],
      }),
    );
    expect(chart).toContain('n_vault_use_case["UnlockVault"]');
    expect(chart).toContain("n_vault_use_case -->|store| n_port");
  });
});
