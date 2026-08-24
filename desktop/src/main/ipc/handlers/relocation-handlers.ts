import { existsSync, readFileSync } from "node:fs";
import {
  CLIENTS,
  type ClientId,
  clientConfigPath,
  installIntoClient,
  manualInstructions,
} from "../../../../../src/delivery/cli/installer.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { resolveVaultPaths } from "../../../../../src/shared/infra/vault-paths.js";
import type { VaultFolderInspection } from "../../../../../src/vault/application/ports/vault-folder.js";
import type { VaultRootInspection } from "../../../../../src/vault/application/ports/vault-mover.js";
import { refuseUnsafeRelocation } from "../../../../../src/vault/domain/services/vault-relocation.js";
import { FileVaultFolder } from "../../../../../src/vault/infra/file-vault-folder.js";
import { readVaultHeader } from "../../../../../src/vault/infra/vault-header.js";
import type {
  RelocationClientEntry,
  RelocationClientResult,
  RelocationMoveRequest,
  RelocationMoveResponse,
  RelocationPointAtExistingRequest,
  RelocationPointAtExistingResponse,
  RelocationPreflightRequest,
  RelocationPreflightResponse,
  RelocationRetryClientRequest,
} from "../../../shared/ipc/messages.js";
import type { AppPreferencesStore } from "../../application/ports/app-preferences.js";
import type { FilePicker } from "../../application/ports/file-picker.js";

type ClientConnectionState = "connected" | "notConnected" | "unreadable";

/**
 * "Currently in `mcpServers`" (§9 item 69), which is broader than
 * `tools-handlers.ts`'s own `connected` check — a client installed by the
 * CLI's own `valija install` never writes an `env` block, so it would read
 * as "not connected" there even though it genuinely has a `valija` entry
 * that relocation must re-point.
 */
function clientConnectionState(client: ClientId): ClientConnectionState {
  const configPath = clientConfigPath(client);
  if (!existsSync(configPath)) return "notConnected";
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "unreadable";
    const servers = (parsed as { mcpServers?: unknown }).mcpServers;
    if (typeof servers !== "object" || servers === null) return "notConnected";
    return Object.hasOwn(servers, "valija") ? "connected" : "notConnected";
  } catch {
    return "unreadable";
  }
}

function clientPreflightEntries(): RelocationClientEntry[] {
  return CLIENTS.map((client) => {
    const state = clientConnectionState(client);
    return {
      client,
      currentlyConnected: state === "connected",
      configUnreadable: state === "unreadable",
    };
  });
}

/**
 * The one writer every re-point (and every ordinary connect) goes through —
 * `installIntoClient`'s own backup-and-merge discipline, never a second
 * config-writing implementation (§9 item 67a).
 */
function repointClient(client: ClientId, newVaultPath: string): RelocationClientResult {
  const state = clientConnectionState(client);
  if (state === "notConnected") return { client, outcome: "notConnected" };
  if (state === "unreadable") {
    return { client, outcome: "configUnreadable", manualSnippet: manualInstructions(client) };
  }
  try {
    const { configPath } = installIntoClient(client, newVaultPath);
    return { client, outcome: "rewritten", configPath };
  } catch {
    return { client, outcome: "configUnreadable", manualSnippet: manualInstructions(client) };
  }
}

function repointAllClients(newVaultPath: string): RelocationClientResult[] {
  return CLIENTS.map((client) => repointClient(client, newVaultPath));
}

function isKnownClient(client: string): client is ClientId {
  return (CLIENTS as readonly string[]).includes(client);
}

/**
 * The exact rule `RelocateVault` itself enforces, previewed without calling
 * the use case — calling it here would actually attempt the move.
 */
function previewRefusal(
  sourceRoot: string,
  destinationRoot: string,
  destinationInspection: VaultRootInspection,
  sourceInspection: VaultFolderInspection,
): string | null {
  const refusal = refuseUnsafeRelocation({
    sourceRoot,
    destinationRoot,
    destinationInspection,
    sourceInspection,
  });
  return refusal === null ? null : refusal.code;
}

export function createRelocationHandlers(
  getContainer: () => Container,
  rebuildContainer: (newRoot: string) => void,
  preferencesStore: AppPreferencesStore,
  filePicker: FilePicker,
) {
  return {
    "relocation:preflight": (req: RelocationPreflightRequest) => {
      const destinationRoot = filePicker.resolveHandle(req.handle);
      if (destinationRoot === undefined) {
        return { ok: false as const, error: { code: "STORAGE_ERROR" } };
      }
      const container = getContainer();
      const refusalCode = previewRefusal(
        container.paths.root,
        destinationRoot,
        container.mover.inspect(destinationRoot),
        container.folder.inspect(),
      );
      const looksLikeCloud = new FileVaultFolder(resolveVaultPaths(destinationRoot)).inspect()
        .looksLikeCloud;

      const response: RelocationPreflightResponse = {
        destinationDisplayName: destinationRoot,
        looksLikeCloud,
        refusalCode,
        clients: clientPreflightEntries(),
      };
      return { ok: true as const, value: response };
    },

    "relocation:move": (req: RelocationMoveRequest) => {
      const destinationRoot = filePicker.resolveHandle(req.handle);
      if (destinationRoot === undefined) {
        return { ok: false as const, error: { code: "STORAGE_ERROR" } };
      }
      const container = getContainer();

      // §4.7 step 31: locked, verifiably at rest, before anything is written.
      const lockResult = container.lockVault.execute();
      if (!lockResult.ok) {
        return { ok: false as const, error: { code: lockResult.error.code } };
      }

      const relocateResult = container.relocateVault.execute(destinationRoot);
      if (!relocateResult.ok) {
        // No preferences write, no client config touched — the move itself
        // did not succeed (§9 item 67).
        return { ok: false as const, error: { code: relocateResult.error.code } };
      }

      const { root } = relocateResult.value;
      preferencesStore.write({ ...preferencesStore.read(), vaultPath: root });
      rebuildContainer(root);

      // Re-pointing is strictly the last step, never interleaved with the
      // move, and a client failure here is never a reason to touch the
      // vault again (D-R(a) rider 4, §9 item 67a).
      const clientResults = repointAllClients(root);

      const response: RelocationMoveResponse = { root, clientResults };
      return { ok: true as const, value: response };
    },

    "relocation:retryClient": (req: RelocationRetryClientRequest) => {
      if (!isKnownClient(req.client)) {
        return { ok: false as const, error: { code: "UNSUPPORTED_SOURCE" } };
      }
      const result = repointClient(req.client, getContainer().paths.root);
      return { ok: true as const, value: result };
    },

    "relocation:pointAtExisting": (req: RelocationPointAtExistingRequest) => {
      const root = filePicker.resolveHandle(req.handle);
      if (root === undefined) {
        return { ok: false as const, error: { code: "STORAGE_ERROR" } };
      }
      // The mirror flow only checks that the folder already holds a
      // readable vault.json — it moves nothing (§4.7's last line).
      const header = readVaultHeader(resolveVaultPaths(root).header);
      if (!header.ok) {
        return { ok: false as const, error: { code: header.error.code } };
      }

      preferencesStore.write({ ...preferencesStore.read(), vaultPath: root });
      rebuildContainer(root);
      const clientResults = repointAllClients(root);

      const response: RelocationPointAtExistingResponse = { root, clientResults };
      return { ok: true as const, value: response };
    },
  };
}
