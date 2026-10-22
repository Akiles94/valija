import { describe, expect, it } from "vitest";
import { createProjectBinding } from "../entities/project-binding.js";
import type { BindingKind, FolderTarget, WorkspaceLocation } from "../values/binding-target.js";
import type { ProjectName } from "../values/project-name.js";
import type { RepositoryTarget } from "../values/repository-target.js";
import {
  type BoundProject,
  bindingFor,
  bindingOnTarget,
  chooseLinkTarget,
  hintCandidates,
  resolveFromBindings,
} from "./project-resolution.js";

const now = new Date("2026-10-19T00:00:00Z");
const REPO = "github.com/oscar/valija" as RepositoryTarget;

function bound(id: string, project: string, kind: BindingKind, target: string): BoundProject {
  return {
    binding: createProjectBinding({
      id,
      projectId: `p-${project}`,
      kind,
      target: target as FolderTarget,
      now,
    }),
    projectName: project as ProjectName,
  };
}

function at(folder: string, repo: Partial<WorkspaceLocation> = {}): WorkspaceLocation {
  return {
    folder: folder as FolderTarget,
    repositoryRoot: null,
    repository: null,
    tooBroadToLink: false,
    ...repo,
  };
}

const inRepo = (folder: string) =>
  at(folder, { repositoryRoot: "/r" as FolderTarget, repository: REPO });

const repoBinding = bound("b-repo", "valija", "repository", REPO);
const subFolder = bound("b-sub", "docs-site", "folder", "/r/sub");
const shallow = bound("b-shallow", "work", "folder", "/home/o");
const deep = bound("b-deep", "client", "folder", "/home/o/code/client");

describe("precedence", () => {
  const bindings = [repoBinding, subFolder];

  it("a folder binding on a sub-folder beats the repository binding", () => {
    expect(bindingFor(inRepo("/r/sub/x"), bindings, "linux")).toBe(subFolder);
  });

  it("elsewhere in the repository, the repository binding wins", () => {
    expect(bindingFor(inRepo("/r/other"), bindings, "linux")).toBe(repoBinding);
  });

  it("the deepest folder binding wins over a shallower one", () => {
    expect(bindingFor(at("/home/o/code/client/src"), [shallow, deep], "linux")).toBe(deep);
    expect(bindingFor(at("/home/o/code/client/src"), [deep, shallow], "linux")).toBe(deep);
  });

  it("a sibling with a shared prefix is not covered", () => {
    expect(bindingFor(at("/r/subway"), [subFolder], "linux")).toBeNull();
  });

  it("a repository binding needs an exact remote match", () => {
    const fork = at("/f", {
      repositoryRoot: "/f" as FolderTarget,
      repository: "github.com/x/valija" as RepositoryTarget,
    });
    expect(bindingFor(fork, [repoBinding], "linux")).toBeNull();
  });

  it("a location outside every repository and folder matches nothing", () => {
    expect(bindingFor(at("/tmp/x"), bindings, "linux")).toBeNull();
  });
});

describe("case", () => {
  const code = bound("b-code", "code", "folder", "/Users/o/Code");

  it("on darwin a binding covers a differently-cased folder", () => {
    expect(bindingFor(at("/users/o/code/x"), [code], "darwin")).toBe(code);
  });

  it("on linux it does not", () => {
    expect(bindingFor(at("/users/o/code/x"), [code], "linux")).toBeNull();
  });
});

describe("resolveFromBindings — ambiguity", () => {
  const other = bound("b-other", "alpha", "folder", "/elsewhere");

  it("two locations bound to two projects are ambiguous, slugs sorted", () => {
    const r = resolveFromBindings(
      [inRepo("/r/x"), at("/elsewhere/y")],
      [repoBinding, other],
      "linux",
    );
    expect(r).toEqual({ outcome: "ambiguous", projectNames: ["alpha", "valija"] });
  });

  it("two locations bound to the same project resolve to it", () => {
    const r = resolveFromBindings([inRepo("/r/a"), inRepo("/r/b")], [repoBinding], "linux");
    expect(r).toEqual({ outcome: "bound", match: repoBinding });
  });

  it("one bound location and one unmatched location resolve to the bound one", () => {
    const r = resolveFromBindings([at("/tmp/x"), inRepo("/r/a")], [repoBinding], "linux");
    expect(r).toEqual({ outcome: "bound", match: repoBinding });
  });

  it("nothing matching is none", () => {
    expect(resolveFromBindings([at("/tmp/x")], [repoBinding], "linux")).toEqual({
      outcome: "none",
    });
    expect(resolveFromBindings([], [repoBinding], "linux")).toEqual({ outcome: "none" });
  });
});

describe("bindingOnTarget", () => {
  const bindings = [repoBinding, subFolder];

  it("finds a repository binding by exact target", () => {
    expect(bindingOnTarget(bindings, "repository", REPO, "linux")).toBe(repoBinding);
    expect(bindingOnTarget(bindings, "repository", "github.com/oscar/Valija", "linux")).toBeNull();
  });

  it("finds a folder binding by exact folder, not by containment", () => {
    expect(bindingOnTarget(bindings, "folder", "/r/sub", "linux")).toBe(subFolder);
    expect(bindingOnTarget(bindings, "folder", "/r/sub/x", "linux")).toBeNull();
  });

  it("folds case for folders where matching does", () => {
    expect(bindingOnTarget(bindings, "folder", "/R/SUB", "darwin")).toBe(subFolder);
    expect(bindingOnTarget(bindings, "folder", "/R/SUB", "linux")).toBeNull();
  });

  it("never mixes kinds", () => {
    expect(bindingOnTarget(bindings, "folder", REPO, "linux")).toBeNull();
  });
});

describe("chooseLinkTarget", () => {
  const codeOf = (r: ReturnType<typeof chooseLinkTarget>) => (r.ok ? r.value : r.error.code);

  it("defaults to the repository when it has a usable remote", () => {
    expect(codeOf(chooseLinkTarget(inRepo("/r/x")))).toEqual({ kind: "repository", target: REPO });
  });

  it("defaults to the folder outside a repository", () => {
    expect(codeOf(chooseLinkTarget(at("/tmp/x")))).toEqual({ kind: "folder", target: "/tmp/x" });
  });

  it("defaults to the folder in a repository with no usable remote", () => {
    const noRemote = at("/r/x", { repositoryRoot: "/r" as FolderTarget });
    expect(codeOf(chooseLinkTarget(noRemote))).toEqual({ kind: "folder", target: "/r/x" });
  });

  it("links the folder when asked, even inside a repository", () => {
    expect(codeOf(chooseLinkTarget(inRepo("/r/x"), "folder"))).toEqual({
      kind: "folder",
      target: "/r/x",
    });
  });

  it("links the repository when asked", () => {
    expect(codeOf(chooseLinkTarget(inRepo("/r/x"), "repository"))).toEqual({
      kind: "repository",
      target: REPO,
    });
  });

  it("refuses --by repository without a usable remote", () => {
    expect(codeOf(chooseLinkTarget(at("/tmp/x"), "repository"))).toBe("NO_GIT_REMOTE");
    const noRemote = at("/r/x", { repositoryRoot: "/r" as FolderTarget });
    expect(codeOf(chooseLinkTarget(noRemote, "repository"))).toBe("NO_GIT_REMOTE");
  });

  it("refuses a folder link on a too-broad folder", () => {
    const home = at("/home/o", { tooBroadToLink: true });
    expect(codeOf(chooseLinkTarget(home))).toBe("INVALID_WORKSPACE_PATH");
    expect(codeOf(chooseLinkTarget(home, "folder"))).toBe("INVALID_WORKSPACE_PATH");
  });

  it("still links the repository of a too-broad folder", () => {
    const home = at("/home/o", {
      tooBroadToLink: true,
      repositoryRoot: "/home/o" as FolderTarget,
      repository: REPO,
    });
    expect(codeOf(chooseLinkTarget(home))).toEqual({ kind: "repository", target: REPO });
  });
});

describe("hintCandidates", () => {
  it("offers the repository name and the root folder's name, lower-cased and de-duplicated", () => {
    const location = at("/w/Valija/src", {
      repositoryRoot: "/w/Valija" as FolderTarget,
      repository: "github.com/oscar/Valija" as RepositoryTarget,
    });
    expect(hintCandidates(location)).toEqual(["valija"]);
  });

  it("keeps both when they differ", () => {
    const location = at("/w/checkout", {
      repositoryRoot: "/w/checkout" as FolderTarget,
      repository: REPO,
    });
    expect(hintCandidates(location)).toEqual(["valija", "checkout"]);
  });

  it("offers the root folder's name for a repository with no usable remote", () => {
    const location = at("C:\\w\\Valija", { repositoryRoot: "C:\\w\\Valija" as FolderTarget });
    expect(hintCandidates(location)).toEqual(["valija"]);
  });

  it("offers nothing outside a repository", () => {
    expect(hintCandidates(at("/w/valija"))).toEqual([]);
  });
});
