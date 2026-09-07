import { describe, expect, it, vi } from "vitest";
import { ensureValijaInstalled, resolveMcpLaunch } from "./mcp-launch.js";

describe("resolveMcpLaunch", () => {
  it("points node at the installed valija's dist/program.js under a posix global prefix", () => {
    const entry = resolveMcpLaunch("linux", () => "/usr/local");
    expect(entry?.command).toBe("node");
    expect(entry?.args).toEqual(["/usr/local/lib/node_modules/valija/dist/program.js", "mcp"]);
  });

  it("uses the same posix layout on darwin", () => {
    const entry = resolveMcpLaunch("darwin", () => "/opt/homebrew");
    expect(entry?.args[0]).toBe("/opt/homebrew/lib/node_modules/valija/dist/program.js");
  });

  it("drops the extra lib/ segment on win32, matching npm's Windows global layout", () => {
    const entry = resolveMcpLaunch("win32", () => "C:\\nvm4w\\nodejs");
    expect(entry?.command).toBe("node");
    expect(entry?.args[0]).toContain("node_modules");
    expect(entry?.args[0]).not.toContain("lib");
    expect(entry?.args[1]).toBe("mcp");
  });

  it("never emits an npx/network-fetch shape", () => {
    const entry = resolveMcpLaunch("linux", () => "/usr/local");
    expect(entry?.command).not.toBe("npx");
  });

  it("returns null, never throws, when the prefix can't be resolved (npm not on PATH)", () => {
    expect(resolveMcpLaunch("linux", () => null)).toBeNull();
    expect(() => resolveMcpLaunch("win32", () => null)).not.toThrow();
  });
});

describe("ensureValijaInstalled", () => {
  it("does nothing — never calls runInstall — when the resolved entry already exists", () => {
    const runInstall = vi.fn();
    const checkExists = vi.fn(() => true);
    ensureValijaInstalled(
      () => ({ command: "node", args: ["/prefix/program.js", "mcp"] }),
      runInstall,
      checkExists,
    );
    expect(runInstall).not.toHaveBeenCalled();
  });

  it("installs valija when the entry is missing, then succeeds once it exists", () => {
    const runInstall = vi.fn();
    let installed = false;
    const checkExists = vi.fn(() => installed);
    runInstall.mockImplementation(() => {
      installed = true;
    });
    ensureValijaInstalled(
      () => ({ command: "node", args: ["/prefix/program.js", "mcp"] }),
      runInstall,
      checkExists,
    );
    expect(runInstall).toHaveBeenCalledWith("npm", ["i", "-g", "valija"]);
  });

  it("throws when the global prefix can't be resolved at all", () => {
    expect(() => ensureValijaInstalled(() => null)).toThrow(/PATH/);
  });

  it("throws when runInstall itself fails (npm errors out)", () => {
    const runInstall = vi.fn(() => {
      throw new Error("npm ERR! network timeout");
    });
    expect(() =>
      ensureValijaInstalled(
        () => ({ command: "node", args: ["/prefix/program.js", "mcp"] }),
        runInstall,
        () => false,
      ),
    ).toThrow("npm ERR! network timeout");
  });

  it("throws a typed, readable error when npm 'succeeds' but the entry still doesn't exist (§10's top risk, W1)", () => {
    const runInstall = vi.fn(); // succeeds — but checkExists always says no
    expect(() =>
      ensureValijaInstalled(
        () => ({ command: "node", args: ["/prefix/program.js", "mcp"] }),
        runInstall,
        () => false,
      ),
    ).toThrow(/entry point was not found/);
    expect(runInstall).toHaveBeenCalledTimes(1);
  });
});
