import { existsSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import type { SourceFile } from "living-docs";
import {
  byCodeUnit,
  createCatalogue,
  createExtractedFacts,
  createGraph,
  type ExtractedFacts,
  type Extractor,
  type GraphEdge,
} from "living-docs";
import { findUseCases } from "./use-cases.extractor.js";

const LAYERS = ["domain", "application", "infra"] as const;
const CONTAINER_FILE = "src/delivery/container.ts";

/**
 * The technical map: modules and their layers, who imports whom, and which adapter the
 * composition root plugs into each use-case port.
 */
export class ArchitectureExtractor implements Extractor {
  readonly name = "valija-architecture";

  constructor(
    private readonly repoRoot: string,
    private readonly sources: () => readonly SourceFile[],
  ) {}

  async extract(): Promise<ExtractedFacts> {
    const files = this.sources();
    return createExtractedFacts({
      catalogues: [this.moduleMap()],
      graphs: [this.dependencies(files), wiring(files)],
    });
  }

  private moduleMap() {
    const modules = readdirSync(join(this.repoRoot, "src"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "testing")
      .map((d) => d.name)
      .sort(byCodeUnit);
    const rows = modules.map((module) => {
      const spec = `specs/${module}.md`;
      return {
        cells: [
          existsSync(join(this.repoRoot, spec))
            ? { text: module, href: spec }
            : { text: module, href: `src/${module}` },
          ...(LAYERS.some((layer) => existsSync(join(this.repoRoot, "src", module, layer)))
            ? LAYERS.map((layer) => ({ text: this.kinds(`src/${module}/${layer}`) }))
            : [
                { text: `entry points: ${this.kinds(`src/${module}`)}` },
                { text: "—" },
                { text: "—" },
              ]),
        ],
      };
    });
    rows.push({
      cells: [
        existsSync(join(this.repoRoot, "specs/desktop.md"))
          ? { text: "desktop", href: "specs/desktop.md" }
          : { text: "desktop", href: "desktop/src" },
        { text: "— (uses the src/ use cases)" },
        { text: this.kinds("desktop/src/main/application") },
        { text: "main/infra/, main/ipc/, preload/, renderer/, shared/" },
      ],
    });
    return createCatalogue({
      id: "modules",
      page: "architecture.md",
      position: 0,
      title: "Modules and layers",
      intro:
        "One bounded context per `src/` folder, each split into **domain** (pure rules) ← **application** (use cases and ports) ← **infra** (adapters: SQLCipher, Argon2, keychain, files). `delivery` (CLI, MCP) and the desktop app are the entry points. Each cell lists the kind folders found in that layer; `delivery` has no layers of its own. Module names link to their behaviour spec.",
      columns: ["Module", "domain", "application", "infra"],
      rows,
    });
  }

  private kinds(dir: string): string {
    const path = join(this.repoRoot, dir);
    if (!existsSync(path)) return "—";
    const entries = readdirSync(path, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => `${e.name}/`)
      .sort(byCodeUnit);
    const adapters = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".ts") && !e.name.includes(".test."),
    ).length;
    const parts = [...folders, ...(adapters > 0 ? [`${adapters} file(s)`] : [])];
    return parts.join(", ") || "—";
  }

  private dependencies(files: readonly SourceFile[]) {
    const edges: GraphEdge[] = [];
    const moduleOf = (path: string) =>
      path.startsWith("desktop/") ? "desktop" : path.startsWith("src/") ? path.split("/")[1] : null;
    for (const file of files) {
      const from = moduleOf(file.path);
      for (const specifier of file.scanned.imports) {
        if (!specifier.startsWith(".")) continue;
        const target = posix.normalize(posix.join(posix.dirname(file.path), specifier));
        const to = moduleOf(target);
        if (from && to && from !== to) edges.push({ from, to });
      }
    }
    const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].map((id) => ({
      id,
      label: id,
    }));
    return createGraph({
      id: "module-dependencies",
      page: "architecture.md",
      position: 1,
      title: "Module dependencies",
      intro:
        'Computed from the real `import` statements (type-only imports included). An arrow means "imports from"; edges are shown as they are, without judgement.',
      direction: "LR",
      nodes,
      edges,
    });
  }
}

/** `UseCase -->|Port| Adapter`, from `buildContainer` and each use case's constructor types. */
export function wiring(files: readonly SourceFile[]) {
  const container = files.find((f) => f.path === CONTAINER_FILE);
  const build = container?.scanned.declarations.find((d) => d.name === "buildContainer");
  if (!build) throw new Error(`cannot find buildContainer in ${CONTAINER_FILE}`);
  const code = build.span.source;

  const variables = new Map<string, string>();
  for (const m of code.matchAll(/const\s+(\w+)\s*=\s*new\s+(\w+)\(/g)) {
    variables.set(m[1] as string, m[2] as string);
  }
  const useCases = new Map(findUseCases(files).map((u) => [u.name, u]));
  const edges: GraphEdge[] = [];
  for (const m of code.matchAll(/new\s+(\w+)\(/g)) {
    const name = m[1] as string;
    const useCase = useCases.get(name);
    if (!useCase) continue;
    const args = splitArguments(code, (m.index as number) + m[0].length);
    const ports = constructorTypes(files, useCase.file, name);
    args.forEach((arg, i) => {
      const inline = /^new\s+(\w+)\(/.exec(arg)?.[1];
      const target = inline ?? variables.get(arg) ?? arg;
      const port = ports[i];
      edges.push(port ? { from: name, to: target, label: port } : { from: name, to: target });
    });
  }
  const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].map((id) => ({ id, label: id }));
  return createGraph({
    id: "composition",
    page: "architecture.md",
    position: 2,
    title: "Composition: which adapter fills each port",
    intro:
      "Read from `buildContainer` in `src/delivery/container.ts`. Each arrow goes from a use case to what it receives, labelled with the port (constructor parameter type) it is received as.",
    direction: "LR",
    nodes,
    edges,
  });
}

/** Top-level comma-separated arguments of the call whose `(` ends just before `start`. */
function splitArguments(code: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = start; i < code.length; i++) {
    const c = code[i] as string;
    if (c === "(" || c === "{" || c === "[") depth++;
    if (c === ")" || c === "}" || c === "]") {
      if (depth === 0) break;
      depth--;
    }
    if (c === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim() !== "") args.push(current.trim());
  return args;
}

/** Parameter types of `constructor(private readonly a: Port, …)` in the given class. */
function constructorTypes(files: readonly SourceFile[], file: string, className: string): string[] {
  const source = files.find((f) => f.path === file);
  const cls = source?.scanned.declarations.find((d) => d.name === className);
  const ctor = /constructor\(([\s\S]*?)\)\s*\{/.exec(cls?.span.source ?? "");
  if (!ctor) return [];
  return (ctor[1] as string)
    .split(",")
    .map((p) => /:\s*([\w.]+)/.exec(p)?.[1])
    .filter((t): t is string => t !== undefined);
}
