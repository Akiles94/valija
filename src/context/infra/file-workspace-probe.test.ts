import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FileWorkspaceProbe } from "./file-workspace-probe.js";

/** Every `.git` artefact below is written as plain files, so no `git` binary is needed. */
const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "valija-probe-")));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const probe = new FileWorkspaceProbe(join(tmp, "no-such-home"), "linux");

let seq = 0;
function freshDir(name: string): string {
  const dir = join(tmp, `${seq++}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

const remoteConfig = (url: string, name = "origin") =>
  `[core]\n\tbare = false\n[remote "${name}"]\n\turl = ${url}\n`;

function plainRepo(name: string, url: string | null): string {
  const root = freshDir(name);
  write(
    join(root, ".git", "config"),
    url === null ? "[core]\n\tbare = false\n" : remoteConfig(url),
  );
  write(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  return root;
}

function locate(directory: string) {
  const result = probe.locate(directory);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("FileWorkspaceProbe", () => {
  it("a plain directory has no repository", () => {
    const dir = freshDir("plain");
    expect(locate(dir)).toEqual({
      folder: dir,
      repositoryRoot: null,
      repository: null,
      tooBroadToLink: false,
    });
  });

  it("finds the same repository and normalized remote from its root and a nested sub-folder", () => {
    const root = plainRepo("repo", "git@github.com:oscar/valija.git");
    const nested = join(root, "src", "deep", "er");
    mkdirSync(nested, { recursive: true });

    const fromRoot = locate(root);
    const fromNested = locate(nested);

    expect(fromRoot.repositoryRoot).toBe(root);
    expect(fromRoot.repository).toBe("github.com/oscar/valija");
    expect(fromNested.folder).toBe(nested);
    expect(fromNested.repositoryRoot).toBe(root);
    expect(fromNested.repository).toBe("github.com/oscar/valija");
  });

  it("drops credentials: a token in the remote never appears in the location", () => {
    const root = plainRepo("token", "https://oscar:ghp_SECRETTOKEN123@github.com/oscar/valija.git");
    const location = locate(root);
    expect(location.repository).toBe("github.com/oscar/valija");
    expect(JSON.stringify(location)).not.toContain("SECRETTOKEN");
    expect(JSON.stringify(location)).not.toContain("oscar:");
  });

  it("a worktree reads the main repository's remote through commondir", () => {
    const main = plainRepo("main", "git@github.com:oscar/valija.git");
    const worktreeGitDir = join(main, ".git", "worktrees", "wt");
    write(join(worktreeGitDir, "commondir"), "../..\n");
    write(join(worktreeGitDir, "HEAD"), "ref: refs/heads/feature\n");
    const worktree = freshDir("wt");
    write(join(worktree, ".git"), `gitdir: ${worktreeGitDir}\n`);

    const location = locate(worktree);

    expect(location.repositoryRoot).toBe(worktree);
    expect(location.repository).toBe("github.com/oscar/valija");
  });

  it("a submodule reads its own remote through a relative gitdir", () => {
    const parent = plainRepo("parent", "git@github.com:oscar/parent.git");
    write(
      join(parent, ".git", "modules", "sub", "config"),
      remoteConfig("git@github.com:oscar/sub.git"),
    );
    const sub = join(parent, "sub");
    write(join(sub, ".git"), "gitdir: ../.git/modules/sub\n");

    const location = locate(sub);

    expect(location.repositoryRoot).toBe(sub);
    expect(location.repository).toBe("github.com/oscar/sub");
  });

  it("a repository without a remote has a root but no repository target", () => {
    const root = plainRepo("no-remote", null);
    const location = locate(root);
    expect(location.repositoryRoot).toBe(root);
    expect(location.repository).toBeNull();
  });

  it("a repository whose only usable remote is local has no repository target (P-5)", () => {
    const root = plainRepo("local-remote", "/srv/git/valija.git");
    expect(locate(root).repository).toBeNull();
  });

  it("chooses origin over another remote, and nothing among two non-origin remotes", () => {
    const withOrigin = freshDir("two-with-origin");
    write(
      join(withOrigin, ".git", "config"),
      remoteConfig("git@github.com:up/valija.git", "upstream") +
        remoteConfig("git@github.com:oscar/valija.git"),
    );
    const withoutOrigin = freshDir("two-without-origin");
    write(
      join(withoutOrigin, ".git", "config"),
      remoteConfig("git@github.com:up/valija.git", "upstream") +
        remoteConfig("git@github.com:fork/valija.git", "fork"),
    );

    expect(locate(withOrigin).repository).toBe("github.com/oscar/valija");
    expect(locate(withoutOrigin).repository).toBeNull();
  });

  it("a malformed .git file marks the repository boundary without a remote", () => {
    const dir = freshDir("malformed");
    write(join(dir, ".git"), "this is not a gitdir pointer\n");
    const location = locate(dir);
    expect(location.repositoryRoot).toBe(dir);
    expect(location.repository).toBeNull();
  });

  it.skipIf(process.platform === "win32")("resolves a symlinked directory to its real path", () => {
    const root = plainRepo("real", "git@github.com:oscar/valija.git");
    const link = join(tmp, `${seq++}-link`);
    symlinkSync(root, link);

    const location = locate(link);

    expect(location.folder).toBe(root);
    expect(location.repositoryRoot).toBe(root);
  });

  it("refuses a missing path and a regular file, without naming the path", () => {
    const missing = join(tmp, "does-not-exist");
    const file = join(freshDir("file-parent"), "notes.txt");
    writeFileSync(file, "hello");

    for (const path of [missing, file]) {
      const result = probe.locate(path);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("INVALID_WORKSPACE_PATH");
      expect(result.error.message).not.toContain(tmp);
    }
  });

  it("marks the home folder (and only it) as too broad to link", () => {
    const home = freshDir("home");
    const child = join(home, "work");
    mkdirSync(child);
    const homeProbe = new FileWorkspaceProbe(home, "linux");

    const atHome = homeProbe.locate(home);
    const atChild = homeProbe.locate(child);

    expect(atHome.ok && atHome.value.tooBroadToLink).toBe(true);
    expect(atChild.ok && atChild.value.tooBroadToLink).toBe(false);
  });

  it.skipIf(process.platform === "win32")("marks the filesystem root as too broad to link", () => {
    const result = probe.locate("/");
    expect(result.ok && result.value.tooBroadToLink).toBe(true);
  });

  it("treats an oversized config as having no remote, without throwing", () => {
    const root = freshDir("huge");
    const padding = `# ${"x".repeat(1024)}\n`.repeat(300);
    write(join(root, ".git", "config"), padding + remoteConfig("git@github.com:oscar/valija.git"));

    const location = locate(root);

    expect(location.repositoryRoot).toBe(root);
    expect(location.repository).toBeNull();
  });
});
