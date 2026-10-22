import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FakeWorkspaceProbe } from "../../../testing/fake-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { LinkWorkspace } from "./link-workspace.use-case.js";
import { ListProjectBindings } from "./list-project-bindings.use-case.js";
import { SaveContext } from "./save-context.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const probe = new FakeWorkspaceProbe();
const link = new LinkWorkspace(vault.sessions, probe, clock, ids);
const list = new ListProjectBindings(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);
const rows = (project?: string) => {
  const r = list.execute(project === undefined ? {} : { project });
  return r.ok ? r.value.map((v) => `${v.project} ${v.kind} ${v.target}`) : [];
};

for (const project of ["zeta", "alpha", "empty"]) {
  new SaveContext(vault.sessions, clock, ids).execute({ project, content: "seed" });
}
link.execute({ project: "zeta", directory: "/w/z" });
link.execute({ project: "alpha", directory: "/w/b" });
link.execute({ project: "alpha", directory: "/w/a" });

describe("ListProjectBindings", () => {
  it("an empty vault lists nothing", () => {
    const fresh = makeUnlockedVault();
    const r = new ListProjectBindings(fresh.sessions).execute({});
    expect(r.ok && r.value).toEqual([]);
    rmSync(fresh.paths.root, { recursive: true, force: true });
  });

  it("lists every binding, ordered by project, kind, target", () => {
    expect(rows()).toEqual(["alpha folder /w/a", "alpha folder /w/b", "zeta folder /w/z"]);
  });

  it("lists one project's bindings, its name normalized", () => {
    expect(rows(" ZETA ")).toEqual(["zeta folder /w/z"]);
    expect(rows("empty")).toEqual([]);
  });

  it("an unknown project → PROJECT_NOT_FOUND; a bad name → INVALID_PROJECT_NAME", () => {
    expect(codeOf(list.execute({ project: "ghost" }))).toBe("PROJECT_NOT_FOUND");
    expect(codeOf(list.execute({ project: "Bad Name!" }))).toBe("INVALID_PROJECT_NAME");
  });

  it("reads only: zero bumps", () => {
    const before = generation();
    list.execute({});
    list.execute({ project: "alpha" });
    expect(generation()).toBe(before);
  });

  it("a locked vault → VAULT_LOCKED", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = list.execute({});
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    expect(codeOf(r)).toBe("VAULT_LOCKED");
  });
});
