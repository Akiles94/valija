import type {
  NodeStatusResponse,
  ToolsStatusEntry,
  VaultStatusResponse,
} from "../../shared/ipc/messages.js";

/** The §5 state ids verbatim (advances/CONNECT/refined.md) — the contract every client card renders exactly one of. */
export type ClientConnectionState =
  | "not-installed"
  | "config-invalid"
  | "node-missing"
  | "vault-not-initialized"
  | "vault-locked"
  | "ready";

/**
 * Pure precedence rule combining a client's config presence with the
 * already-fetched global `VaultStatus`/`NodeStatus` — no second "is it
 * healthy" computation invented (mirrors `state/diagnostic-rows.ts`). `vault`
 * and `node` are `null` only before their own fetch resolves, in which case
 * that check is skipped rather than guessed at (the caller re-renders once
 * both land).
 */
export function clientConnectionState(
  entry: ToolsStatusEntry,
  vault: VaultStatusResponse | null,
  node: NodeStatusResponse | null,
): ClientConnectionState {
  if (entry.presence === "config-invalid") return "config-invalid";
  if (entry.presence === "not-installed") return "not-installed";
  if (node !== null && (!node.nodeRunnable || !node.npmRunnable)) return "node-missing";
  if (vault === null || !vault.initialized) return "vault-not-initialized";
  if (!vault.unlocked) return "vault-locked";
  return "ready";
}
