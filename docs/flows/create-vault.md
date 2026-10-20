---
title: Create a vault
theme: Vault lifecycle
---

## Who
A developer setting Valija up for the first time on a machine, from the terminal or the desktop app.

## Why
To get an encrypted place for AI context that only their passphrase (or their recovery kit) can
open. Everything else in Valija needs a vault first.

## Business rules
- There is one vault per machine (per vault folder); creating a second one is refused.
- The passphrase must be at least 8 characters. It is never trimmed: spaces count.
- The vault key is derived from the passphrase with Argon2id and a random salt; only the salt and
  the cost parameters are written in plain text, never the key.
- The raw key is shown exactly once, as a printable **recovery kit**. Valija never stores it. Losing
  both the passphrase and the kit means the data is gone; there is no reset.
- A new vault starts **unlocked**, and its idle auto-lock clock starts at once.

## What can go wrong
- A vault already exists in the folder ({{err:VAULT_ALREADY_EXISTS}}).
- The passphrase is too short ({{err:WEAK_PASSPHRASE}}).
- In the terminal, the two passphrase entries do not match; nothing is created.
- The database or header cannot be written ({{err:STORAGE_ERROR}}).

## Entry points
- CLI: {{cli:init}}
- Desktop: {{ipc:vault:init}}, then {{ipc:vault:readRecoveryKit}} to show the kit once

## Steps
1. [User → CLI] Runs `valija init` and types a passphrase twice — {{initCommand}}
2. [CLI → CreateVault] Asks to create the vault — {{CreateVault}}
3. [CreateVault → CreateVault] Rejects a short passphrase — {{parsePassphrase}}
4. [CreateVault → VaultCrypto] Mints a salt and derives the key with Argon2id — {{Argon2VaultCrypto}}
5. [CreateVault → VaultStore] Writes the plaintext header and creates the encrypted database — {{FileVaultStore}}
6. [CreateVault → OS keychain] Stores the key, so the new vault starts unlocked — {{OsKeychain}}
7. [CLI → User] Prints the recovery kit once and suggests connecting an AI tool — {{renderRecoveryKit}}

## Errors
- {{err:VAULT_ALREADY_EXISTS}} — a vault header is already in the folder.
- {{err:WEAK_PASSPHRASE}} — the passphrase is shorter than the minimum.
- {{err:STORAGE_ERROR}} — the vault files could not be created.
