import { describe, expect, it } from "vitest";
import { type CatalogueRow, createCatalogue, itemAnchor } from "./catalogue.js";
import { createGraph } from "./graph.js";

const shuffle = <T>(items: readonly T[], seed: number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seed * (i + 7)) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

describe("createCatalogue / createGraph determinism", () => {
  const rows: CatalogueRow[] = ["status", "lock", "unlock", "init", "Export"].map((name) => ({
    key: { kind: "cli", name, label: name },
    cells: [{ text: name }],
  }));

  it("produces identical output for any input order", () => {
    const base = createCatalogue({ id: "c", page: "p.md", title: "T", columns: ["A"], rows });
    for (let seed = 1; seed < 20; seed++) {
      const again = createCatalogue({
        id: "c",
        page: "p.md",
        title: "T",
        columns: ["A"],
        rows: shuffle(rows, seed),
      });
      expect(again).toEqual(base);
    }
    expect(base.rows.map((r) => r.key?.name)).toEqual([
      "Export",
      "init",
      "lock",
      "status",
      "unlock",
    ]);
  });

  it("de-duplicates and sorts graph nodes and edges", () => {
    const nodes = [
      { id: "b", label: "B" },
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const edges = [
      { from: "b", to: "a" },
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ];
    const base = createGraph({ id: "g", page: "p.md", title: "G", direction: "LR", nodes, edges });
    expect(base.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(base.edges).toHaveLength(2);
    for (let seed = 1; seed < 10; seed++) {
      const again = createGraph({
        id: "g",
        page: "p.md",
        title: "G",
        direction: "LR",
        nodes: shuffle(nodes, seed),
        edges: shuffle(edges, seed),
      });
      expect(again).toEqual(base);
    }
  });

  it("derives stable anchors", () => {
    expect(itemAnchor({ kind: "ipc", name: "vault:unlock" })).toBe("ipc-vault-unlock");
    expect(itemAnchor({ kind: "err", name: "VAULT_LOCKED" })).toBe("err-vault-locked");
  });
});
