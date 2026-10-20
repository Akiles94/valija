---
title: Use one vault on several devices
theme: Health and devices
---

## Who
A developer who works on more than one machine and keeps the vault in a folder their own sync
client replicates.

## Why
To have the same AI context on every machine without any Valija server or account: the encrypted
file travels through the sync client the user already trusts.

## Business rules
- Valija never talks to a server; the sync client moves the encrypted file.
- The ritual is: **lock** on device A, let the sync client finish, **unlock** on device B.
- Every write advances the vault's lineage (a generation counter plus a random write stamp). Each
  device remembers the last lineage it saw.
- On unlock, a lineage that moved forward is adopted silently. If two devices wrote independently
  from the same starting point, that is a **fork**: the vault still unlocks, a notice is shown, and
  nothing is deleted or merged. The sync client may have kept the other version as a "conflicted
  copy" file, which status and the setup check point out.
- Lineage lives only inside the encrypted database; the plaintext header never reveals it.

## What can go wrong
- The user skips the ritual and both devices write: a fork notice on unlock ({{err:VAULT_FORK_DETECTED}}).
- The vault is not settled on disk when the sync client uploads it: lock reports stray sidecar files.

## Entry points
- CLI: {{cli:lock}}, {{cli:unlock}}, {{cli:status}}
- Desktop: {{ipc:vault:lock}}, {{ipc:vault:unlock}}, {{ipc:vault:status}}, {{ipc:sync:status}}

## Steps
1. [User on device A → LockVault] Locks the vault and checks it is a single settled file — {{LockVault}}
2. [Sync client → Device B] Copies the encrypted vault file across (outside Valija)
3. [User on device B → UnlockVault] Unlocks with the passphrase — {{UnlockVault}}
4. [UnlockVault → DeviceIdentity] Reads what this device last saw of the vault — {{FileDeviceIdentity}}
5. [UnlockVault → UnlockVault] Classifies the lineage: in sync, moved forward, or forked — {{classifyLineage}}
6. [UnlockVault → User] Unlocks; on a fork, also shows a notice and points to the setup check
7. [User → VaultStatus] Checks generation and last writer, or looks for conflicted copies — {{VaultStatus}}

## Errors
- {{err:VAULT_FORK_DETECTED}} — two devices wrote independently; nothing was deleted.
- {{err:VAULT_LOCKED}} — a device tried to use the vault before unlocking it.
