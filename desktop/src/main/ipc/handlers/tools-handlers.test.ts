import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLIENTS, clientConfigPath } from "../../../../../src/delivery/cli/installer.js";
import type { Container } from "../../../../../src/delivery/container.js";
import type { NodeProbe } from "../../application/ports/node-probe.js";
import { createToolsHandlers } from "./tools-handlers.js";

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

/** clientConfigPath's directory (e.g. ~/.cursor/) may not exist yet in a fresh temp HOME. */
function writeRawClientConfig(configPath: string, content: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, content);
}

describe("tools-handlers", () => {
  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  it("tools:status reports every client as not connected before anything is installed", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
    );
    const status = handlers["tools:status"]();
    expect(status).toHaveLength(CLIENTS.length);
    for (const entry of status) {
      expect(entry.connected).toBe(false);
      expect(entry.vaultPath).toBeUndefined();
    }
  });

  it("tools:connect writes the current vault root, and tools:status then reports it", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/my-vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
    );
    const connected = handlers["tools:connect"]({ client: "cursor" });
    expect(connected.ok).toBe(true);
    if (connected.ok) {
      expect(connected.value.outcome).toBe("connected");
      expect(connected.value.configPath).toBe(clientConfigPath("cursor"));
    }

    const status = handlers["tools:status"]();
    const cursor = status.find((s) => s.client === "cursor");
    expect(cursor?.connected).toBe(true);
    expect(cursor?.vaultPath).toBe("/tmp/my-vault");
  });

  it("tools:connect refuses an unknown client with a typed error code, not a thrown exception", () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: true, npmRunnable: true }),
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
    );
    // fakeContainer only exposes `paths` — a keychain or vault-db read would
    // throw against this container, so a clean result here proves neither happened.
    expect(() => handlers["tools:connect"]({ client: "claude-code" })).not.toThrow();
  });

  it("tools:nodeStatus returns whatever the injected probe reports, unchanged", async () => {
    const handlers = createToolsHandlers(
      () => fakeContainer("/tmp/vault"),
      fakeNodeProbe({ nodeRunnable: false, npmRunnable: true }),
    );
    const status = await handlers["tools:nodeStatus"]();
    expect(status).toEqual({ nodeRunnable: false, npmRunnable: true });
  });
});
