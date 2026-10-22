import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  isNonWorkspaceDirectory,
  type RootsSource,
  type WorkspaceEnvironment,
  workspaceDirectories,
} from "./workspace-directories.js";

const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "valija-workspace-dirs-")));
const project = join(tmp, "project");
const other = join(tmp, "other");
mkdirSync(project);
mkdirSync(other);
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const linux: WorkspaceEnvironment = {
  cwd: () => project,
  home: "/home/oscar",
  platform: "linux",
  execDir: "/opt/node/bin",
  variables: {},
};
const darwin: WorkspaceEnvironment = {
  ...linux,
  home: "/Users/oscar",
  platform: "darwin",
  execDir: "/usr/local/bin",
};
const win32: WorkspaceEnvironment = {
  ...linux,
  home: "C:\\Users\\oscar",
  platform: "win32",
  execDir: "C:\\Program Files\\nodejs",
  variables: {
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\oscar\\AppData\\Local",
  },
};

/** A stub of the two SDK calls; `calls` proves whether `roots/list` was ever sent. */
function stubServer(roots: "undeclared" | "rejects" | string[]): RootsSource & { calls: number } {
  const uris = Array.isArray(roots) ? roots : [];
  const stub = {
    calls: 0,
    getClientCapabilities: () => (roots === "undeclared" ? {} : { roots: {} }),
    listRoots: async () => {
      stub.calls += 1;
      if (roots === "rejects") throw new Error("Request timed out");
      return { roots: uris.map((uri) => ({ uri })) };
    },
  };
  return stub as unknown as RootsSource & { calls: number };
}

describe("isNonWorkspaceDirectory (P-3)", () => {
  it.each([
    ["linux", linux, "/"],
    ["linux", linux, "/home/oscar"],
    ["linux", linux, "/home"],
    ["linux", linux, "/opt/node/bin"],
    ["linux", linux, "/home/oscar/.npm/_npx/abc"],
    ["darwin", darwin, "/"],
    ["darwin", darwin, "/Users"],
    ["darwin", darwin, "/users/OSCAR"],
    ["darwin", darwin, "/Applications/Claude.app/Contents"],
    ["darwin", darwin, "/System/Library"],
    ["darwin", darwin, "/Library/Application Support"],
    ["win32", win32, "C:\\"],
    ["win32", win32, "C:\\Users"],
    ["win32", win32, "c:\\users\\oscar"],
    ["win32", win32, "C:\\Program Files\\nodejs"],
    ["win32", win32, "C:\\Program Files (x86)\\Tool"],
    ["win32", win32, "C:\\Users\\oscar\\AppData\\Local\\Programs\\cursor"],
  ])("%s: %s is not a workspace", (_platform, env, dir) => {
    expect(isNonWorkspaceDirectory(dir, env)).toBe(true);
  });

  it.each([
    ["linux", linux, "/home/oscar/code/valija"],
    ["linux", linux, "/srv/work"],
    ["darwin", darwin, "/Users/oscar/code/valija"],
    ["darwin", darwin, "/Users/oscar/Library-notes"],
    ["win32", win32, "C:\\Users\\oscar\\code\\valija"],
    ["win32", win32, "D:\\work"],
  ])("%s: %s may be a workspace", (_platform, env, dir) => {
    expect(isNonWorkspaceDirectory(dir, env)).toBe(false);
  });

  it("a real project folder is a workspace", () => {
    expect(isNonWorkspaceDirectory(project, { ...linux, platform: process.platform })).toBe(false);
  });
});

describe("workspaceDirectories (D-C)", () => {
  const env = { ...linux, platform: process.platform };

  it("uses the declared roots and ignores the cwd", async () => {
    const roots = [pathToFileURL(project).href, pathToFileURL(other).href];
    expect(await workspaceDirectories(stubServer(roots), { ...env, cwd: () => tmp })).toEqual([
      project,
      other,
    ]);
  });

  it("declared but empty roots → the cwd (P-2)", async () => {
    expect(await workspaceDirectories(stubServer([]), env)).toEqual([project]);
  });

  it("roots/list failing or timing out → the cwd (P-2)", async () => {
    expect(await workspaceDirectories(stubServer("rejects"), env)).toEqual([project]);
  });

  it("roots not declared → roots/list is never sent", async () => {
    const server = stubServer("undeclared");
    expect(await workspaceDirectories(server, env)).toEqual([project]);
    expect(server.calls).toBe(0);
  });

  it("drops a non-file root and a root that is not an existing directory", async () => {
    const roots = [
      "https://example.invalid/repo",
      pathToFileURL(join(tmp, "missing")).href,
      pathToFileURL(other).href,
    ];
    expect(await workspaceDirectories(stubServer(roots), env)).toEqual([other]);
  });

  it("only unusable roots → the cwd", async () => {
    const roots = ["https://example.invalid/repo"];
    expect(await workspaceDirectories(stubServer(roots), env)).toEqual([project]);
  });

  it("a cwd that is the home folder → no directories at all", async () => {
    const atHome = { ...env, home: project };
    expect(await workspaceDirectories(stubServer("undeclared"), atHome)).toEqual([]);
  });
});
