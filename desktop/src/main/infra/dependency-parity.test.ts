import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SHARED_DEPENDENCIES = [
  "better-sqlite3-multiple-ciphers",
  "argon2",
  "@napi-rs/keyring",
  "ulid",
  "zod",
  "fflate",
] as const;

function readPackageJson(path: string): { dependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("dependency parity between root and desktop package.json", () => {
  const root = readPackageJson(join(import.meta.dirname, "../../../../package.json"));
  const desktop = readPackageJson(join(import.meta.dirname, "../../../package.json"));

  it.each(SHARED_DEPENDENCIES)("%s is pinned to the identical version string", (name) => {
    const rootVersion = root.dependencies?.[name];
    const desktopVersion = desktop.dependencies?.[name];
    expect(rootVersion).toBeDefined();
    expect(desktopVersion).toBeDefined();
    expect(desktopVersion).toBe(rootVersion);
  });
});
