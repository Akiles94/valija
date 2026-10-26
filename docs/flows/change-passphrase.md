---
title: Change the passphrase
theme: Vault lifecycle
---

## Who
The vault owner who wants a new passphrase: after a suspected leak, as routine hygiene, or after
forgetting the old one (proving ownership with the recovery kit instead).

## Why
To make the old passphrase and the old recovery kit useless for the vault from now on, by
re-encrypting the whole vault under a new key, without exporting or losing anything.

## Business rules
- The current credential is always asked for, even when the vault is unlocked: the current
  passphrase, or the recovery key from the kit (which resets a forgotten passphrase).
- The new key is derived from the new passphrase with the vault's existing salt and parameters, so
  `vault.json` never changes. The new passphrase must derive a different key than the current one.
- Every check happens before anything is written: the vault exists, its folder is settled (no
  sidecar, conflicted copy or leftover backup), the new passphrase is long enough, the current
  credential opens the vault, its schema is not newer than this Valija, the key really changes, and,
  in a cloud-synced folder, the user confirmed every other device is locked and synced. Then free
  disk space is checked (about three times the database size).
- A vault behind the current schema is re-encrypted as it is; it is not upgraded.
- The re-encryption happens in place, under an exclusive lock: a ciphertext backup
  (`vault.db.pre-rekey.bak`) is taken first, the database is re-encrypted, a fresh connection
  verifies it, and only then is the backup deleted. It counts as a write: the generation goes up by
  one, with this device as the writer.
- Crash-safe: a crash at any point leaves a vault the old or the new credential opens, or a backup
  the old one opens — never a vault nothing opens. A failure says nothing changed and the current
  passphrase still works.
- Afterwards, this device holds the new key and stays (or becomes) unlocked, and a new recovery kit
  is shown once. If the OS keychain refuses the new key, the change still succeeds but the vault is
  locked here; the old key is never left in the keychain.
- Old copies of the vault (backups, other devices that have not synced) still open with the old
  passphrase: re-encryption protects the vault from now on, not copies made before now.
- Neither passphrase nor key is ever written to a log, an error, a file or the IPC wire.

## What can go wrong
- No vault yet ({{err:VAULT_NOT_FOUND}}).
- The folder has leftover files, or a cloud folder's other devices were not confirmed as locked and
  synced ({{err:VAULT_FOLDER_UNSETTLED}}); nothing changed.
- The new passphrase is too short ({{err:WEAK_PASSPHRASE}}).
- The current passphrase or recovery key is wrong ({{err:WRONG_PASSPHRASE}}).
- The vault was upgraded by a newer Valija ({{err:VAULT_SCHEMA_TOO_NEW}}).
- The new passphrase is the current one ({{err:PASSPHRASE_UNCHANGED}}).
- Not enough free disk space, or another Valija process held the vault for more than 5 s
  ({{err:STORAGE_ERROR}}); nothing changed.
- Re-encrypting fails or does not verify ({{err:REKEY_FAILED}}); the vault still opens with the
  current passphrase, restored from its backup if needed.

## Entry points
- CLI: {{cli:change-passphrase}} (current passphrase prompt, or `--recovery-key`; `--yes` answers the cloud-folder question)
- Desktop: {{ipc:vault:changePassphrase}}, then {{ipc:vault:readRecoveryKit}} for the new kit, once

## Steps
1. [User → CLI] Runs `valija change-passphrase`, reads what changes, confirms other devices are locked and synced (cloud folder only), types the current and the new passphrase — {{changePassphraseCommand}} (on the desktop, Settings → Vault & sync → Change passphrase asks the same and sends it over the channel)
2. [CLI → ChangePassphrase] Gives the current credential, the new passphrase and the confirmation — {{ChangePassphrase}}
3. [ChangePassphrase → VaultFolder] Refuses an unsettled folder, naming its files — {{refuseUnsettledFolder}}
4. [ChangePassphrase → Argon2id] Derives the current and the new key with the vault's salt — {{resolveUnlockKey}}
5. [ChangePassphrase → VaultStore] Proves the current key and reads the schema, read-only
6. [ChangePassphrase → VaultRekeyer] Checks free space, locks, bumps the lineage, backs up, re-encrypts, verifies, deletes the backup — {{SqliteVaultRekeyer}}
7. [ChangePassphrase → OS keychain] Replaces the old key with the new one, or leaves none
8. [ChangePassphrase → CLI] Returns the new key once; the CLI prints the new recovery kit and never writes it to a file — {{renderRecoveryKit}} (on the desktop, the main process keeps the rendered kit for one read and returns no key; the recovery-kit screen shows it)

## Errors
- {{err:VAULT_NOT_FOUND}} — there is no vault header.
- {{err:VAULT_FOLDER_UNSETTLED}} — the folder is not a single vault at rest, or the sync confirmation is missing.
- {{err:WEAK_PASSPHRASE}} — the new passphrase is too short.
- {{err:WRONG_PASSPHRASE}} — the current credential does not open the vault.
- {{err:VAULT_SCHEMA_TOO_NEW}} — a newer Valija upgraded the vault.
- {{err:PASSPHRASE_UNCHANGED}} — the new passphrase derives the current key.
- {{err:STORAGE_ERROR}} — not enough disk space, or the vault was busy.
- {{err:REKEY_FAILED}} — re-encrypting failed or did not verify; the current passphrase still works.
