import type {
  NodeStatusResponse,
  ToolsStatusEntry,
  VaultStatusResponse,
} from "../../shared/ipc/messages.js";

/** The §5 state ids verbatim (advances/CONNECT/refined.md), plus `checking` for the brief window before `vault`/`node` have loaded — never a guess at one of the real states. */
export type ClientConnectionState =
  | "checking"
  | "not-installed"
  | "config-invalid"
  | "node-missing"
  | "vault-not-initialized"
  | "vault-locked"
  | "ready";

/**
 * Pure precedence rule combining a client's config presence with the
 * already-fetched global `VaultStatus`/`NodeStatus` — no second "is it
 * healthy" computation invented (mirrors `state/diagnostic-rows.ts`).
 * Config presence (`not-installed`/`config-invalid`) is known the moment
 * `tools:status` resolves and is reported immediately either way. `vault`
 * and `node` load separately and briefly resolve to `null`; while either is
 * still `null`, this returns `checking` rather than guessing at
 * `vault-not-initialized` or `ready` — this advance exists to stop the app
 * from asserting things it doesn't actually know yet.
 */
export function clientConnectionState(
  entry: ToolsStatusEntry,
  vault: VaultStatusResponse | null,
  node: NodeStatusResponse | null,
): ClientConnectionState {
  if (entry.presence === "config-invalid") return "config-invalid";
  if (entry.presence === "not-installed") return "not-installed";
  if (vault === null || node === null) return "checking";
  if (!node.nodeRunnable || !node.npmRunnable) return "node-missing";
  if (!vault.initialized) return "vault-not-initialized";
  if (!vault.unlocked) return "vault-locked";
  return "ready";
}
