import type { IpcResult, VaultUnlockResponse } from "../../shared/ipc/messages.js";

export type UnlockOutcome =
  | { kind: "unlocked"; fork?: NonNullable<VaultUnlockResponse["fork"]> }
  | { kind: "upgrade-required" }
  | { kind: "error"; code: string };

/**
 * The one place that decides what an unlock attempt's raw IPC result means
 * for navigation — `VAULT_UPGRADE_REQUIRED` (D-J(b)) is a distinct outcome,
 * not just another error to show inline. Pulled out of `LockedScreen` so
 * this routing decision is headlessly testable without a DOM (Gate P scopes
 * DOM-level tests to `recovery-kit.tsx` and, later, `relocate-vault.tsx`
 * only).
 */
export function classifyUnlockResult(result: IpcResult<VaultUnlockResponse>): UnlockOutcome {
  if (!result.ok) {
    if (result.error.code === "VAULT_UPGRADE_REQUIRED") return { kind: "upgrade-required" };
    return { kind: "error", code: result.error.code };
  }
  return result.value.fork === undefined
    ? { kind: "unlocked" }
    : { kind: "unlocked", fork: result.value.fork };
}
