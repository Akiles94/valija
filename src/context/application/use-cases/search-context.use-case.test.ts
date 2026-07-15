import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { SaveContext } from "./save-context.use-case.js";
import { SearchContext } from "./search-context.use-case.js";

const vault = makeUnlockedVault();
const save = new SaveContext(vault.sessions, new FixedClock(), new SeqIds());
const search = new SearchContext(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

beforeAll(() => {
  save.execute({ project: "proj-one", content: "we chose sqlcipher for the vault" });
  save.execute({ project: "proj-two", content: "sqlcipher mentioned here too" });
});

describe("SearchContext", () => {
  it("finds matches across all projects", () => {
    const r = search.execute({ query: "sqlcipher" });
    expect(r.ok && r.value.length).toBe(2);
  });

  it("scopes the search to one project", () => {
    const r = search.execute({ query: "sqlcipher", project: "proj-two" });
    expect(r.ok && r.value).toHaveLength(1);
    if (r.ok) expect(r.value[0]?.project).toBe("proj-two");
  });

  it("errors on an unknown project scope", () => {
    const r = search.execute({ query: "x", project: "ghost" });
    expect(!r.ok && r.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns empty for a whitespace query instead of an FTS error", () => {
    const r = search.execute({ query: "   " });
    expect(r.ok && r.value).toHaveLength(0);
  });
});
