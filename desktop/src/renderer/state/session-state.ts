/** A multi-device fork found on unlock, shown until the user deals with it. */
export interface ForkNotice {
  generation: number;
  writer: string;
  noticeCode: string;
}

/**
 * The app's top-level phase, from checking for a vault to unlocked; each transition below is a pure
 * function.
 */
export type SessionState =
  | { phase: "checking" }
  | { phase: "no-vault" }
  | { phase: "creating" }
  | { phase: "kit-pending" }
  | { phase: "locked" }
  | { phase: "unlocking" }
  | { phase: "upgrade-required" }
  | { phase: "unlocked"; forkNotice?: ForkNotice };

/** Phase at launch, before the vault status is known. */
export const INITIAL_STATE: SessionState = { phase: "checking" };

/** Phase once the vault status is known: no vault, locked, or unlocked. */
export function afterStatusCheck(status: {
  initialized: boolean;
  unlocked: boolean;
}): SessionState {
  if (!status.initialized) return { phase: "no-vault" };
  return status.unlocked ? { phase: "unlocked" } : { phase: "locked" };
}

/** Phase while the vault is being created. */
export function creating(): SessionState {
  return { phase: "creating" };
}

/** CreateVault leaves the vault unlocked, but the kit must be shown and acknowledged first (§8.2). */
export function afterCreateSuccess(): SessionState {
  return { phase: "kit-pending" };
}

/** Phase once the user confirmed they saved the recovery kit. */
export function afterKitAcknowledged(): SessionState {
  return { phase: "unlocked" };
}

/** Phase while an unlock is in flight. */
export function unlocking(): SessionState {
  return { phase: "unlocking" };
}

/** Phase after a successful unlock, carrying a fork notice when there is one. */
export function afterUnlockSuccess(forkNotice?: ForkNotice): SessionState {
  return forkNotice === undefined ? { phase: "unlocked" } : { phase: "unlocked", forkNotice };
}

/** Phase when unlocking needs the user to confirm a schema upgrade first. */
export function afterUnlockUpgradeRequired(): SessionState {
  return { phase: "upgrade-required" };
}

/** Any unlock failure other than VAULT_UPGRADE_REQUIRED — stay locked; the screen shows its own error separately. */
export function afterUnlockFailure(): SessionState {
  return { phase: "locked" };
}

/** Phase when the user declines the schema upgrade: back to locked. */
export function afterMigrationCancelled(): SessionState {
  return { phase: "locked" };
}

/** Phase after locking: back to the unlock screen. */
export function afterLock(): SessionState {
  return { phase: "locked" };
}

/**
 * D-U(a)'s hard requirement: nothing — including the welcome tour (Slice 11)
 * — may be shown between the recovery kit and its acknowledgement. The
 * router consults this before rendering anything but the kit-pending screen.
 */
export function canNavigateAwayFrom(state: SessionState): boolean {
  return state.phase !== "kit-pending";
}
