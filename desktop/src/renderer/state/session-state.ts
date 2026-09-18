export interface ForkNotice {
  generation: number;
  writer: string;
  noticeCode: string;
}

export type SessionState =
  | { phase: "checking" }
  | { phase: "no-vault" }
  | { phase: "creating" }
  | { phase: "kit-pending" }
  | { phase: "locked" }
  | { phase: "unlocking" }
  | { phase: "upgrade-required" }
  | { phase: "unlocked"; forkNotice?: ForkNotice };

export const INITIAL_STATE: SessionState = { phase: "checking" };

export function afterStatusCheck(status: {
  initialized: boolean;
  unlocked: boolean;
}): SessionState {
  if (!status.initialized) return { phase: "no-vault" };
  return status.unlocked ? { phase: "unlocked" } : { phase: "locked" };
}

export function creating(): SessionState {
  return { phase: "creating" };
}

/** CreateVault leaves the vault unlocked, but the kit must be shown and acknowledged first (§8.2). */
export function afterCreateSuccess(): SessionState {
  return { phase: "kit-pending" };
}

export function afterKitAcknowledged(): SessionState {
  return { phase: "unlocked" };
}

export function unlocking(): SessionState {
  return { phase: "unlocking" };
}

export function afterUnlockSuccess(forkNotice?: ForkNotice): SessionState {
  return forkNotice === undefined ? { phase: "unlocked" } : { phase: "unlocked", forkNotice };
}

export function afterUnlockUpgradeRequired(): SessionState {
  return { phase: "upgrade-required" };
}

/** Any unlock failure other than VAULT_UPGRADE_REQUIRED — stay locked; the screen shows its own error separately. */
export function afterUnlockFailure(): SessionState {
  return { phase: "locked" };
}

export function afterMigrationCancelled(): SessionState {
  return { phase: "locked" };
}

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
