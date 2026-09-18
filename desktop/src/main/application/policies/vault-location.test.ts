import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../ports/app-preferences.js";
import { resolveVaultRoot } from "./vault-location.js";

describe("resolveVaultRoot", () => {
  it("VALIJA_HOME always wins over the remembered location", () => {
    const preferences = { ...DEFAULT_PREFERENCES, vaultPath: "/Users/oscar/Dropbox/valija" };
    expect(resolveVaultRoot({ VALIJA_HOME: "/tmp/scripted-vault" }, preferences)).toBe(
      "/tmp/scripted-vault",
    );
  });

  it("falls back to the remembered location when VALIJA_HOME is unset", () => {
    const preferences = { ...DEFAULT_PREFERENCES, vaultPath: "/Users/oscar/Dropbox/valija" };
    expect(resolveVaultRoot({}, preferences)).toBe("/Users/oscar/Dropbox/valija");
  });

  it("returns undefined when neither is set, so resolveVaultPaths falls through to ~/.valija", () => {
    expect(resolveVaultRoot({}, DEFAULT_PREFERENCES)).toBeUndefined();
  });
});
