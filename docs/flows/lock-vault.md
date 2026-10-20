---
title: Lock the vault
theme: Vault lifecycle
---

## Who
The vault owner, when they step away or before switching to another device.

## Why
Locking removes the key from the OS keychain, so neither the user's tools nor anything else on the
machine can read the vault until it is unlocked again. It is also the "safe to sync" signal before
opening the vault on another device.

## Business rules
- Locking is always allowed and never loses data.
- The report says whether the vault is a single, settled file on disk. Stray journal files mean it
  is not yet safe for a sync client to upload.
- When it can, the report names the vault's generation and which device wrote last.

## What can go wrong
- There is no vault ({{err:VAULT_NOT_FOUND}}).
- The vault was already locked; the command says so and does nothing else.
- Stray sidecar files are present; the report warns that the vault is not safely at rest.

## Entry points
- CLI: {{cli:lock}}
- Desktop: {{ipc:vault:lock}}

## Steps
1. [User → CLI] Runs `valija lock` — {{lockCommand}}
2. [CLI → LockVault] Asks to lock — {{LockVault}}
3. [LockVault → VaultStore] Reads the lineage while the key is still available (best effort)
4. [LockVault → OS keychain] Deletes the key: the vault is now locked — {{KeychainPort}}
5. [LockVault → VaultFolder] Checks for stray sidecar files next to the database — {{FileVaultFolder}}
6. [CLI → User] Says whether the vault is safely at rest, with generation and last writer

## Errors
- {{err:VAULT_NOT_FOUND}} — there is no vault to lock.
