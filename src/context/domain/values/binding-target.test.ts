import { describe, expect, it } from "vitest";
import { type FolderTarget, folderDepth, parseFolderTarget } from "./binding-target.js";

const parsed = (r: ReturnType<typeof parseFolderTarget>) => (r.ok ? r.value : r.error.code);

describe("parseFolderTarget", () => {
  it("accepts absolute POSIX and Windows paths", () => {
    expect(parsed(parseFolderTarget("/home/o/code", "linux"))).toBe("/home/o/code");
    expect(parsed(parseFolderTarget("C:\\repos\\valija", "win32"))).toBe("C:\\repos\\valija");
  });

  it("trims surrounding whitespace", () => {
    expect(parsed(parseFolderTarget("  /home/o/code \n", "linux"))).toBe("/home/o/code");
  });

  it.each([
    ["", "linux"],
    ["   ", "linux"],
    ["code/valija", "linux"],
    ["./valija", "darwin"],
    ["C:\\repos", "linux"],
    ["repos\\valija", "win32"],
    ["C:", "win32"],
  ] as const)("rejects %j on %s with INVALID_WORKSPACE_PATH", (raw, platform) => {
    expect(parsed(parseFolderTarget(raw, platform))).toBe("INVALID_WORKSPACE_PATH");
  });

  it("strips trailing separators", () => {
    expect(parsed(parseFolderTarget("/home/o/code//", "linux"))).toBe("/home/o/code");
    expect(parsed(parseFolderTarget("C:\\repos\\valija\\", "win32"))).toBe("C:\\repos\\valija");
    expect(parsed(parseFolderTarget("C:\\repos/", "win32"))).toBe("C:\\repos");
  });

  it("keeps a filesystem root as it is", () => {
    expect(parsed(parseFolderTarget("/", "linux"))).toBe("/");
    expect(parsed(parseFolderTarget("C:\\", "win32"))).toBe("C:\\");
  });

  it("upper-cases a Windows drive letter, and only on win32", () => {
    expect(parsed(parseFolderTarget("c:\\repos", "win32"))).toBe("C:\\repos");
    expect(parsed(parseFolderTarget("/c:/x", "linux"))).toBe("/c:/x");
  });

  it("never echoes the rejected input", () => {
    const r = parseFolderTarget("relative/secret-client-folder", "linux");
    expect(!r.ok && r.error.message).not.toContain("secret-client-folder");
  });
});

describe("folderDepth", () => {
  it.each([
    ["/", 0],
    ["/a/b", 2],
    ["C:\\a\\b", 3],
  ])("%s has depth %i", (folder, depth) => {
    expect(folderDepth(folder as FolderTarget)).toBe(depth);
  });
});
