import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §9 item 77: no parser, chunker, selection rule, archive reader or
 * repository write is re-implemented in `desktop/` — every import write
 * routes through the same `ImportConversations` the CLI uses. Test files are
 * exempt: they legitimately construct real root use cases against fixtures
 * (mirroring `content-handlers.golden-fixture.test.ts`), which is scaffolding,
 * not a second implementation.
 */
const FORBIDDEN_IMPORT_SUBSTRINGS = [
  "importers/infra/parsers/",
  "importers/domain/services/",
  "importers/infra/file-export-reader",
  "context/infra/item-repo",
  "context/infra/project-repo",
  "context/infra/vault-sessions",
] as const;

const SRC_ROOT = join(import.meta.dirname, "../../../../src");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      collectSourceFiles(full, out);
    } else if ([".ts", ".tsx"].includes(extname(full)) && !full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("desktop/ never re-implements an importer parser, chunker, selection rule, or repository write", () => {
  const files = collectSourceFiles(SRC_ROOT).map((f) => relative(SRC_ROOT, f));

  it.each(files)("%s imports none of the forbidden modules directly", (relPath) => {
    const content = readFileSync(join(SRC_ROOT, relPath), "utf8");
    const offending = FORBIDDEN_IMPORT_SUBSTRINGS.filter((needle) => content.includes(needle));
    expect(offending).toEqual([]);
  });
});
