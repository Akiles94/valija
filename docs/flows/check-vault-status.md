---
title: Check vault status
theme: Vault lifecycle
---

## Who
The vault owner, wanting to know whether the vault exists, is unlocked, and is safe to sync.

## Why
One glance answers "can my AI tools use the vault right now?" and "is it safe to switch devices?",
without opening or changing any context.

## Business rules
- Status never reads or returns context items.
- A key in the keychain that no longer opens the vault counts as locked.
- Auto-lock state (timeout, idle time, expired) is reported but never acted on here.
- The desktop app reads the sync-safety half separately: conflicted copies, leftover backups,
  whether the folder looks cloud-synced, and where this device keeps its own state.

## What can go wrong
- There is no vault: status reports "not initialized" instead of failing.
- The vault header is unreadable ({{err:STORAGE_ERROR}}).

## Entry points
- CLI: {{cli:status}}
- Desktop: {{ipc:vault:status}} and {{ipc:sync:status}}

## Steps
1. [User → CLI] Runs `valija status` — {{statusCommand}}
2. [CLI → VaultStatus] Asks for the status — {{VaultStatus}}
3. [VaultStatus → VaultFolder] Lists sidecar files, read from disk only — {{FileVaultFolder}}
4. [VaultStatus → OS keychain] Checks whether a key is present for this vault
5. [VaultStatus → VaultStore] Proves the key opens the database and reads the lineage
6. [CLI → User] Prints location, lock and auto-lock state, generation and last writer

## Errors
- {{err:STORAGE_ERROR}} — the vault header could not be read.
