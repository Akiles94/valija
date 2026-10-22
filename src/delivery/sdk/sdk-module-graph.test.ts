import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENTRY = join(SRC, "delivery", "sdk", "index.ts");

interface Graph {
  /** Source files reachable at runtime from the entry, relative to src/. */
  files: string[];
  /** Bare specifiers (packages and node: builtins) those files import at runtime. */
  packages: string[];
}

/**
 * Every runtime import reachable from the SDK entry, read from source. Type-only statements
 * (`import type` / `export type`) are skipped: they vanish at build time and load nothing.
 */
function walk(entry: string): Graph {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, "utf8");
    const statements = source.matchAll(
      /^(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm,
    );
    for (const [, typeOnly, specifier] of statements) {
      if (typeOnly !== undefined || specifier === undefined) continue;
      if (specifier.startsWith("."))
        queue.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
      else packages.add(specifier);
    }
    for (const [, specifier] of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
      if (specifier !== undefined) packages.add(`dynamic:${specifier}`);
    }
  }
  return {
    files: [...files].map((f) => relative(SRC, f).replaceAll("\\", "/")).sort(),
    packages: [...packages].sort(),
  };
}

const graph = walk(ENTRY);
const folders = [...new Set(graph.files.map((f) => dirname(f)))].sort();

describe("the valija/sdk module graph (§9)", () => {
  it("never loads the CLI or the MCP server", () => {
    expect(
      graph.files.filter((f) => f.startsWith("delivery/cli/") || f.startsWith("delivery/mcp/")),
    ).toEqual([]);
    expect(
      graph.packages.filter((p) => p === "commander" || p.startsWith("@modelcontextprotocol/")),
    ).toEqual([]);
  });

  it("has no network, process-spawning or dynamic import", () => {
    const forbidden =
      /^(node:)?(http|https|http2|net|tls|dgram|dns|child_process|cluster|worker_threads|inspector)$|^undici|^dynamic:/;
    expect(graph.packages.filter((p) => forbidden.test(p))).toEqual([]);
    for (const file of graph.files) {
      const source = readFileSync(join(SRC, file), "utf8");
      expect(source, file).not.toMatch(/\bfetch\(|\bWebSocket\b|\bXMLHttpRequest\b/);
    }
  });

  it("imports exactly these packages", () => {
    expect(graph.packages).toEqual([
      "@napi-rs/keyring",
      "argon2",
      "better-sqlite3-multiple-ciphers",
      "fflate",
      "node:crypto",
      "node:fs",
      "node:os",
      "node:path",
      "ulid",
      "zod",
    ]);
  });

  it("reaches exactly these folders", () => {
    expect(folders).toEqual(EXPECTED_FOLDERS);
  });

  it("takes only the container and the pack renderer from delivery/", () => {
    expect(graph.files.filter((f) => dirname(f) === "delivery")).toEqual([
      "delivery/container.ts",
      "delivery/context-pack-markdown.ts",
    ]);
  });

  it("is never touched by a test helper", () => {
    expect(graph.files.filter((f) => f.startsWith("testing/") || f.endsWith(".test.ts"))).toEqual(
      [],
    );
  });
});

/** The container wires every use case, so the SDK reaches every module — but no delivery/cli or delivery/mcp. */
const EXPECTED_FOLDERS = [
  "context/application/dto",
  "context/application/services",
  "context/application/use-cases",
  "context/domain",
  "context/domain/entities",
  "context/domain/services",
  "context/domain/services/secret-detection",
  "context/domain/values",
  "context/infra",
  "context/infra/git",
  "delivery",
  "delivery/sdk",
  "delivery/sdk/dto",
  "delivery/sdk/facade",
  "delivery/sdk/mapping",
  "delivery/sdk/validation",
  "importers/application/use-cases",
  "importers/domain",
  "importers/domain/services",
  "importers/infra",
  "importers/infra/parsers",
  "shared/domain",
  "shared/domain/services",
  "shared/infra",
  "shared/infra/migrations",
  "vault/application/policies",
  "vault/application/ports",
  "vault/application/services",
  "vault/application/use-cases",
  "vault/domain",
  "vault/domain/services",
  "vault/domain/values",
  "vault/infra",
];
