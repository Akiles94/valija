import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveStatePaths } from "../../../shared/infra/state-paths.js";
import { FakeWorkspaceProbe } from "../../../testing/fake-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { SessionGuard } from "../../../vault/application/policies/session-guard.js";
import { parseAutoLockTtl } from "../../../vault/domain/values/auto-lock-ttl.js";
import { FileDeviceIdentity } from "../../../vault/infra/file-device-identity.js";
import type { FolderTarget } from "../../domain/values/binding-target.js";
import type { RepositoryTarget } from "../../domain/values/repository-target.js";
import { SqliteVaultSessions } from "../../infra/vault-sessions.js";
import { LinkWorkspace } from "./link-workspace.use-case.js";
import { ListProjectBindings } from "./list-project-bindings.use-case.js";
import { ListProjects } from "./list-projects.use-case.js";
import { SaveContext } from "./save-context.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const probe = new FakeWorkspaceProbe();
const save = new SaveContext(vault.sessions, clock, ids);
const link = new LinkWorkspace(vault.sessions, probe, clock, ids);
const list = new ListProjectBindings(vault.sessions);
const listProjects = new ListProjects(vault.sessions);
const stateRoot = mkdtempSync(join(tmpdir(), "valija-link-state-"));
afterAll(() => {
  rmSync(vault.paths.root, { recursive: true, force: true });
  rmSync(stateRoot, { recursive: true, force: true });
});

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);
const bindingCount = () => {
  const r = list.execute({});
  return r.ok ? r.value.length : -1;
};
const created = (project: string) => {
  const r = save.execute({ project, content: `seed for ${project}` });
  if (!r.ok) throw new Error(r.error.message);
};
const inRepo = (directory: string, root: string, repository: string) =>
  probe.at(directory, {
    repositoryRoot: root as FolderTarget,
    repository: repository as RepositoryTarget,
  });
/** A rejection writes nothing: neither a binding nor a lineage bump. */
const rejected = (run: () => { ok: boolean; error?: { code: string } }) => {
  const before = { generation: generation(), bindings: bindingCount() };
  const code = codeOf(run());
  expect({ generation: generation(), bindings: bindingCount() }).toEqual(before);
  return code;
};

created("valija");
created("acme");
inRepo("/w/valija", "/w/valija", "github.com/oscar/valija");
inRepo("/w/valija/docs", "/w/valija", "github.com/oscar/valija");
probe.at("/w/plain");
probe.at("/home/oscar", { tooBroadToLink: true });
probe.at("/w/repo-without-remote", { repositoryRoot: "/w/repo-without-remote" as FolderTarget });

describe("LinkWorkspace", () => {
  it("links the repository by default when there is a usable remote, with one bump", () => {
    const before = generation();
    clock.advanceMinutes(1);
    const r = link.execute({ project: "Valija", directory: "/w/valija" });
    expect(r.ok && r.value).toEqual({
      binding: {
        id: expect.any(String),
        project: "valija",
        kind: "repository",
        target: "github.com/oscar/valija",
        createdAt: clock.now().toISOString(),
      },
      changed: true,
    });
    expect(generation()).toBe(before + 1);
  });

  it("re-linking the same target to the same project is a no-op with zero bumps", () => {
    const first = list.execute({ project: "valija" });
    const before = generation();
    const r = link.execute({ project: "valija", directory: "/w/valija/docs" });
    expect(r.ok && r.value.changed).toBe(false);
    expect(r.ok && r.value.binding).toEqual(first.ok && first.value[0]);
    expect(generation()).toBe(before);
  });

  it("links only the folder with by: folder, even inside a repository", () => {
    const r = link.execute({ project: "acme", directory: "/w/valija/docs", by: "folder" });
    expect(r.ok && r.value.binding).toMatchObject({
      project: "acme",
      kind: "folder",
      target: "/w/valija/docs",
    });
  });

  it("links the folder by default outside a repository, or in one with no remote", () => {
    const plain = link.execute({ project: "acme", directory: "/w/plain" });
    expect(plain.ok && plain.value.binding.kind).toBe("folder");
    const noRemote = link.execute({ project: "acme", directory: "/w/repo-without-remote" });
    expect(noRemote.ok && noRemote.value.binding).toMatchObject({
      kind: "folder",
      target: "/w/repo-without-remote",
    });
  });

  it("refuses a project that does not exist, and never creates it", () => {
    const before = listProjects.execute();
    expect(rejected(() => link.execute({ project: "ghost", directory: "/w/valija" }))).toBe(
      "PROJECT_NOT_FOUND",
    );
    expect(listProjects.execute()).toEqual(before);
  });

  it("refuses a bad project name before opening a session", () => {
    const asked = probe.asked.length;
    expect(rejected(() => link.execute({ project: "Bad Name!", directory: "/w/valija" }))).toBe(
      "INVALID_PROJECT_NAME",
    );
    expect(probe.asked.length).toBe(asked);
  });

  it("by: repository without a usable remote → NO_GIT_REMOTE", () => {
    for (const directory of ["/w/plain", "/w/repo-without-remote"]) {
      expect(rejected(() => link.execute({ project: "acme", directory, by: "repository" }))).toBe(
        "NO_GIT_REMOTE",
      );
    }
  });

  it("an unreadable folder, or one too broad to link → INVALID_WORKSPACE_PATH", () => {
    probe.failFor("/w/missing");
    expect(rejected(() => link.execute({ project: "acme", directory: "/w/missing" }))).toBe(
      "INVALID_WORKSPACE_PATH",
    );
    expect(rejected(() => link.execute({ project: "acme", directory: "/home/oscar" }))).toBe(
      "INVALID_WORKSPACE_PATH",
    );
  });

  it("a target linked to another project → BINDING_CONFLICT naming that project's slug only", () => {
    const owner = list.execute({ project: "valija" });
    const id = owner.ok ? owner.value[0]?.id : undefined;
    let message = "";
    const code = rejected(() => {
      const r = link.execute({ project: "acme", directory: "/w/valija" });
      if (!r.ok) message = r.error.message;
      return r;
    });
    expect(code).toBe("BINDING_CONFLICT");
    expect(message).toBe(
      `That repository is already linked to project "valija". Unlink it first (valija unlink ${id}).`,
    );
    expect(message).not.toContain("github.com");
    expect(message).not.toContain("/w/");
  });

  it("checks the project before the path: a missing project wins over a missing folder", () => {
    probe.failFor("/w/gone");
    expect(rejected(() => link.execute({ project: "ghost", directory: "/w/gone" }))).toBe(
      "PROJECT_NOT_FOUND",
    );
  });

  it("a locked vault → VAULT_LOCKED, and the probe was never called", () => {
    const asked = probe.asked.length;
    vault.keychain.deleteKey(vault.vaultId);
    const code = rejected(() => link.execute({ project: "acme", directory: "/w/plain" }));
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    expect(code).toBe("VAULT_LOCKED");
    expect(probe.asked.length).toBe(asked);
  });

  it("writes neither the folder nor the project slug to the device state file", () => {
    const statePaths = resolveStatePaths(stateRoot);
    const identity = new FileDeviceIdentity(statePaths, ids);
    const guard = new SessionGuard(identity, vault.keychain, clock, parseAutoLockTtl(undefined));
    const sessions = new SqliteVaultSessions(
      vault.paths,
      vault.keychain,
      identity,
      guard,
      ids,
      clock,
    );
    new SaveContext(sessions, clock, ids).execute({ project: "secret-proj", content: "seed" });
    probe.at("/w/very-private-folder");
    const r = new LinkWorkspace(sessions, probe, clock, ids).execute({
      project: "secret-proj",
      directory: "/w/very-private-folder",
    });
    expect(r.ok && r.value.changed).toBe(true);
    const state = readFileSync(statePaths.state, "utf8");
    expect(state).not.toContain("very-private-folder");
    expect(state).not.toContain("secret-proj");
  });
});
