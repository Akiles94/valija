import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FakeWorkspaceProbe } from "../../../testing/fake-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import type { FolderTarget } from "../../domain/values/binding-target.js";
import type { RepositoryTarget } from "../../domain/values/repository-target.js";
import { LinkWorkspace } from "./link-workspace.use-case.js";
import { ListProjectBindings } from "./list-project-bindings.use-case.js";
import { SaveContext } from "./save-context.use-case.js";
import { UnlinkWorkspace } from "./unlink-workspace.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const probe = new FakeWorkspaceProbe();
const link = new LinkWorkspace(vault.sessions, probe, clock, ids);
const unlink = new UnlinkWorkspace(vault.sessions, probe);
const list = new ListProjectBindings(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);
const targets = () => {
  const r = list.execute({});
  return r.ok ? r.value.map((v) => `${v.kind}:${v.target}`) : [];
};
const linked = (project: string, directory: string, by?: "folder" | "repository") => {
  const r = link.execute({ project, directory, ...(by === undefined ? {} : { by }) });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.binding;
};

for (const project of ["valija", "docs"]) {
  new SaveContext(vault.sessions, clock, ids).execute({ project, content: "seed" });
}
const repo = { repositoryRoot: "/w/valija" as FolderTarget };
const remote = "github.com/oscar/valija" as RepositoryTarget;
probe.at("/w/valija", { ...repo, repository: remote });
probe.at("/w/valija/docs", { ...repo, repository: remote });
probe.at("/w/valija/docs/guides", { ...repo, repository: remote });
probe.at("/w/plain");

describe("UnlinkWorkspace", () => {
  it("unlinks by id with one bump and reports what was removed", () => {
    const binding = linked("docs", "/w/plain");
    const before = generation();
    const r = unlink.execute({ bindingId: binding.id });
    expect(r.ok && r.value).toEqual(binding);
    expect(generation()).toBe(before + 1);
    expect(targets()).not.toContain("folder:/w/plain");
  });

  it("unlinks by directory through an ancestor's folder binding first (W3)", () => {
    linked("valija", "/w/valija");
    const folder = linked("docs", "/w/valija/docs", "folder");
    const before = generation();
    const r = unlink.execute({ directory: "/w/valija/docs/guides" });
    expect(r.ok && r.value).toEqual(folder);
    expect(generation()).toBe(before + 1);
    expect(targets()).toEqual(["repository:github.com/oscar/valija"]);
  });

  it("unlinks by directory through the repository binding", () => {
    const r = unlink.execute({ directory: "/w/valija/docs" });
    expect(r.ok && r.value).toMatchObject({
      kind: "repository",
      target: "github.com/oscar/valija",
    });
    expect(targets()).toEqual([]);
  });

  it("the by filter skips a closer binding of the other kind", () => {
    linked("valija", "/w/valija");
    linked("docs", "/w/valija/docs", "folder");
    const r = unlink.execute({ directory: "/w/valija/docs", by: "repository" });
    expect(r.ok && r.value.kind).toBe("repository");
    expect(targets()).toEqual(["folder:/w/valija/docs"]);
    const before = generation();
    const none = unlink.execute({ directory: "/w/valija", by: "folder" });
    expect(codeOf(none)).toBe("BINDING_NOT_FOUND");
    expect(!none.ok && none.error.message).toBe("Nothing linked here by folder.");
    expect(generation()).toBe(before);
  });

  it("an unknown or malformed id → BINDING_NOT_FOUND with zero bumps", () => {
    const before = generation();
    expect(codeOf(unlink.execute({ bindingId: "01NOSUCHBINDING" }))).toBe("BINDING_NOT_FOUND");
    expect(codeOf(unlink.execute({ bindingId: "not an id!" }))).toBe("BINDING_NOT_FOUND");
    expect(generation()).toBe(before);
  });

  it("nothing linked here → BINDING_NOT_FOUND with zero bumps", () => {
    const before = generation();
    const r = unlink.execute({ directory: "/w/plain" });
    expect(codeOf(r)).toBe("BINDING_NOT_FOUND");
    expect(!r.ok && r.error.message).toBe("Nothing linked here.");
    expect(generation()).toBe(before);
  });

  it("an unreadable directory → INVALID_WORKSPACE_PATH", () => {
    probe.failFor("/w/missing");
    expect(codeOf(unlink.execute({ directory: "/w/missing" }))).toBe("INVALID_WORKSPACE_PATH");
  });

  it("a locked vault → VAULT_LOCKED for both forms, and the probe was never called", () => {
    const asked = probe.asked.length;
    vault.keychain.deleteKey(vault.vaultId);
    const byDir = unlink.execute({ directory: "/w/valija/docs" });
    const byId = unlink.execute({ bindingId: "01SEQ000001" });
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    expect([codeOf(byDir), codeOf(byId)]).toEqual(["VAULT_LOCKED", "VAULT_LOCKED"]);
    expect(probe.asked.length).toBe(asked);
    expect(targets()).toEqual(["folder:/w/valija/docs"]);
  });
});
