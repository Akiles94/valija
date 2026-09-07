import { describe, expect, it } from "vitest";
import { resolveMcpLaunch } from "./mcp-launch.js";

describe("resolveMcpLaunch", () => {
  it("points node at the installed valija's dist/program.js under a posix global prefix", () => {
    const entry = resolveMcpLaunch("linux", "/usr/local");
    expect(entry.command).toBe("node");
    expect(entry.args).toEqual(["/usr/local/lib/node_modules/valija/dist/program.js", "mcp"]);
  });

  it("uses the same posix layout on darwin", () => {
    const entry = resolveMcpLaunch("darwin", "/opt/homebrew");
    expect(entry.args[0]).toBe("/opt/homebrew/lib/node_modules/valija/dist/program.js");
  });

  it("drops the extra lib/ segment on win32, matching npm's Windows global layout", () => {
    const entry = resolveMcpLaunch("win32", "C:\\nvm4w\\nodejs");
    expect(entry.command).toBe("node");
    expect(entry.args[0]).toContain("node_modules");
    expect(entry.args[0]).not.toContain("lib");
    expect(entry.args[1]).toBe("mcp");
  });

  it("never emits an npx/network-fetch shape", () => {
    const entry = resolveMcpLaunch("linux", "/usr/local");
    expect(entry.command).not.toBe("npx");
  });
});
