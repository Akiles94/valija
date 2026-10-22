import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FakeWorkspaceProbe } from "../../../testing/fake-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import type { FolderTarget } from "../../domain/values/binding-target.js";
import type { RepositoryTarget } from "../../domain/values/repository-target.js";
import { LinkWorkspace } from "./link-workspace.use-case.js";
import { ListProjects } from "./list-projects.use-case.js";
import { ResolveProject } from "./resolve-project.use-case.js";
import { SaveContext } from "./save-context.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const probe = new FakeWorkspaceProbe();
const save = new SaveContext(vault.sessions, clock, ids);
const link = new LinkWorkspace(vault.sessions, probe, clock, ids);
const resolve = new ResolveProject(vault.sessions, probe);
const listProjects = new ListProjects(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);
const projectCount = () => {
  const r = listProjects.execute();
  return r.ok ? r.value.length : -1;
};
const created = (project: string) => {
  const r = save.execute({ project, content: `seed for ${project}` });
  if (!r.ok) throw new Error(r.error.message);
};
const linked = (project: string, directory: string, by?: "folder" | "repository") => {
  const r = link.execute({ project, directory, ...(by === undefined ? {} : { by }) });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.binding;
};
const inRepo = (directory: string, root: string, repository: string) =>
  probe.at(directory, {
    repositoryRoot: root as FolderTarget,
    repository: repository as RepositoryTarget,
  });
const locked = <T>(run: () => T): T => {
  vault.keychain.deleteKey(vault.vaultId);
  try {
    return run();
  } finally {
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  }
};

created("valija");
created("billing");
created("other");
inRepo("/w/valija", "/w/valija", "github.com/oscar/valija");
inRepo("/w/valija/src/deep", "/w/valija", "github.com/oscar/valija");
inRepo("/w/acme", "/w/acme", "github.com/acme/mono");
inRepo("/w/acme/services/billing", "/w/acme", "github.com/acme/mono");
inRepo("/w/acme/services/billing/src", "/w/acme", "github.com/acme/mono");
const repoBinding = linked("valija", "/w/valija");
linked("other", "/w/acme");
const billingBinding = linked("billing", "/w/acme/services/billing", "folder");
probe.at("/w/elsewhere/valija");
inRepo("/w/fork", "/w/fork", "github.com/someone/valija");
inRepo("/w/unknown", "/w/unknown", "github.com/someone/nothing-here");

describe("ResolveProject", () => {
  it("detects a repository binding from a sub-folder, with its binding view", () => {
    const before = generation();
    const r = resolve.execute({ directories: ["/w/valija/src/deep"] });
    expect(r.ok && r.value).toEqual({
      outcome: "detected",
      project: "valija",
      detectedBy: "repository",
      binding: repoBinding,
      locations: [
        {
          folder: "/w/valija/src/deep",
          repositoryRoot: "/w/valija",
          repository: "github.com/oscar/valija",
          tooBroadToLink: false,
        },
      ],
    });
    expect(generation()).toBe(before);
  });

  it("a sub-folder's folder binding beats its repository's binding (D-E)", () => {
    const r = resolve.execute({ directories: ["/w/acme/services/billing/src"] });
    expect(r.ok && r.value.outcome === "detected" && r.value).toMatchObject({
      project: "billing",
      detectedBy: "folder",
      binding: billingBinding,
    });
    const atRoot = resolve.execute({ directories: ["/w/acme"] });
    expect(atRoot.ok && atRoot.value.outcome === "detected" && atRoot.value.project).toBe("other");
  });

  it("VALIJA_PROJECT beats every binding, even for a project that does not exist yet", () => {
    const before = projectCount();
    const r = resolve.execute({
      directories: ["/w/acme/services/billing"],
      envProject: " Brand-New ",
    });
    expect(r.ok && r.value).toMatchObject({
      outcome: "detected",
      project: "brand-new",
      detectedBy: "env",
    });
    expect(r.ok && "binding" in r.value).toBe(false);
    expect(projectCount()).toBe(before);
  });

  it("a blank VALIJA_PROJECT counts as unset", () => {
    const r = resolve.execute({ directories: ["/w/valija"], envProject: "  " });
    expect(r.ok && r.value.outcome === "detected" && r.value.detectedBy).toBe("repository");
  });

  it("rejects a bad VALIJA_PROJECT before any session or probe, without echoing it", () => {
    const asked = probe.asked.length;
    const r = locked(() =>
      resolve.execute({ directories: ["/w/valija"], envProject: "Bad Name!" }),
    );
    expect(codeOf(r)).toBe("INVALID_PROJECT_NAME");
    expect(!r.ok && r.error.message).toContain("VALIJA_PROJECT");
    expect(!r.ok && r.error.message).not.toContain("Bad Name!");
    expect(probe.asked.length).toBe(asked);
  });

  it("nothing bound → none, with a hint only when a project of that name exists", () => {
    const fork = resolve.execute({ directories: ["/w/fork"] });
    expect(fork.ok && fork.value).toEqual({
      outcome: "none",
      hint: "valija",
      locations: [
        {
          folder: "/w/fork",
          repositoryRoot: "/w/fork",
          repository: "github.com/someone/valija",
          tooBroadToLink: false,
        },
      ],
    });
    const unknown = resolve.execute({ directories: ["/w/unknown"] });
    expect(unknown.ok && unknown.value.outcome).toBe("none");
    expect(unknown.ok && "hint" in unknown.value).toBe(false);
  });

  it("the hint path never creates a project", () => {
    const before = projectCount();
    resolve.execute({ directories: ["/w/unknown", "/w/fork"] });
    expect(projectCount()).toBe(before);
  });

  it("a plain folder outside any repository gives no hint, even when its name is a project", () => {
    const r = resolve.execute({ directories: ["/w/elsewhere/valija"] });
    expect(r.ok && r.value).toMatchObject({ outcome: "none" });
    expect(r.ok && "hint" in r.value).toBe(false);
  });

  it("no directories and no env → none (nothing to go on)", () => {
    const r = resolve.execute({ directories: [] });
    expect(r.ok && r.value).toEqual({ outcome: "none", locations: [] });
  });

  it("two directories bound to two projects → ambiguous, slugs sorted", () => {
    const r = resolve.execute({ directories: ["/w/valija", "/w/acme/services/billing"] });
    expect(r.ok && r.value.outcome === "ambiguous" && r.value.projects).toEqual([
      "billing",
      "valija",
    ]);
  });

  it("two directories bound to the same project are not ambiguous", () => {
    const r = resolve.execute({ directories: ["/w/valija", "/w/valija/src/deep", "/w/unknown"] });
    expect(r.ok && r.value.outcome === "detected" && r.value.project).toBe("valija");
  });

  it("a directory the probe cannot read → INVALID_WORKSPACE_PATH", () => {
    probe.failFor("/w/missing");
    expect(codeOf(resolve.execute({ directories: ["/w/valija", "/w/missing"] }))).toBe(
      "INVALID_WORKSPACE_PATH",
    );
  });

  it("a locked vault → VAULT_LOCKED before any probe, with and without VALIJA_PROJECT", () => {
    const asked = probe.asked.length;
    expect(codeOf(locked(() => resolve.execute({ directories: ["/w/valija"] })))).toBe(
      "VAULT_LOCKED",
    );
    expect(
      codeOf(locked(() => resolve.execute({ directories: ["/w/valija"], envProject: "valija" }))),
    ).toBe("VAULT_LOCKED");
    expect(probe.asked.length).toBe(asked);
  });

  it("never bumps the lineage", () => {
    const before = generation();
    resolve.execute({ directories: ["/w/valija"] });
    resolve.execute({ directories: ["/w/fork"] });
    resolve.execute({ directories: ["/w/valija", "/w/acme/services/billing"] });
    resolve.execute({ directories: ["/w/valija"], envProject: "valija" });
    expect(generation()).toBe(before);
  });
});
