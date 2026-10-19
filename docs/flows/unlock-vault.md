---
title: Unlock the vault
theme: Vault lifecycle
---

## Who
The vault owner, with their passphrase or their recovery kit, on a device where the vault lives.

## Why
While the vault is locked, no AI tool can read or save context. Unlocking opens it for this session
so the CLI, the desktop app and every connected AI tool can use it.

## Business rules
- The derived key is kept in the OS keychain for the session, never written to disk.
- The recovery kit's raw key (64 hex characters) works instead of the passphrase.
- If another device wrote to the vault in parallel (a **fork**), the vault still unlocks so the
  user can inspect it, and a notice says so. Nothing is ever deleted or merged automatically.
- An outdated schema is upgraded on unlock; see the upgrade flow.
- Unlocking resets the idle auto-lock clock.

## What can go wrong
- Wrong passphrase or malformed recovery key ({{err:WRONG_PASSPHRASE}}).
- No vault in this folder ({{err:VAULT_NOT_FOUND}}).
- Another device wrote independently ({{err:VAULT_FORK_DETECTED}} is shown as a notice, not a failure).

## Entry points
- CLI: {{cli:unlock}} (passphrase prompt, or `--recovery-key`)
- Desktop: {{ipc:vault:unlock}}

## Steps
1. [User → CLI] Runs `valija unlock` and types the passphrase — {{unlockCommand}}
2. [CLI → UnlockVault] Asks to unlock — {{UnlockVault}}
3. [UnlockVault → VaultStore] Reads the plaintext header (salt and cost parameters) — {{VaultStore}}
4. [UnlockVault → VaultCrypto] Derives the key, or accepts the recovery key as is — {{resolveUnlockKey}}
5. [UnlockVault → VaultStore] Opens the encrypted database, which proves the key is right
6. [UnlockVault → OS keychain] Stores the key for this session — {{OsKeychain}}
7. [UnlockVault → UnlockVault] Compares the vault's lineage with what this device last saw — {{classifyLineage}}
8. [UnlockVault → User] Unlocked, with a fork notice when another device wrote in parallel

## Errors
- {{err:WRONG_PASSPHRASE}} — the passphrase or recovery key does not open the vault.
- {{err:VAULT_NOT_FOUND}} — there is no vault to unlock.
- {{err:VAULT_FORK_DETECTED}} — shown after unlocking; see the multi-device flow.
