import { existsSync, readFileSync } from "node:fs";
import {
  CLIENTS,
  type ClientId,
  clientConfigPath,
  installIntoClient,
  manualInstructions,
} from "../../../../../src/delivery/cli/installer.js";
import { ensureValijaInstalled } from "../../../../../src/delivery/cli/mcp-launch.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { DomainError, err, ok, type Result } from "../../../../../src/shared/domain/result.js";
import type {
  NodeStatusResponse,
  ToolsConnectRequest,
  ToolsConnectResponse,
  ToolsStatusEntry,
} from "../../../shared/ipc/messages.js";
import type { AppPreferencesStore } from "../../application/ports/app-preferences.js";
import type { NodeProbe } from "../../application/ports/node-probe.js";
import { toIpcResult } from "../to-ipc-result.js";

function currentVaultPath(client: ClientId): string | undefined {
  const configPath = clientConfigPath(client);
  if (!existsSync(configPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      mcpServers?: Record<string, { env?: { VALIJA_HOME?: string } }>;
    };
    return parsed.mcpServers?.valija?.env?.VALIJA_HOME;
  } catch {
    return undefined;
  }
}

function isKnownClient(client: string): client is ClientId {
  return (CLIENTS as readonly string[]).includes(client);
}

/** Config-only presence check — mirrors `diagnostics.ts#checkClient`'s absent/invalid/installed split, kept separate because this handler must stay independently auditable as never touching `vault.db` or the keychain. */
function clientPresence(client: ClientId): ToolsStatusEntry["presence"] {
  const configPath = clientConfigPath(client);
  if (!existsSync(configPath)) return "not-installed";
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    return parsed.mcpServers?.valija !== undefined ? "installed" : "not-installed";
  } catch {
    return "config-invalid";
  }
}

/**
 * An unknown client id is a caller mistake — a real `IpcResult` failure. A
 * known client whose config file `installIntoClient` cannot merge into
 * (invalid JSON), or a `valija` that `ensureValijaInstalled` cannot install
 * (D4), is expected, recoverable content instead: the response still
 * carries `ok: true`, with `outcome: "configUnreadable"` and a manual
 * fallback snippet built from `installer.ts`'s own `manualInstructions` —
 * never the caught error's `.message` (D-V(d)). No new outcome id: both
 * failure shapes leave the user with the same manual snippet to fall back to.
 */
function connectClient(
  clientRaw: string,
  vaultRoot: string,
  autoLockMinutes: number | null,
): Result<ToolsConnectResponse, DomainError> {
  if (!isKnownClient(clientRaw)) {
    return err(new DomainError("UNSUPPORTED_SOURCE", `Unknown client: ${clientRaw}`));
  }
  try {
    ensureValijaInstalled();
    const { configPath, backupPath } = installIntoClient(clientRaw, vaultRoot, autoLockMinutes);
    return ok({
      outcome: "connected",
      configPath,
      ...(backupPath === null ? {} : { backupPath }),
    });
  } catch {
    return ok({ outcome: "configUnreadable", manualSnippet: manualInstructions(clientRaw) });
  }
}

/**
 * `tools:status` never opens `vault.db`, never touches the keychain, and
 * changes no lock state or lineage — it only reads client config files that
 * already exist on disk, the same check `doctor` makes today. `tools:connect`
 * shares the same guarantee: it only ever writes a client's own config file.
 */
export function createToolsHandlers(
  getContainer: () => Container,
  nodeProbe: NodeProbe,
  preferencesStore: AppPreferencesStore,
) {
  return {
    "tools:status": (): ToolsStatusEntry[] =>
      CLIENTS.map((client) => {
        const pointsAt = currentVaultPath(client);
        return {
          client,
          presence: clientPresence(client),
          ...(pointsAt === undefined ? {} : { vaultPath: pointsAt }),
        };
      }),

    // The chosen TTL is written on every Connect press (CONNECT D-D/D-F) —
    // never a silent background rewrite of an already-connected client.
    "tools:connect": (req: ToolsConnectRequest) =>
      toIpcResult(
        connectClient(
          req.client,
          getContainer().paths.root,
          preferencesStore.read().autoLockMinutes,
        ),
        (v) => v,
      ),

    "tools:nodeStatus": (): Promise<NodeStatusResponse> => nodeProbe.check(),
  };
}
