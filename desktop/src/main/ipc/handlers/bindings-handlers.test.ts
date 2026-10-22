import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LinkWorkspace } from "../../../../../src/context/application/use-cases/link-workspace.use-case.js";
import { ListProjectBindings } from "../../../../../src/context/application/use-cases/list-project-bindings.use-case.js";
import { ResolveProject } from "../../../../../src/context/application/use-cases/resolve-project.use-case.js";
import { SaveContext } from "../../../../../src/context/application/use-cases/save-context.use-case.js";
import { UnlinkWorkspace } from "../../../../../src/context/application/use-cases/unlink-workspace.use-case.js";
import { FileWorkspaceProbe } from "../../../../../src/context/infra/file-workspace-probe.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { makeUnlockedVault, SeqIds } from "../../../../../src/testing/test-vault.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { createBindingsHandlers } from "./bindings-handlers.js";

/**
 * The four bindings channels run the CLI's own use cases against a real vault
 * and a real probe over plain temp folders (no `git` binary): errors carry a
 * code only, credentials never come back, and a folder is redeemable only
 * through a `pf-` handle.
 */
const vault = makeUnlockedVault();
const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "valija-bindings-ipc-")));
afterAll(() => {
  rmSync(vault.paths.root, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
});

const repo = join(tmp, "valija");
mkdirSync(join(repo, ".git"), { recursive: true });
writeFileSync(join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");
writeFileSync(
  join(repo, ".git", "config"),
  '[remote "origin"]\n\turl = https://user:TOKEN@github.com/oscar/valija.git\n',
);
const plain = join(tmp, "notes");
mkdirSync(plain);

const probe = new FileWorkspaceProbe(join(tmp, "no-such-home"), "linux");
const ids = new SeqIds();
const container = {
  saveContext: new SaveContext(vault.sessions, vault.clock, ids),
  resolveProject: new ResolveProject(vault.sessions, probe),
  linkWorkspace: new LinkWorkspace(vault.sessions, probe, vault.clock, ids),
  unlinkWorkspace: new UnlinkWorkspace(vault.sessions, probe),
  listProjectBindings: new ListProjectBindings(vault.sessions),
  // biome-ignore lint/suspicious/noExplicitAny: only the fields above are exercised
} as any as Container;
const folders: Record<string, string> = { "pf-1": repo, "pf-2": plain };
const filePicker: FilePicker = {
  chooseImportFile: () => null,
  chooseExportTarget: () => null,
  chooseVaultFolder: () => null,
  resolveHandle: (handle) => (handle === "fh-1" ? repo : undefined),
  chooseProjectFolder: () => null,
  resolveProjectFolder: (handle) => folders[handle],
};
const handlers = createBindingsHandlers(() => container, filePicker);

const seeded = container.saveContext.execute({ project: "valija", content: "seed" });
if (!seeded.ok) throw new Error(seeded.error.message);

describe("bindings:* handlers", () => {
  it("inspects a repository: its normalized remote, and nothing linked yet", () => {
    expect(handlers["bindings:inspect"]({ handle: "pf-1" })).toEqual({
      ok: true,
      value: {
        displayName: "valija",
        resolvesTo: null,
        isRepository: true,
        remote: "github.com/oscar/valija",
        canLinkFolder: true,
        hint: "valija",
      },
    });
  });

  it("links by repository once; the inspection and the list then show it; a repeat changes nothing", () => {
    const link = { handle: "pf-1", projectName: "valija", by: "repository" } as const;
    expect(handlers["bindings:link"](link)).toEqual({ ok: true, value: { changed: true } });
    const inspected = handlers["bindings:inspect"]({ handle: "pf-1" });
    expect(inspected.ok && inspected.value.resolvesTo).toEqual({
      project: "valija",
      kind: "repository",
    });
    const listed = handlers["bindings:list"]({ projectName: "valija" });
    expect(listed.ok && listed.value.map((b) => [b.kind, b.target])).toEqual([
      ["repository", "github.com/oscar/valija"],
    ]);
    expect(handlers["bindings:link"](link)).toEqual({ ok: true, value: { changed: false } });
  });

  it("a folder without a remote cannot be linked by repository — code only, no message", () => {
    const result = handlers["bindings:link"]({
      handle: "pf-2",
      projectName: "valija",
      by: "repository",
    });
    expect(result).toEqual({ ok: false, error: { code: "NO_GIT_REMOTE" } });
  });

  it.each(["pf-99", "fh-1"])("%s is not a project-folder handle", (handle) => {
    const invalid = { ok: false, error: { code: "INVALID_WORKSPACE_PATH" } };
    expect(handlers["bindings:inspect"]({ handle })).toEqual(invalid);
    expect(handlers["bindings:link"]({ handle, projectName: "valija", by: "folder" })).toEqual(
      invalid,
    );
  });

  it("unlinks by id and returns the removed binding; a second unlink is BINDING_NOT_FOUND", () => {
    const listed = handlers["bindings:list"]({});
    const bindingId = listed.ok ? (listed.value[0]?.id ?? "") : "";
    const removed = handlers["bindings:unlink"]({ bindingId });
    expect(removed.ok && removed.value).toMatchObject({
      id: bindingId,
      project: "valija",
      kind: "repository",
      target: "github.com/oscar/valija",
    });
    expect(handlers["bindings:unlink"]({ bindingId })).toEqual({
      ok: false,
      error: { code: "BINDING_NOT_FOUND" },
    });
  });

  it("links a plain folder by folder, listed with its target", () => {
    expect(
      handlers["bindings:link"]({ handle: "pf-2", projectName: "valija", by: "folder" }),
    ).toEqual({ ok: true, value: { changed: true } });
    const listed = handlers["bindings:list"]({});
    expect(listed.ok && listed.value.map((b) => [b.kind, b.target])).toEqual([["folder", plain]]);
  });

  it("an unknown project is PROJECT_NOT_FOUND, and never created", () => {
    expect(handlers["bindings:list"]({ projectName: "ghost" })).toEqual({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  it("no response ever carries the remote's credentials", () => {
    const responses = [
      handlers["bindings:inspect"]({ handle: "pf-1" }),
      handlers["bindings:link"]({ handle: "pf-1", projectName: "valija", by: "repository" }),
      handlers["bindings:list"]({}),
    ];
    expect(JSON.stringify(responses)).not.toContain("TOKEN");
    expect(JSON.stringify(responses)).not.toContain("user:");
  });
});

describe("bindings-handlers.ts goes only through the use cases", () => {
  it("imports no repository, no session implementation and no node:fs", () => {
    const source = readFileSync(join(import.meta.dirname, "bindings-handlers.ts"), "utf8");
    for (const needle of ["infra/", "SqliteVaultSessions", "node:fs", "app-preferences"]) {
      expect(source).not.toContain(needle);
    }
  });
});
