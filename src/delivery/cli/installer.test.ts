import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { CLIENTS, clientConfigPath, installIntoClient, manualInstructions } from "./installer.js";
import { resolveMcpLaunch } from "./mcp-launch.js";

// installIntoClient/manualInstructions both resolve the launch entry through
// mcp-launch.ts, which otherwise shells out to real `npm prefix -g` on every
// call — slow, machine-dependent, and against plan.md's explicit instruction
// to stub this rather than assert an absolute, machine-specific path (W4).
// mcp-launch.ts's own platform-branch logic is covered by mcp-launch.test.ts.
vi.mock("./mcp-launch.js", () => ({
  resolveMcpLaunch: vi.fn(() => ({
    command: "node",
    args: ["/fake/global/prefix/lib/node_modules/valija/dist/program.js", "mcp"],
  })),
}));

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
    expect(written.mcpServers.valija).toEqual({
      command: "node",
      args: ["/fake/global/prefix/lib/node_modules/valija/dist/program.js", "mcp"],
    });
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

  it("throws (never writes) when the launch entry can't be resolved, so the caller's fallback runs instead (C1/C2)", () => {
    vi.mocked(resolveMcpLaunch).mockReturnValueOnce(null);
    const configPath = clientConfigPath("cursor");
    const before = readFileSync(configPath, "utf8");
    expect(() => installIntoClient("cursor")).toThrow(/PATH/);
    expect(readFileSync(configPath, "utf8")).toBe(before); // untouched, not partially written
  });
});

describe("manualInstructions — never throws (C2), always leads with the fix (W6)", () => {
  it("renders the resolved node entry, with no env block and no stale npx snippet", () => {
    const text = manualInstructions("cursor");
    expect(text).toContain("npm i -g valija");
    expect(text).toContain('"command": "node"');
    expect(text).not.toContain("npx");
    expect(text).not.toContain("env");
  });

  it("falls back to a fill-in-yourself template, without throwing, when the launch entry can't be resolved", () => {
    vi.mocked(resolveMcpLaunch).mockReturnValueOnce(null);
    let text = "";
    expect(() => {
      text = manualInstructions("cursor");
    }).not.toThrow();
    expect(text).toContain("npm i -g valija");
    expect(text).toContain("npm prefix -g");
  });
});
