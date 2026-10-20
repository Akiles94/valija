---
title: Move the vault to another folder
theme: Desktop app
---

## Who
A desktop-app user who wants the vault somewhere else, typically inside a folder their sync client
already replicates (Dropbox, iCloud Drive, Syncthing…).

## Why
To use one vault on several machines, or simply to keep it in a better place, without exporting
and re-importing anything, and without breaking the AI tools that already use it.

## Business rules
- The vault must be locked first; the move never handles the key.
- The destination is checked before anything is written: it must exist, be writable, hold no vault,
  and not be inside the current vault folder. The current folder must be settled (no conflicted
  copies, leftover backups or sidecar files).
- Files are copied, verified byte for byte, and only then is the original removed. Never "delete,
  then copy".
- If removing the original fails, the copy is discarded so there is never two openable vaults. If
  even that fails, the user is told exactly which folder to delete by hand.
- Connected AI tools are re-pointed to the new location afterwards; one that cannot be re-pointed is
  reported with a snippet to paste.
- The desktop app can also switch to a vault that already exists in another folder.
- Paths never travel from the window to the main process: folders are chosen in a native dialog
  and passed as opaque handles.

## What can go wrong
- The vault is unlocked ({{err:VAULT_MUST_BE_LOCKED}}).
- The destination already holds a vault ({{err:RELOCATION_DESTINATION_OCCUPIED}}), cannot be used
  ({{err:RELOCATION_DESTINATION_UNUSABLE}}), or is inside the current folder
  ({{err:RELOCATION_DESTINATION_NESTED}}).
- The current folder is not settled ({{err:RELOCATION_SOURCE_UNSETTLED}}).
- The copy or its verification fails ({{err:RELOCATION_COPY_FAILED}}, {{err:RELOCATION_VERIFY_FAILED}}).
- Cleanup fails after a failed removal ({{err:RELOCATION_ROLLBACK_FAILED}}).

## Entry points
- CLI: none — known gap, `valija relocate` is owed to a future advance (see the parity table)
- Desktop: {{ipc:dialog:chooseVaultFolder}}, {{ipc:relocation:preflight}}, {{ipc:relocation:move}}, {{ipc:relocation:retryClient}}, {{ipc:relocation:pointAtExisting}}

## Steps
1. [User → Desktop app] Chooses a destination folder in a native dialog — {{ipc:dialog:chooseVaultFolder}}
2. [Desktop app → Main process] Checks the destination and lists AI tools to re-point — {{ipc:relocation:preflight}}
3. [Main process → RelocationRules] Applies the safety rules without writing anything — {{refuseUnsafeRelocation}}
4. [User → Desktop app] Confirms the move — {{ipc:relocation:move}}
5. [Main process → LockVault] Locks the vault — {{LockVault}}
6. [Main process → RelocateVault] Copies, verifies, then removes the original — {{RelocateVault}}
7. [RelocateVault → VaultMover] Copies and compares the files byte for byte — {{FileVaultMover}}
8. [Main process → AI tool configs] Re-points each connected AI tool to the new folder — {{installIntoClient}}
9. [Main process → Desktop app] Reports the new location and each tool's outcome; a failed tool can be retried — {{ipc:relocation:retryClient}}

## Errors
- {{err:VAULT_MUST_BE_LOCKED}} — the vault was still unlocked.
- {{err:RELOCATION_DESTINATION_OCCUPIED}} — the destination already holds a vault.
- {{err:RELOCATION_DESTINATION_UNUSABLE}} — the destination does not exist or is not writable.
- {{err:RELOCATION_DESTINATION_NESTED}} — the destination is inside the current vault folder.
- {{err:RELOCATION_SOURCE_UNSETTLED}} — the current folder is not settled.
- {{err:RELOCATION_COPY_FAILED}} — copying failed; the partial copy was removed.
- {{err:RELOCATION_VERIFY_FAILED}} — the copy did not match; it was removed.
- {{err:RELOCATION_ROLLBACK_FAILED}} — both removal and cleanup failed; delete one folder by hand.
