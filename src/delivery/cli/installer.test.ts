import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CLIENTS, clientConfigPath, installIntoClient, manualInstructions } from "./installer.js";

// clientConfigPath resolves against homedir(); redirect HOME for this file only so
// installIntoClient never touches a real config on the machine running the suite.
const tmpHome = mkdtempSync(join(tmpdir(), "valija-installer-home-"));
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const originalAppData = process.env.APPDATA;
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;
process.env.APPDATA = join(tmpHome, "AppData", "Roaming");

afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  if (originalAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = originalAppData;
});

describe("installIntoClient — the shared client-config writer (D-R(a)'s companion step)", () => {
  it.each(
    CLIENTS,
  )("called with no vaultPath writes an entry with no env block, for %s", (client) => {
    const result = installIntoClient(client);
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija).toEqual({ command: "npx", args: ["-y", "valija", "mcp"] });
    expect(written.mcpServers.valija.env).toBeUndefined();
  });

  it.each(
    CLIENTS,
  )("called with a vaultPath writes the same entry plus an env block, for %s", (client) => {
    const result = installIntoClient(client, "/Users/oscar/Dropbox/valija");
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija).toEqual({
      command: "npx",
      args: ["-y", "valija", "mcp"],
      env: { VALIJA_HOME: "/Users/oscar/Dropbox/valija" },
    });
  });

  it("preserves everything else already in the config", () => {
    const client = "claude-code";
    installIntoClient(client); // create a config
    const configPath = clientConfigPath(client);
    const before = JSON.parse(readFileSync(configPath, "utf8"));
    const withCustomKey = { ...before, someOtherSetting: true };
    writeFileSync(configPath, JSON.stringify(withCustomKey));

    installIntoClient(client, "/tmp/new-vault");
    const after = JSON.parse(readFileSync(configPath, "utf8"));
    expect(after.someOtherSetting).toBe(true);
    expect(after.mcpServers.valija.env).toEqual({ VALIJA_HOME: "/tmp/new-vault" });
  });
});

describe("manualInstructions — unaffected by the vaultPath parameter", () => {
  it("still renders the plain command/args entry, with no env block", () => {
    const text = manualInstructions("cursor");
    expect(text).toContain('"command": "npx"');
    expect(text).not.toContain("env");
  });
});
