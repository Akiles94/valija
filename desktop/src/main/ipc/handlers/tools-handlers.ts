import { existsSync, readFileSync } from "node:fs";
import {
  CLIENTS,
  type ClientId,
  clientConfigPath,
  installIntoClient,
} from "../../../../../src/delivery/cli/installer.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { DomainError, err, ok, type Result } from "../../../../../src/shared/domain/result.js";
import type {
  ToolsConnectRequest,
  ToolsConnectResponse,
  ToolsStatusEntry,
} from "../../../shared/ipc/messages.js";
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

function connectClient(
  clientRaw: string,
  vaultRoot: string,
): Result<{ configPath: string; backupPath: string | null }, DomainError> {
  if (!isKnownClient(clientRaw)) {
    return err(new DomainError("UNSUPPORTED_SOURCE", `Unknown client: ${clientRaw}`));
  }
  try {
    return ok(installIntoClient(clientRaw, vaultRoot));
  } catch (error) {
    return err(new DomainError("STORAGE_ERROR", (error as Error).message));
  }
}

/**
 * `tools:status` never opens `vault.db`, never touches the keychain, and
 * changes no lock state or lineage — it only reads client config files that
 * already exist on disk, the same check `doctor` makes today.
 */
export function createToolsHandlers(getContainer: () => Container) {
  return {
    "tools:status": (): ToolsStatusEntry[] =>
      CLIENTS.map((client) => {
        const pointsAt = currentVaultPath(client);
        return {
          client,
          connected: existsSync(clientConfigPath(client)) && pointsAt !== undefined,
          ...(pointsAt === undefined ? {} : { vaultPath: pointsAt }),
        };
      }),

    "tools:connect": (req: ToolsConnectRequest) =>
      toIpcResult(
        connectClient(req.client, getContainer().paths.root),
        (v): ToolsConnectResponse => v,
      ),
  };
}
