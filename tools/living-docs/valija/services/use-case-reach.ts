import type { SourceFile } from "living-docs";

/** A function whose body may call use cases: a same-file helper or a `src/delivery` export. */
export interface Callable {
  readonly name: string;
  readonly file: string;
  /** Masked body text: comments and string contents blanked. */
  readonly code: string;
}

/** Index of callables reach analysis may follow. */
export interface CallableIndex {
  /** Top-level functions per file (exported or not), for same-file hops. */
  readonly byFile: ReadonlyMap<string, ReadonlyMap<string, Callable>>;
  /** Exported functions of `src/delivery/**`, for cross-file hops. */
  readonly delivery: ReadonlyMap<string, Callable>;
}

/** Builds the callable index from scanned sources. */
export function indexCallables(files: readonly SourceFile[]): CallableIndex {
  const byFile = new Map<string, Map<string, Callable>>();
  const delivery = new Map<string, Callable>();
  for (const file of files) {
    const local = new Map<string, Callable>();
    for (const d of file.scanned.declarations) {
      if (d.declaration !== "function" || d.reexport) continue;
      const callable = { name: d.name, file: file.path, code: d.span.code };
      local.set(d.name, callable);
      if (d.exported && file.path.startsWith("src/delivery/")) delivery.set(d.name, callable);
    }
    byFile.set(file.path, local);
  }
  return { byFile, delivery };
}

const EXECUTE = /\.(\w+)\s*\.execute\(/g;
const CALL = /\b([A-Za-z_$][\w$]*)\s*\(/g;

/**
 * Container keys whose `.execute(` the code reaches, following calls into known callables for
 * up to `depth` hops: a CLI action → its command function → a delivery helper (e.g. `export` →
 * `exportCommand` → `exportProjectMarkdown`) is the deepest real chain.
 */
export function reachContainerKeys(
  code: string,
  file: string,
  index: CallableIndex,
  depth = 2,
): string[] {
  const keys = new Set<string>();
  const visited = new Set<string>();
  const walk = (text: string, at: string, remaining: number) => {
    for (const match of text.matchAll(EXECUTE)) keys.add(match[1] as string);
    if (remaining === 0) return;
    for (const match of text.matchAll(CALL)) {
      const name = match[1] as string;
      const target = index.byFile.get(at)?.get(name) ?? index.delivery.get(name);
      const id = target ? `${target.file}#${target.name}` : "";
      if (!target || visited.has(id)) continue;
      visited.add(id);
      walk(target.code, target.file, remaining - 1);
    }
  };
  walk(code, file, depth);
  return [...keys].sort();
}

/** `container key → use-case class`, read from `buildContainer`'s `key: new Class(` entries. */
export function readContainerUseCases(container: SourceFile): Map<string, string> {
  const build = container.scanned.declarations.find((d) => d.name === "buildContainer");
  const map = new Map<string, string>();
  for (const match of (build?.span.code ?? "").matchAll(/(\w+):\s*new\s+(\w+)\(/g)) {
    map.set(match[1] as string, match[2] as string);
  }
  return map;
}
