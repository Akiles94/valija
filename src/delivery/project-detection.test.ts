import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { LinkWorkspace } from "../context/application/use-cases/link-workspace.use-case.js";
import { ResolveProject } from "../context/application/use-cases/resolve-project.use-case.js";
import { SaveContext } from "../context/application/use-cases/save-context.use-case.js";
import type { FolderTarget } from "../context/domain/values/binding-target.js";
import type { RepositoryTarget } from "../context/domain/values/repository-target.js";
import { FakeWorkspaceProbe } from "../testing/fake-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../testing/test-vault.js";
import type { Container } from "./container.js";
import { chooseProject, detectionLabel, displayTarget } from "./project-detection.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const probe = new FakeWorkspaceProbe();
const containerWith = (envProject?: string) =>
  ({
    resolveProject: new ResolveProject(vault.sessions, probe),
    ...(envProject === undefined ? {} : { envProject }),
  }) as unknown as Container;
const c = containerWith();
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const REMEDY = "Do the remedy.";
const SECRET_FOLDER = "/home/oscar/private-client-folder";
const SECRET_REMOTE = "github.com/oscar/valija";
const link = new LinkWorkspace(vault.sessions, probe, clock, ids);
for (const project of ["valija", "billing"]) {
  new SaveContext(vault.sessions, clock, ids).execute({ project, content: "seed" });
}
probe.at(`${SECRET_FOLDER}/repo`, {
  repositoryRoot: `${SECRET_FOLDER}/repo` as FolderTarget,
  repository: SECRET_REMOTE as RepositoryTarget,
});
probe.at(`${SECRET_FOLDER}/unlinked-clone`, {
  repositoryRoot: `${SECRET_FOLDER}/unlinked-clone` as FolderTarget,
  repository: "gitlab.com/someone/valija" as RepositoryTarget,
});
link.execute({ project: "valija", directory: `${SECRET_FOLDER}/repo` });
link.execute({ project: "billing", directory: `${SECRET_FOLDER}/billing` });

describe("chooseProject", () => {
  it("returns an explicit project verbatim, without asking the probe or opening a session", () => {
    const asked = probe.asked.length;
    vault.keychain.deleteKey(vault.vaultId);
    const r = chooseProject(containerWith("valija"), "Other", [`${SECRET_FOLDER}/repo`], REMEDY);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    expect(r.ok && r.value).toEqual({ project: "Other" });
    expect(probe.asked.length).toBe(asked);
  });

  it("detects through a binding, with its kind", () => {
    const r = chooseProject(c, undefined, [`${SECRET_FOLDER}/repo`], REMEDY);
    expect(r.ok && r.value).toEqual({ project: "valija", detectedBy: "repository" });
    const folder = chooseProject(c, undefined, [`${SECRET_FOLDER}/billing`], REMEDY);
    expect(folder.ok && folder.value).toEqual({ project: "billing", detectedBy: "folder" });
  });

  it("VALIJA_PROJECT beats the binding", () => {
    const r = chooseProject(
      containerWith("from-env"),
      undefined,
      [`${SECRET_FOLDER}/repo`],
      REMEDY,
    );
    expect(r.ok && r.value).toEqual({ project: "from-env", detectedBy: "env" });
  });

  it("nothing detected → PROJECT_NOT_DETECTED with the hint and the remedy, and no path or remote", () => {
    const r = chooseProject(c, undefined, [`${SECRET_FOLDER}/unlinked-clone`], REMEDY);
    expect(!r.ok && r.error.code).toBe("PROJECT_NOT_DETECTED");
    expect(!r.ok && r.error.message).toBe(
      'No project was given and none is linked to this workspace. A project named "valija" matches this repository\'s name; link it with: valija link valija. Do the remedy.',
    );
    const plain = chooseProject(c, undefined, ["/elsewhere"], REMEDY);
    expect(!plain.ok && plain.error.message).toBe(
      "No project was given and none is linked to this workspace. Do the remedy.",
    );
    for (const message of [!r.ok && r.error.message, !plain.ok && plain.error.message]) {
      expect(message).not.toContain("private-client-folder");
      expect(message).not.toContain("gitlab.com");
      expect(message).not.toContain("/elsewhere");
    }
  });

  it("two folders linked to two projects → PROJECT_AMBIGUOUS listing both slugs only", () => {
    const r = chooseProject(
      c,
      undefined,
      [`${SECRET_FOLDER}/repo`, `${SECRET_FOLDER}/billing`],
      REMEDY,
    );
    expect(!r.ok && r.error.code).toBe("PROJECT_AMBIGUOUS");
    expect(!r.ok && r.error.message).toBe(
      "This workspace's folders are linked to different projects: billing, valija. Do the remedy.",
    );
    expect(!r.ok && r.error.message).not.toContain(SECRET_REMOTE);
    expect(!r.ok && r.error.message).not.toContain(SECRET_FOLDER);
  });

  it("a locked vault → VAULT_LOCKED when detection is needed", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = chooseProject(c, undefined, [`${SECRET_FOLDER}/repo`], REMEDY);
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
  });
});

describe("detectionLabel", () => {
  it("names every kind in user words", () => {
    expect(detectionLabel("folder")).toBe("linked folder");
    expect(detectionLabel("repository")).toBe("linked repository");
    expect(detectionLabel("env")).toBe("VALIJA_PROJECT");
  });
});

describe("displayTarget", () => {
  it("replaces the home prefix with ~ for a folder", () => {
    const home = "/home/oscar";
    expect(displayTarget({ kind: "folder", target: "/home/oscar/code/x" }, home)).toBe("~/code/x");
    expect(displayTarget({ kind: "folder", target: "/home/oscar" }, home)).toBe("~");
    expect(displayTarget({ kind: "folder", target: "/home/oscarina/x" }, home)).toBe(
      "/home/oscarina/x",
    );
    expect(displayTarget({ kind: "folder", target: "/srv/x" }, home)).toBe("/srv/x");
    expect(displayTarget({ kind: "folder", target: "C:\\Users\\o\\x" }, "C:\\Users\\o")).toBe(
      "~\\x",
    );
  });

  it("leaves a repository untouched", () => {
    expect(
      displayTarget({ kind: "repository", target: "github.com/home/oscar" }, "github.com"),
    ).toBe("github.com/home/oscar");
  });
});
