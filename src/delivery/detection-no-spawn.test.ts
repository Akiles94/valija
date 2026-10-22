import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Detection reads the local filesystem and nothing else (refined.md §10.3, D-J):
 * no process spawn, no network. Every detection source file is listed here by
 * hand — a literal array, so a new detection file is added on purpose and a
 * renamed one fails loudly instead of dropping out of the check. Desktop code is
 * out of scope (it never probes a workspace).
 */
const DETECTION_FILES = [
  "context/domain/values/binding-target.ts",
  "context/domain/values/repository-target.ts",
  "context/domain/services/project-resolution.ts",
  "context/application/ports/workspace-probe.ts",
  "context/application/use-cases/resolve-project.use-case.ts",
  "context/application/use-cases/link-workspace.use-case.ts",
  "context/application/use-cases/unlink-workspace.use-case.ts",
  "context/application/use-cases/list-project-bindings.use-case.ts",
  "context/infra/file-workspace-probe.ts",
  "context/infra/git/git-config.ts",
] as const;

/**
 * Process and network entry points. A bare `exec(`/`spawn(`/`fork(` call is
 * refused, but a method call such as `PATTERN.exec(text)` (a RegExp) is not —
 * any real process API needs a `child_process` import, which is refused anyway.
 */
const FORBIDDEN =
  /child_process|worker_threads|(?<![.\w$])(?:spawn|fork|exec(?:File)?(?:Sync)?)\(|\bfetch\(|node:(?:net|http|https|http2|tls|dgram|dns)\b/;

/** The only Node built-ins detection may import. */
const ALLOWED_NODE_MODULES = new Set(["node:fs", "node:path", "node:os"]);
const NODE_IMPORT = /from\s+"(node:[^"]+)"/g;

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("detection never spawns a process or touches the network", () => {
  it.each(DETECTION_FILES)("%s contains no process or network API", (file) => {
    expect(source(file)).not.toMatch(FORBIDDEN);
  });

  it.each(DETECTION_FILES)("%s imports only node:fs, node:path and node:os", (file) => {
    const imported = [...source(file).matchAll(NODE_IMPORT)].map((match) => match[1]);
    for (const module of imported) expect(ALLOWED_NODE_MODULES).toContain(module);
  });

  it("the pattern catches what it must and spares a RegExp's exec", () => {
    for (const bad of [
      'import { spawn } from "node:child_process";',
      "exec(`git config --get remote.origin.url`)",
      "execFileSync('git', ['remote'])",
      'import { request } from "node:https";',
      "await fetch(url)",
    ]) {
      expect(bad).toMatch(FORBIDDEN);
    }
    expect("const match = SCP_FORM.exec(raw);").not.toMatch(FORBIDDEN);
  });
});
