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
  )("called with no vaultPath writes a resolved node entry with no env block, for %s (P1)", (client) => {
    const result = installIntoClient(client);
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    // Asserts shape, not the machine's actual global prefix (installer.test.ts
    // is not the place to stub resolveMcpLaunch — see mcp-launch.test.ts for
    // its own platform-branch coverage).
    expect(written.mcpServers.valija.command).toBe("node");
    expect(written.mcpServers.valija.args).toHaveLength(2);
    expect(written.mcpServers.valija.args[0]).toContain("valija");
    expect(written.mcpServers.valija.args[1]).toBe("mcp");
    expect(written.mcpServers.valija.command).not.toBe("npx");
    expect(written.mcpServers.valija.env).toBeUndefined();
  });

  it.each(
    CLIENTS,
  )("called with a vaultPath writes the same entry plus an env block, for %s", (client) => {
    const result = installIntoClient(client, "/Users/oscar/Dropbox/valija");
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija.command).toBe("node");
    expect(written.mcpServers.valija.env).toEqual({
      VALIJA_HOME: "/Users/oscar/Dropbox/valija",
    });
  });

  it("called with autoLockMinutes writes it into env alongside VALIJA_HOME (CONNECT D-D)", () => {
    const result = installIntoClient("cursor", "/Users/oscar/.valija", 30);
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija.env).toEqual({
      VALIJA_HOME: "/Users/oscar/.valija",
      VALIJA_AUTOLOCK_MINUTES: "30",
    });
  });

  it("writes 'off' for a disabled (null) autoLockMinutes, never a bare zero", () => {
    const result = installIntoClient("cursor", "/Users/oscar/.valija", null);
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija.env.VALIJA_AUTOLOCK_MINUTES).toBe("off");
  });

  it("omits VALIJA_AUTOLOCK_MINUTES entirely when the caller doesn't supply it (CLI parity)", () => {
    const result = installIntoClient("cursor", "/Users/oscar/.valija");
    const written = JSON.parse(readFileSync(result.configPath, "utf8"));
    expect(written.mcpServers.valija.env).toEqual({ VALIJA_HOME: "/Users/oscar/.valija" });
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
  it("renders the resolved node entry, with no env block and no stale npx snippet", () => {
    const text = manualInstructions("cursor");
    expect(text).toContain('"command": "node"');
    expect(text).not.toContain("npx");
    expect(text).not.toContain("env");
  });
});
