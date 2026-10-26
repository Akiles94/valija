import type { SchemaVersionsMessage } from "../../shared/ipc/messages.js";

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
  | { phase: "kit-pending"; lockedAfterKit?: true }
  | { phase: "locked" }
  | { phase: "unlocking" }
  | { phase: "upgrade-required" }
  | { phase: "unlocked"; forkNotice?: ForkNotice }
  | { phase: "schema-too-new"; versions: SchemaVersionsMessage };

/** Phase at launch, before the vault status is known. */
export const INITIAL_STATE: SessionState = { phase: "checking" };

/** Phase once the vault status is known: no vault, locked, or unlocked. */
export function afterStatusCheck(status: {
  initialized: boolean;
  unlocked: boolean;
  schemaTooNew?: SchemaVersionsMessage;
}): SessionState {
  if (!status.initialized) return { phase: "no-vault" };
  // Checked before `unlocked`: a newer vault with a valid key never reaches the dashboard.
  if (status.schemaTooNew !== undefined) return afterSchemaTooNew(status.schemaTooNew);
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

/** The passphrase changed: show the new kit first; afterwards unlocked, or locked if the keychain refused the new key (D-H). */
export function afterPassphraseChanged(unlockedOnThisDevice: boolean): SessionState {
  return unlockedOnThisDevice
    ? { phase: "kit-pending" }
    : { phase: "kit-pending", lockedAfterKit: true };
}

/** Phase once the user confirmed they saved the recovery kit: unlocked, or locked when the keychain refused a changed passphrase's key. */
export function afterKitAcknowledged(lockedAfterKit = false): SessionState {
  return lockedAfterKit ? { phase: "locked" } : { phase: "unlocked" };
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

/** Terminal (P-18 (b)): the vault was upgraded by a newer Valija. Only quitting leaves this phase. */
export function afterSchemaTooNew(versions: SchemaVersionsMessage): SessionState {
  return { phase: "schema-too-new", versions };
}

/**
 * D-U(a)'s hard requirement: nothing — including the welcome tour (Slice 11)
 * — may be shown between the recovery kit and its acknowledgement. The
 * router consults this before rendering anything but the kit-pending screen.
 */
export function canNavigateAwayFrom(state: SessionState): boolean {
  return state.phase !== "kit-pending";
}
