import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CLIENTS, clientConfigPath } from "../../../../../src/delivery/cli/installer.js";
import { ensureValijaInstalled } from "../../../../../src/delivery/cli/mcp-launch.js";
import type { Container } from "../../../../../src/delivery/container.js";
import type { NodeProbe } from "../../application/ports/node-probe.js";
import { createToolsHandlers } from "./tools-handlers.js";

// `installIntoClient`/`ensureValijaInstalled` both go through mcp-launch.ts,
// which otherwise shells out to real `npm` — including, on ensure, a real
// `npm i -g valija` on a machine that doesn't have it. Stubbed so this suite
// never touches the network or the machine's global npm prefix (Slice 4).
vi.mock("../../../../../src/delivery/cli/mcp-launch.js", () => ({
  ensureValijaInstalled: vi.fn(),
  resolveMcpLaunch: () => ({ command: "node", args: ["/fake/valija/dist/program.js", "mcp"] }),
}));

const tmpHome = mkdtempSync(join(tmpdir(), "valija-tools-home-"));
const originalHome = process.env.HOME;
beforeAll(() => {
  process.env.HOME = tmpHome;
});
afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
});

function fakeContainer(vaultRoot: string): Container {
  // biome-ignore lint/suspicious/noExplicitAny: only paths.root is read by tools-handlers.ts
  return { paths: { root: vaultRoot, header: "", db: "" } } as any as Container;
}

function fakeNodeProbe(result: { nodeRunnable: boolean; npmRunnable: boolean }): NodeProbe {
  return { check: async () => result };
}

function fakePreferencesStore(autoLockMinutes: number | null = 15) {
  return {
    read: () => ({
      vaultPath: null,
      theme: "system" as const,
      language: "system" as const,
      tourSeen: false,
      autoLockMinutes,
    }),
    write: () => {},
  };
}

/** clientConfigPath's directory (e.g. ~/.cursor/) may not exist yet in a fresh temp HOME. */
function writeRawClientConfig(configPath: string, content: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, content);
}

describe("tools-handlers", () => {
  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("tools:status reports every client as not-installed before anything is installed", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const status = handlers["tools:status"]();
    expect(status).toHaveLength(CLIENTS.length);
    for (const entry of status) {
      expect(entry.presence).toBe("not-installed");
      expect(entry.vaultPath).toBeUndefined();
    }
  });

  it("tools:connect writes the current vault root, and tools:status then reports it", () => {
    vi.mocked(ensureValijaInstalled).mockClear();
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/my-vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const connected = handlers["tools:connect"]({ client: "cursor" });
    expect(connected.ok).toBe(true);
    if (connected.ok) {
      expect(connected.value.outcome).toBe("connected");
      expect(connected.value.configPath).toBe(clientConfigPath("cursor"));
    }
    expect(ensureValijaInstalled).toHaveBeenCalled();

    const status = handlers["tools:status"]();
    const cursor = status.find((s) => s.client === "cursor");
    expect(cursor?.presence).toBe("installed");
    expect(cursor?.vaultPath).toBe("/tmp/my-vault");
  });

  it("tools:connect falls back to the manual snippet (D4) when ensureValijaInstalled cannot install valija", () => {
    vi.mocked(ensureValijaInstalled).mockImplementationOnce(() => {
      throw new Error("npm install failed");
    });
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const result = handlers["tools:connect"]({ client: "cursor" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcome).toBe("configUnreadable");
      expect(result.value.manualSnippet).toContain("mcpServers");
      expect(result.value.manualSnippet).not.toContain("npm install failed");
    }
  });

  it("tools:connect writes the current autoLockMinutes preference into the client's env (CONNECT D-D/D-F)", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(30),
    );
    const result = handlers["tools:connect"]({ client: "cursor" });
    expect(result.ok).toBe(true);
    const written = JSON.parse(readFileSync(clientConfigPath("cursor"), "utf8"));
    expect(written.mcpServers.valija.env.VALIJA_AUTOLOCK_MINUTES).toBe("30");
  });

  it("tools:status reports config-invalid for a client whose config isn't valid JSON", () => {
    writeRawClientConfig(clientConfigPath("cursor"), "{ not valid json");
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const status = handlers["tools:status"]();
    const cursor = status.find((s) => s.client === "cursor");
    expect(cursor?.presence).toBe("config-invalid");
  });

  it("tools:connect refuses an unknown client with a typed error code, not a thrown exception", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const result = handlers["tools:connect"]({ client: "not-a-real-client" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBeDefined();
  });

  it("tools:connect reports configUnreadable (not an IpcResult failure) for a client whose config isn't valid JSON, with a manual fallback", () => {
    writeRawClientConfig(clientConfigPath("cursor"), "{ not valid json");
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );

    const result = handlers["tools:connect"]({ client: "cursor" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcome).toBe("configUnreadable");
      expect(result.value.manualSnippet).toContain("mcpServers");
      expect(result.value.manualSnippet).not.toContain("SyntaxError");
    }
    // Untouched — never overwritten on a merge failure.
    expect(readFileSync(clientConfigPath("cursor"), "utf8")).toBe("{ not valid json");
  });

  it("tools:connect never opens vault.db and never touches the keychain — it only reads/writes client config files", () => {
    const container = fakeContainer("/tmp/vault");
    const handlers = createToolsHandlers(
      () => container,
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
      fakePreferencesStore(),
    );
    // fakeContainer only exposes `paths` — a keychain or vault-db read would
    // throw against this container, so a clean result here proves neither happened.
    expect(() => handlers["tools:connect"]({ client: "claude-code" })).not.toThrow();
  });

  it("tools:nodeStatus returns whatever the injected probe reports, unchanged", async () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: false, npmRunnable: true }),
      fakePreferencesStore(),
    );
    const status = await handlers["tools:nodeStatus"]();
    expect(status).toEqual({ nodeRunnable: false, npmRunnable: true });
  });
});
