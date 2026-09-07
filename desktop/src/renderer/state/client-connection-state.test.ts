import { describe, expect, it } from "vitest";
import type {
  NodeStatusResponse,
  ToolsStatusEntry,
  VaultStatusResponse,
} from "../../shared/ipc/messages.js";
import { clientConnectionState } from "./client-connection-state.js";

const nodeOk: NodeStatusResponse = { nodeRunnable: true, npmRunnable: true };
const nodeMissing: NodeStatusResponse = { nodeRunnable: false, npmRunnable: true };

function vaultStatus(overrides: Partial<VaultStatusResponse>): VaultStatusResponse {
  return {
    initialized: true,
    unlocked: true,
    dbPath: "/vault/db",
    journalMode: "DELETE",
    sidecars: [],
    autoLock: { ttlMinutes: 15 },
    ...overrides,
  };
}

function entry(presence: ToolsStatusEntry["presence"]): ToolsStatusEntry {
  return { client: "cursor", presence };
}

describe("clientConnectionState", () => {
  it("config-invalid takes precedence over everything else", () => {
    expect(clientConnectionState(entry("config-invalid"), vaultStatus({}), nodeMissing)).toBe(
      "config-invalid",
    );
  });

  it("not-installed when the client has no valija entry", () => {
    expect(clientConnectionState(entry("not-installed"), vaultStatus({}), nodeOk)).toBe(
      "not-installed",
    );
  });

  it("node-missing when installed but node/npm aren't runnable", () => {
    expect(clientConnectionState(entry("installed"), vaultStatus({}), nodeMissing)).toBe(
      "node-missing",
    );
  });

  it("vault-not-initialized when installed + node ok but no vault exists yet", () => {
    expect(
      clientConnectionState(entry("installed"), vaultStatus({ initialized: false }), nodeOk),
    ).toBe("vault-not-initialized");
  });

  it("vault-locked when installed + node ok + vault initialized but locked", () => {
    expect(
      clientConnectionState(entry("installed"), vaultStatus({ unlocked: false }), nodeOk),
    ).toBe("vault-locked");
  });

  it("ready when installed + node ok + vault initialized and unlocked", () => {
    expect(clientConnectionState(entry("installed"), vaultStatus({}), nodeOk)).toBe("ready");
  });

  it("skips the node check while node status hasn't loaded yet", () => {
    expect(clientConnectionState(entry("installed"), vaultStatus({}), null)).toBe("ready");
  });

  it("treats a not-yet-loaded vault status as vault-not-initialized, never a guess", () => {
    expect(clientConnectionState(entry("installed"), null, nodeOk)).toBe("vault-not-initialized");
  });
});
