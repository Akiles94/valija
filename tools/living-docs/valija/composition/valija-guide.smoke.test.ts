import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanTypeScript } from "../../core/infra/typescript-scanner.js";
import { createValijaExtractors } from "./valija-guide.js";

const repoRoot = join(import.meta.dirname, "../../../..");

async function extractAll() {
  const all = [];
  for (const extractor of createValijaExtractors(repoRoot)) all.push(await extractor.extract());
  return {
    findings: all.flatMap((f) => f.findings),
    catalogues: all.flatMap((f) => f.catalogues),
    graphs: all.flatMap((f) => f.graphs),
  };
}

describe("Valija extractors over the real repository", () => {
  it("read every surface without failures and find what the guide promises", async () => {
    const facts = await extractAll();
    expect(facts.findings.filter((f) => f.rule === "unscannable-source")).toEqual([]);

    const keys = new Set(
      facts.catalogues.flatMap((c) =>
        c.rows.flatMap((r) => (r.key ? [`${r.key.kind}:${r.key.name}`] : [])),
      ),
    );
    for (const command of [
      "init",
      "unlock",
      "lock",
      "status",
      "export",
      "import",
      "install",
      "doctor",
    ]) {
      expect(keys).toContain(`cli:${command}`);
    }
    for (const tool of [
      "get_context",
      "list_projects",
      "save_context",
      "save_handoff",
      "search_context",
    ]) {
      expect(keys).toContain(`mcp:${tool}`);
    }
    expect([...keys].filter((k) => k.startsWith("ipc:"))).toHaveLength(29);
    expect([...keys].filter((k) => k.startsWith("symbol:"))).toHaveLength(13);
    expect([...keys].filter((k) => k.startsWith("err:"))).toHaveLength(36);

    const composition = facts.graphs.find((g) => g.id === "composition");
    expect(composition?.nodes.map((n) => n.id)).toContain("ImportItems");

    const parity = facts.catalogues.find((c) => c.id === "parity");
    const gaps = parity?.rows.filter((r) => r.cells[2]?.text.startsWith("Known gap"));
    expect(gaps?.flatMap((r) => r.cells[1]?.links?.map((l) => l.text) ?? [])).toContain(
      "relocation:move",
    );
  });

  it("never writes to the user's home, state or vault folders", async () => {
    const vars = ["VALIJA_HOME", "VALIJA_STATE_HOME", "HOME", "USERPROFILE"] as const;
    const saved = Object.fromEntries(vars.map((v) => [v, process.env[v]]));
    const dirs = vars.map(() => mkdtempSync(join(tmpdir(), "living-docs-home-")));
    try {
      vars.forEach((v, i) => {
        process.env[v] = dirs[i];
      });
      await extractAll();
      for (const dir of dirs) expect(readdirSync(dir)).toEqual([]);
    } finally {
      for (const v of vars) {
        if (saved[v] === undefined) delete process.env[v];
        else process.env[v] = saved[v];
      }
      for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never builds a real container or runs a use case", () => {
    const dir = join(import.meta.dirname, "..");
    const offenders = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts"))
      .filter((p) => {
        const scanned = scanTypeScript(readFileSync(join(dir, p), "utf8"), { jsx: false });
        if (!scanned.ok) return true;
        return /\bbuildContainer\s*\(|\.\w+\s*\.execute\s*\(/.test(scanned.value.code);
      });
    expect(offenders).toEqual([]);
  });

  it("keeps no key-shaped secret in the guide or the flows", () => {
    const pages = ["docs/guide", "docs/flows"].flatMap((d) =>
      readdirSync(join(repoRoot, d), { recursive: true, encoding: "utf8" })
        .filter((p) => p.endsWith(".md"))
        .map((p) => join(repoRoot, d, p)),
    );
    for (const page of pages) expect(readFileSync(page, "utf8")).not.toMatch(/[0-9a-f]{64}/i);
  });
});
