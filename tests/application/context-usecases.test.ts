import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { ExportPack } from "../../src/application/usecases/export-pack.js";
import {
  DEFAULT_BUDGET_TOKENS,
  estimateTokens,
  GetContextPack,
} from "../../src/application/usecases/get-context-pack.js";
import { ListProjects } from "../../src/application/usecases/list-projects.js";
import { SaveContext } from "../../src/application/usecases/save-context.js";
import { SearchContext } from "../../src/application/usecases/search-context.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../helpers/test-vault.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const save = new SaveContext(vault.factory, clock, new SeqIds());
const listProjects = new ListProjects(vault.factory);
const search = new SearchContext(vault.factory);
const getPack = new GetContextPack(vault.factory, clock);
const exportPack = new ExportPack(vault.factory, getPack);

afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("SaveContext + ListProjects", () => {
  it("auto-creates the project on first save (D9)", () => {
    const r = save.execute({
      project: "Vault-App",
      content: "we chose sqlcipher",
      type: "decision",
    });
    expect(r.ok && r.value).toMatchObject({ project: "vault-app", projectCreated: true });
    const again = save.execute({
      project: "vault-app",
      content: "restore flow is next",
      type: "progress",
    });
    expect(again.ok && again.value.projectCreated).toBe(false);
  });

  it("defaults type to fact and validates inputs", () => {
    const r = save.execute({ project: "vault-app", content: "argon2id, 64 MiB" });
    expect(r.ok && r.value.type).toBe("fact");
    expect(!save.execute({ project: "bad name!", content: "x" }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "  " }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "x", type: "wrong" }).ok).toBe(true);
  });

  it("lists projects with counts", () => {
    const r = listProjects.execute();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const entry = r.value.find((p) => p.name === "vault-app");
    expect(entry?.itemCount).toBeGreaterThanOrEqual(3);
  });

  it("returns VAULT_LOCKED when the key is gone", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = listProjects.execute();
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});

describe("SearchContext", () => {
  it("finds by content and scopes by project", () => {
    save.execute({ project: "other-proj", content: "sqlcipher mentioned here too" });
    const all = search.execute({ query: "sqlcipher" });
    expect(all.ok && all.value.length).toBeGreaterThanOrEqual(2);
    const scoped = search.execute({ query: "sqlcipher", project: "other-proj" });
    expect(scoped.ok && scoped.value).toHaveLength(1);
  });

  it("errors on unknown project", () => {
    const r = search.execute({ query: "x", project: "ghost" });
    expect(!r.ok && r.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("GetContextPack — the assembly algorithm", () => {
  it("errors on unknown project, renders empty project header-only", () => {
    expect(!getPack.execute({ project: "ghost" }).ok).toBe(true);
    save.execute({ project: "empty-ish", content: "solo item", type: "fact" });
    const r = getPack.execute({ project: "empty-ish" });
    expect(r.ok && r.value.markdown).toContain("# Context pack: empty-ish");
  });

  it("orders sections: pinned, handoff, then types; newest first inside sections", () => {
    const p = "pack-order";
    save.execute({ project: p, content: "old decision alpha", type: "decision" });
    clock.advanceMinutes(1);
    save.execute({ project: p, content: "new decision beta", type: "decision" });
    clock.advanceMinutes(1);
    save.execute({ project: p, content: "the compass", type: "preference", pinned: true });
    clock.advanceMinutes(1);
    save.execute({ project: p, content: "handoff: continue at restore flow", type: "handoff" });

    const r = getPack.execute({ project: p });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const md = r.value.markdown;
    const iPinned = md.indexOf("## Pinned");
    const iHandoff = md.indexOf("## Latest handoff");
    const iDecisions = md.indexOf("## Decisions");
    expect(iPinned).toBeGreaterThan(-1);
    expect(iHandoff).toBeGreaterThan(iPinned);
    expect(iDecisions).toBeGreaterThan(iHandoff);
    expect(md.indexOf("new decision beta")).toBeLessThan(md.indexOf("old decision alpha"));
    expect(r.value.includedCount).toBe(4);
    expect(r.value.totalCount).toBe(4);
  });

  it("respects the budget: stops adding unpinned items when full", () => {
    const p = "pack-budget";
    // Each item ~100 tokens rendered; budget fits only a few.
    for (let i = 0; i < 30; i++) {
      save.execute({
        project: p,
        content: `decision number ${i} ${"x".repeat(380)}`,
        type: "decision",
      });
      clock.advanceMinutes(1);
    }
    const r = getPack.execute({ project: p, budgetTokens: 500 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.includedCount).toBeLessThan(30);
    expect(r.value.includedCount).toBeGreaterThan(0);
    expect(r.value.estimatedTokens).toBeLessThanOrEqual(500 + 50);
    // Newest survive the cut.
    expect(r.value.markdown).toContain("decision number 29");
  });

  it("pinned overflow: keeps newest pinned even over budget, cuts oldest pinned", () => {
    const p = "pack-pinned";
    save.execute({
      project: p,
      content: `oldest pinned ${"y".repeat(800)}`,
      type: "fact",
      pinned: true,
    });
    clock.advanceMinutes(1);
    save.execute({
      project: p,
      content: `newest pinned ${"z".repeat(800)}`,
      type: "fact",
      pinned: true,
    });

    const r = getPack.execute({ project: p, budgetTokens: 100 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.markdown).toContain("newest pinned");
    expect(r.value.markdown).not.toContain("oldest pinned");
  });

  it("uses the default budget constant", () => {
    expect(DEFAULT_BUDGET_TOKENS).toBe(4000);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("ExportPack", () => {
  it("md export has no budget; json export round-trips", () => {
    const p = "pack-budget";
    const md = exportPack.execute(p, "md");
    expect(md.ok && md.value).toContain("decision number 0");
    const json = exportPack.execute(p, "json");
    expect(json.ok).toBe(true);
    if (!json.ok) return;
    const parsed = JSON.parse(json.value) as { project: string; items: unknown[] };
    expect(parsed.project).toBe(p);
    expect(parsed.items).toHaveLength(30);
  });
});
