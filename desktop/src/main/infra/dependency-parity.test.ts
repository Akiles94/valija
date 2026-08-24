import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const SHARED_DEPENDENCIES = [
  "better-sqlite3-multiple-ciphers",
  "argon2",
  "@napi-rs/keyring",
  "ulid",
  "zod",
  "fflate",
];

describe("Dependency parity", () => {
  it("shares the exact same versions in root and desktop package.json", () => {
    const rootPkgPath = resolve(import.meta.dir, "../../../package.json");
    const desktopPkgPath = resolve(import.meta.dir, "../../package.json");

    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
    const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, "utf-8"));

    for (const dep of SHARED_DEPENDENCIES) {
      const rootVersion = rootPkg.dependencies[dep];
      const desktopVersion = desktopPkg.dependencies[dep];

      expect(
        desktopVersion,
        `${dep} version in desktop must match root package.json`
      ).toBe(rootVersion);
    }
  });
});
