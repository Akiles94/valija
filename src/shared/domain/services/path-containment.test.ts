import { describe, expect, it } from "vitest";
import { isCaseInsensitivePlatform, isSameOrInside, pathModuleFor } from "./path-containment.js";

describe("isSameOrInside", () => {
  it("treats a folder as inside itself", () => {
    expect(isSameOrInside("/a/b", "/a/b", "linux")).toBe(true);
  });

  it("accepts a nested folder", () => {
    expect(isSameOrInside("/a/b", "/a/b/c/d", "linux")).toBe(true);
  });

  it("rejects a sibling that only shares a name prefix", () => {
    expect(isSameOrInside("/a/b", "/a/bc", "linux")).toBe(false);
  });

  it("rejects a parent", () => {
    expect(isSameOrInside("/a/b", "/a", "linux")).toBe(false);
  });

  it("folds case on darwin and win32, not on linux", () => {
    expect(isSameOrInside("/Users/O/Code", "/users/o/code/x", "darwin")).toBe(true);
    expect(isSameOrInside("/Users/O/Code", "/users/o/code/x", "linux")).toBe(false);
    expect(isSameOrInside("C:\\A", "c:\\a\\b", "win32")).toBe(true);
  });

  it("uses win32 separators only on win32", () => {
    expect(isSameOrInside("C:\\repos", "C:\\repos\\valija", "win32")).toBe(true);
    expect(isSameOrInside("C:\\repos", "D:\\repos\\valija", "win32")).toBe(false);
  });
});

describe("platform helpers", () => {
  it("names the case-insensitive platforms", () => {
    expect(isCaseInsensitivePlatform("darwin")).toBe(true);
    expect(isCaseInsensitivePlatform("win32")).toBe(true);
    expect(isCaseInsensitivePlatform("linux")).toBe(false);
  });

  it("picks the path module by platform, not by host", () => {
    expect(pathModuleFor("win32").sep).toBe("\\");
    expect(pathModuleFor("darwin").sep).toBe("/");
  });
});
