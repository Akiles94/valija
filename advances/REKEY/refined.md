# REKEY — Change the passphrase and re-encrypt the vault · Refined Spec

**Status:** Approved at Gate R: Oscar 2026-10-22. Every decision in §9 (D-A … D-P) is resolved at
its recommended default (option 1); D-D: the command is `valija change-passphrase`.
**Directory:** `REKEY`. This is a feature advance with no milestone number.
**Branch:** `feat/rekey-REKEY`. It is stacked on `SDK`, which is stacked on `SECRET-WARN`, then
`PROJECT-DETECT`, then `CURATION`. None of them is merged yet. This advance assumes their behaviour
exactly as their `refined.md` files describe it. It relies most on SDK's newer-schema guard, its
Mode P in-memory keychain, and SDK §15.
**Source:** Oscar's raw idea, "Cambiar contraseña / re-cifrar", checked against the tree on
2026-10-22. SDK §15 flagged this as the main follow-up risk: a passphrase, derived key or recovery
kit that leaks, for example through a third-party SDK integrator, stays valid forever.
**Inherits from:**
- `docs/SPEC.md` §4 (D5, D6, D7), §9
- `docs/vault-format.md` §3–§5 and §11
- `docs/sync.md`
- `advances/SDK/refined.md` §6, §11, §15
- the relocation precedent: `RelocateVault`, `RELOCATION_SOURCE_UNSETTLED`
- the migration ciphertext-backup convention (`src/shared/infra/migrations.ts`)

**Touches (expected):**
- `src/vault/**`: a new use case, a port and adapter for re-encryption, error codes, a domain rule,
  and recognising a rekey backup in folder inspection
- `src/delivery/cli/**`: one new command
- `src/delivery/container.ts`: wiring
- `desktop/src/**`: one IPC channel, a dialog in Settings, and `en`/`es` copy
- `tools/living-docs/**`: one `VALIJA_PARITY` pair
- docs

There is **no** new migration, **no** change to `vault.json`, **no** MCP change and **no** SDK API
change.

---

## 1. Goal

**A user can replace their vault passphrase from the CLI or the desktop app.** The operation
re-encrypts the whole `vault.db` with a new key and shows a new recovery kit once. The old
passphrase and the old recovery kit stop opening the current vault. The operation is crash-safe:
after it, the vault opens with either the old credential or the new one, never with neither.

Five phrases carry the scope:

- **"Re-encrypts."** Today the SQLCipher key *is* `Argon2id(passphrase, salt)` (§3 fact 1), so
  changing the passphrase means changing the database key. Under this design, "change passphrase"
  and "rotate the key" are **one operation**, not two (D-A, D-C).
- **"New recovery kit."** The old kit is the old raw key, so it stops opening the current vault.
- **"The current vault."** Copies that already exist keep their old key. That includes sync-client
  version history, conflicted copies, `*.bak` files, Time Machine and other backups, and any copy an
  attacker already took. Rekey protects what is written **from now on** in **this** file. It does
  not retroactively protect copies made earlier. The product says this plainly (§6).
- **"Never with neither."** A crash, a full disk or a kill at any point leaves a vault that opens with
  the old credential or the new one (D-E).
- **"CLI or desktop."** CLI and desktop have parity. MCP and the SDK get nothing (D-N).

---

## 2. User walkthrough

Lucía keeps her vault in Dropbox (`VALIJA_HOME=~/Dropbox/valija`) and uses it on two devices: a
laptop (A) and a desktop PC (B). Last week she typed her Valija passphrase into "Acme Notes", a
product built on the SDK in Mode P. She no longer trusts that product.

### 2.1 Prepare (the sync ritual, unchanged)

| # | Lucía does | She sees |
|---|---|---|
| 1 | On B: `valija lock`, then waits for Dropbox to show "up to date" | The existing lock output: "single file (vault.db), generation 87 … Safe to let your sync client finish." |

### 2.2 Change the passphrase on A (CLI)

```
$ valija change-passphrase
This re-encrypts your whole vault with a new key.
  - Your current passphrase AND your current recovery kit will stop opening this vault.
  - Copies made before now (sync history, backups, conflicted copies) stay readable with the OLD ones.
This vault is in a synced folder. Lock valija on every other device and let sync finish first.
Other devices are locked and synced? [y/N] y
Current passphrase: ********          (or: valija change-passphrase --recovery-key <hex>)
New passphrase: ********
Repeat new passphrase: ********
Re-encrypting vault (Argon2id ~1s, then the whole file is rewritten)...
Passphrase changed. Vault re-encrypted, generation 88, still unlocked on this device.

================================================================
                    VALIJA RECOVERY KIT
...  (new key, "Key issued: 2026-10-22T…" — D-L)
================================================================
^ THIS IS YOUR NEW RECOVERY KIT — shown ONCE. Your previous kit no longer opens this vault.

On your other devices: run "valija unlock" with the NEW passphrase.
Destroy your old recovery kit. It still opens old copies of this vault.
```

| # | Then | She sees |
|---|---|---|
| 2 | Claude Code on A calls `get_context` | It works with no interruption, because the keychain now holds the new key (D-H). |
| 3 | `valija status` on A | `UNLOCKED`, generation 88, last written by this device. |
| 4 | `valija unlock --recovery-key <OLD hex>` | `error [WRONG_PASSPHRASE]`. |

### 2.3 Desktop (the same capability)

In **Settings → Vault & sync → Change passphrase**, a dialog opens. It works whether the vault is
locked or unlocked, because it always asks for the current credential (D-F). The dialog has:
- an explanation that matches the CLI preamble
- a "use recovery key instead" toggle
- the cloud-folder checkbox (D-M)
- the new passphrase, entered twice

A busy state reads "Re-encrypting…". On success, the existing **recovery-kit screen** shows the new
kit once, with the same one-shot handover `vault:init` uses. Errors use the `en`/`es` copy for each
code.

### 2.4 The other device (B)

| # | Lucía does | She sees |
|---|---|---|
| 5 | On B, after Dropbox syncs: `valija unlock` with the **old** passphrase | `error [WRONG_PASSPHRASE]`. Docs and the CLI hint explain that the passphrase may have been changed on another device (D-O). |
| 6 | `valija unlock` with the **new** passphrase | Unlocked. The lineage is a clean fast-forward to 88. |
| 7 | (Variant) B was still unlocked from before, and an MCP call arrives | `VAULT_LOCKED`. The stale old key is found wrong and dropped (existing behaviour). She unlocks with the new passphrase. |
| 8 | (Variant) B was **not** synced and had written offline | Dropbox keeps one copy and makes a "conflicted copy". The copies hold different keys. See §6. |

### 2.5 The SDK product (Acme, Mode P)

| # | What happens | Result |
|---|---|---|
| 9 | Acme still holds the old key in memory and makes its next call | `VAULT_LOCKED`. The old key no longer opens the file, and the in-memory key is dropped. Acme asks for a passphrase again, and Lucía does not give it one. |
| 10 | Mode K products | They follow the OS keychain. They keep working on A and are locked on B until she unlocks. |

### 2.6 Forgotten passphrase (reset with the kit)

`valija change-passphrase --recovery-key <hex>`, or the desktop toggle, sets a new passphrase
without the old one, and then issues a new kit (D-G).

### 2.7 Where the change is visible and where it is not

| Surface | Effect |
|---|---|
| CLI `change-passphrase`, desktop dialog | The only two places that can rekey. |
| MCP (all five tools) | No tool and no argument. Tools keep working on this device. On other devices they get `VAULT_LOCKED` until unlocked. |
| SDK | No API. Mode P handles get `VAULT_LOCKED` after a rekey. Mode K follows the keychain. |
| `status`, `doctor`, desktop Diagnostics, Sync | A new generation. A leftover rekey backup is flagged as "encrypted with your previous key" (§5.4). |
| `vault.json` | **Byte-identical** (D-B). |
| Context packs, search | Unchanged content. Rekey never touches rows. |
| Network | None. No telemetry. |

---

## 3. Context snapshot (verified facts the planner builds on)

1. **The key hierarchy is flat.** There is no wrapping layer.
   - `CreateVault.forgeVault` sets `key = Argon2id(passphrase, salt, DEFAULT_KDF_PARAMS)`.
   - `resolveUnlockKey` derives the same key with the header's salt and parameters, or uses the
     recovery hex as is.
   - That 32-byte key, as 64 lowercase hex, is used three ways: the SQLCipher raw key
     (`PRAGMA key = "x'…'"` in `openVaultDb`), the value in the OS keychain (`OsKeychain`, service
     `valija`, account = vaultId), and the recovery kit (`renderRecoveryKit`).
   - **Therefore a new passphrase is a new database key, and the old kit is invalidated by
     construction.**
2. **`vault.json` is frozen by contract** (vault-format §3). It has exactly five fields, and
   `schemaVersion` is the literal `1`. The salt is "generated once … never regenerated". The zod
   parser strips unknown keys. `writeVaultHeader` uses a plain `writeFileSync`, which is not atomic.
3. **The database** uses SQLCipher through `better-sqlite3-multiple-ciphers` (SQLite3MultipleCiphers),
   with `cipher='sqlcipher'`, a `DELETE` rollback journal (never WAL), and a busy timeout of 5 s.
   - The file's first 16 bytes are SQLCipher's own salt, which is separate from the Argon2 salt.
   - `openVaultDb` refuses a newer schema before any pragma (SDK guard).
   - **Unverified:** whether SQLite3MultipleCiphers' `PRAGMA rekey` is crash-safe under a `DELETE`
     journal, how much journal and disk space it needs, and whether it regenerates the cipher salt.
     These are spike items (D-E).
4. **The migration convention.** A `backup: true` migration copies `vault.db` to
   `vault.db.pre-NNN.bak`, deletes it on success, and keeps it on failure.
   `FileVaultFolder.STALE_BACKUP_PATTERN` (`\.pre-\d+\.bak$`) does **not** match a name like
   `pre-rekey`. Those backups are ciphertext under the key in force when they were taken.
5. **Sessions** (`SqliteVaultSessions.open`) read the keychain on every call. Nothing is cached
   across calls.
   - A key that fails with `SQLITE_NOTADB` causes `keychain.deleteKey(vaultId)` and then
     `VAULT_LOCKED`.
   - This works the same for the OS keychain (CLI, MCP, desktop, SDK Mode K) and the in-memory one
     (SDK Mode P).
   - **So a stale old key fails closed by itself.**
6. **Lineage.** Only `session.write()` bumps the generation (mutation plus bump in one transaction,
   then `recordSeen`). Fork detection runs only in `UnlockVault`. Device state lives outside the
   vault folder.
7. **Relocation precedent.**
   - `RelocateVault` refuses when the source folder is unsettled (`RELOCATION_SOURCE_UNSETTLED`:
     sidecars, conflicted copies or stale backups).
   - It copies, verifies, and only then deletes. Relocation is desktop-only, a known parity gap.
8. **Desktop.**
   - The recovery kit crosses IPC once, through `vault:readRecoveryKit`, which clears a slot in main.
   - IPC errors carry `code` only.
   - Settings is reachable while the vault is locked.
   - A new channel needs entries in `channels.ts`, a zod schema, a handler, the preload, and
     `ValijaBridge`.
   - Every transition out of "unlocked" calls `resetWorkspaceView()`.
9. **Living docs** (`docs:check`) fail on any of these: a CLI command or IPC channel without a parity
   pair, a new use case or error code not cited by a `docs/flows/*.md`, or an export without TSDoc.
   `error-copy.test.ts` parses the `VaultErrorCode` union text (no `;` or quoted UPPER_CASE words
   inside the doc comments).
10. **No re-key exists today** (SPEC §8, SDK §3 fact 15). SPEC §9 says "losing passphrase + kit =
    unrecoverable". That stays true.

---

## 4. Scope

### In
- A **`ChangePassphrase` capability** (name per D-D). It authenticates with the current passphrase
  or the recovery key, takes a new passphrase, re-encrypts `vault.db` under
  `Argon2id(newPassphrase, existing salt, existing KDF params)`, updates this device's keychain
  entry, and returns the new kit text.
- **CLI:** one command with hidden prompts, `--recovery-key`, the cloud-folder confirmation, and
  `--yes` for the confirmation only (D-M).
- **Desktop:** one IPC channel, a Settings dialog, the reused one-shot kit screen, and `en`/`es` copy.
- **Crash safety and a ciphertext backup** (D-E). Folder preconditions (D-I). Guards: newer schema
  refused, behind schema allowed without migrating (D-J). A lineage bump (D-K).
- **Folder inspection** recognises a leftover rekey backup. `status`, `doctor`, desktop Diagnostics
  and Sync flag it.
- **Recovery kit text:** a "Key issued" line and a sentence saying earlier kits are superseded (D-L).
- **Docs:**
  - a new `docs/flows/change-passphrase.md`
  - a `docs/sync.md` section, "Changing your passphrase on a synced vault"
  - `docs/vault-format.md` §3/§4 notes: the key can change while `vault.json` stays byte-identical,
    and the salt is still never regenerated
  - SPEC §8 and §9, `specs/vault.md`, `docs/sdk.md` (Mode P handles become `VAULT_LOCKED` after a
    rekey), README, CHANGELOG
  - the `VALIJA_PARITY` pair

### Out (deferred or rejected)
- **A key-wrapping layer** (a random data key wrapped by the passphrase). Deferred (D-A).
- **Rotating the key while keeping the same passphrase**, and **changing the KDF parameters**. Both
  need a new salt and a header rewrite, so both are deferred (D-B, D-C).
- **Any MCP tool or SDK method for rekey.** Rejected (D-N).
- **Re-showing the kit later** (a "show my recovery kit again" command). Deferred, because it widens
  exposure (D-L).
- **Re-encrypting or deleting other copies:** sync history, conflicted copies, old `.bak` files,
  external backups. Valija cannot reach most of them and never deletes user files silently. It only
  warns (D-I).
- **Secure erase** of old ciphertext. That is impossible on SSDs and in cloud storage, and the docs
  say so.
- **Coordinating with other devices.** No network. The user follows the ritual.
- **`valija relocate`.** This is the existing known gap, unchanged.

---

## 5. Behaviour contract (observable guarantees, not implementation)

### 5.1 Preconditions, checked in this order. Each refusal changes nothing.
1. A vault exists. Otherwise `VAULT_NOT_FOUND`.
2. The folder is settled (D-I). Otherwise `VAULT_FOLDER_UNSETTLED`, naming the files.
3. The new passphrase passes `parsePassphrase` (`WEAK_PASSPHRASE`). Confirmation matching is
   checked by the surface.
4. The current credential opens the vault (`WRONG_PASSPHRASE`). The vault's lock state does not
   matter (D-F).
5. The schema is not newer (`VAULT_SCHEMA_TOO_NEW`, bytes untouched). A behind schema is allowed and
   not migrated (D-J).
6. The new key differs from the current key (`PASSPHRASE_UNCHANGED`). Keys are compared, not
   passphrases, so this also works when authenticating with the recovery key.
7. In a cloud folder, the user confirmed that other devices are locked and synced (D-M). This is
   enforced by the surface. The use case receives the confirmation as input.
8. *(D-P)* There is enough free disk space for the chosen strategy. Otherwise `STORAGE_ERROR`
   ("not enough disk space"), with nothing changed.

### 5.2 Outcome guarantees
- **Atomic from the user's point of view.** On any failure, `vault.db` opens with the **old**
  credential, its content is intact, and the error says "nothing changed, your current passphrase
  still works" (`REKEY_FAILED`). On success it opens only with the new credential.
- **Crash or kill at any point.** At the next open, exactly one of these holds: the old credential
  opens it, the new credential opens it, or a rekey backup exists that the old credential opens and
  `doctor` explains how to restore it. **Never a vault that nothing opens.** This must be proven by a
  fault-injection test (D-E).
- **`vault.json` is byte-identical**, and vaultId, salt and KDF parameters are unchanged (D-B).
- **Content is identical.** Projects, items, FTS, bindings and meta are the same row for row, apart
  from the lineage rows (D-K). `PRAGMA integrity_check` returns ok.
- **No sidecar remains.** The journal mode is still `DELETE`.
- **The rekey backup** (if any, D-E) is deleted on success and kept on failure, and is recognisable by
  name.

### 5.3 This device afterwards (D-H)
- The OS keychain entry for the vaultId holds the **new** key, and activity is recorded, as with
  unlock.
- **If the keychain write fails after the re-encryption has committed**, the operation reports
  success, says the vault is locked on this device, and tells the user to `unlock` with the new
  passphrase. It never rolls back the re-encryption, and the old key is never left in the keychain.
- **Same-device race.** Another process may read the old key just before commit and fail just after.
  It then drops the keychain entry (existing behaviour), so the vault may end up **locked**. That is
  acceptable because it fails closed. It must never end up with the old key in the keychain.
- **During re-encryption,** other surfaces on this device wait for the lock. Past 5 s they get the
  existing "vault busy" `STORAGE_ERROR`, with nothing lost. Mode P SDK handles fail closed with
  `VAULT_LOCKED` on their next call.

### 5.4 The leftover rekey backup
- `FileVaultFolder` flags it, alongside `.pre-NNN.bak`.
- `doctor`, `status`, desktop Diagnostics and Sync describe it as a "pre-rekey backup, encrypted with
  your **previous** passphrase/key".
- If the current vault opens, the advice is to delete it. If not, the advice is how to restore it.
- Relocation's unsettled rule counts it too.

---

## 6. Multi-device and old copies (honest model)

| Copy | After a rekey on A | What the user must know |
|---|---|---|
| `vault.db` on A | new key | — |
| `vault.db` on B, once synced | new key. B's keychain still holds the old key | Next call gives `VAULT_LOCKED` (stale key dropped). `unlock` with the old passphrase gives `WRONG_PASSPHRASE`. Unlock with the **new** one. |
| B was unsynced and **wrote** offline | Dropbox and similar keep one file and make a conflicted copy, under the **old** key. If B's file "wins", **the rekey is silently undone** for the folder: A's new passphrase then fails and the old one works again | This is why D-M asks for confirmation and D-I refuses to start with an unresolved fork. Detection: unlock with whichever passphrase works and check lineage (fork notice, generation). The fix is to resolve the fork as in sync.md and then rekey again. Docs must spell this out. |
| Conflicted copies, OneDrive `vault-<host>.db`, `*.pre-NNN.bak`, rekey backup | old key | Readable with the old passphrase or kit. Delete them once resolved. Valija never deletes them silently. |
| Sync-client version history, OS backups, any copy an attacker already has | old key, **permanently** | Rekey does not protect them. A user who believes the old secret leaked should also purge cloud version history where the vendor allows it. Valija cannot do that. |
| The SQLCipher file salt (first 16 bytes) | may or may not change (spike) | Has no user-visible effect. Recorded in vault-format §5 once known. |

**Threat model statement for docs:** rekey limits a leaked secret to the copies that existed before
the rekey. It does not undo past exposure.

---

## 7. Error codes and shapes

| Code | New? | Meaning (message never contains key material) |
|---|---|---|
| `PASSPHRASE_UNCHANGED` | new | The new passphrase produces the current key. Nothing changed. |
| `VAULT_FOLDER_UNSETTLED` | new (D-I) | Sidecars, conflicted copies or stale or rekey backups exist. Lists them. Nothing changed. *Option:* reuse and rename `RELOCATION_SOURCE_UNSETTLED` instead. Default: a new neutral code, leaving relocation untouched. |
| `REKEY_FAILED` | new | Re-encryption failed or did not verify. The vault is unchanged and the old credential works. If a backup is kept, it is named. |
| `WRONG_PASSPHRASE`, `WEAK_PASSPHRASE`, `VAULT_NOT_FOUND`, `VAULT_SCHEMA_TOO_NEW`, `STORAGE_ERROR` (busy, disk), `KEYCHAIN_ERROR` | existing | as today |

- **Success output:** `{ vaultId, keyHex (for the kit only), issuedAt, generation, unlockedOnThisDevice }`.
  The desktop maps this to a response **without** `keyHex`. The kit goes through the one-shot slot.
- **Desktop copy:** `en`/`es` (neutral Spanish, no voseo) for each new code. The planner drafts it.

---

## 8. Security surfaces (must not be weakened)

1. **Re-authentication is always required** (D-F). An unlocked, unattended laptop must not let
   someone change the passphrase and lock the owner out.
2. **Secret handling.**
   - The old and new passphrases are used only for derivation.
   - Byte buffers are zeroed on a best-effort basis, as `resolveUnlockKey` does. Strings cannot be
     wiped, and the docs are honest about this.
   - No key, passphrase or kit text goes to logs, errors, IPC error payloads or files.
   - The kit is shown **once**. CLI writes no kit file. Desktop uses the existing one-shot slot.
3. **No moment where nothing opens the vault** (§5.2). The fault-injection test is mandatory.
4. **The keychain never holds a key that does not open the vault after success**, and never holds the
   old key after commit (§5.3).
5. **Mode P isolation (SDK §11.1) is intact.** Rekey writes only the OS keychain of the surface
   performing it (CLI or desktop) and never touches an SDK in-memory adapter.
6. **The newer-schema refusal stays inert:** bytes, header and keychains are unchanged.
7. **The old-key backup's lifetime is minimal:** deleted on success, flagged if left. The docs say
   deletion is not secure erase.
8. **No MCP or SDK exposure.** A model or an integrator can never trigger a rekey, which would amount
   to a lockout or ransom primitive (D-N).
9. **The header contract holds:** `vault.json` is unchanged, and a second implementation (vault-format
   §11) still works. It must simply re-derive the key on every open and never cache it.
10. **No network, no telemetry, no new runtime dependency.**

---

## 9. Decisions (open; defaults recommended)

### D-A. Key hierarchy
1. **Keep it flat. A passphrase change is a full re-encryption.** *(Recommended.)* There is no format
   change, the golden fixture and mobile contract are untouched, and the result is a real rotation
   against a leaked key or kit. *Cost:* the whole file is rewritten, so time and disk usage scale
   with vault size.
2. **Introduce wrapping** (a random data key, wrapped by an Argon2 key, with the wrapped blob in the
   header). A passphrase change becomes a cheap rewrap. *Cost:* the frozen header changes
   (`schemaVersion: 2`), the conformance fixture and vault-format §3–§5 are reworked, and old
   valijas cannot read it. Above all, **a rewrap does not revoke a leaked data key or an old header
   copy**. The leak scenario that motivates this advance would still need a full re-encryption.
   Defer.

### D-B. Salt and KDF parameters
1. **Keep the salt and parameters, so `vault.json` is byte-identical.** *(Recommended.)* Only one
   file changes, which avoids a two-file atomicity problem and the sync skew where `vault.json` and
   `vault.db` arrive on B separately. It honours "salt never regenerated". Reusing a per-vault salt
   with a different passphrase is cryptographically fine. *Cost:* the KDF parameters cannot be
   upgraded, and the same passphrase cannot be kept (D-C).
2. **A new salt, with the header rewritten.** This enables both of those. *Cost:* two files must
   change together, so it needs a crash-recovery marker. While sync propagates, B can briefly hold a
   header and database that do not match, and every passphrase fails with `WRONG_PASSPHRASE`. It is
   also a change to the vault-format contract.

### D-C. "Rotate the key but keep my passphrase"
1. **Not offered. A new passphrase is always required** (`PASSPHRASE_UNCHANGED`). *(Recommended,
   follows from D-B 1.)* A leaked kit with an intact passphrase still means picking a new passphrase.
   This is honest and simple.
2. Offer it. This needs D-B 2.

### D-D. CLI command name
1. **`valija change-passphrase`.** *(Recommended.)* It names the user's intent, and the preamble
   explains the re-encryption.
2. `valija rekey`: precise, but jargon.
3. `valija passwd`: familiar to Unix users, but cryptic for others.

### D-E. Crash-safety strategy
1. **Take a ciphertext backup (`vault.db.pre-rekey.bak`), then re-encrypt in place under an
   exclusive lock, verify, and delete the backup.** *(Recommended, if the spike passes.)* This matches
   the migration convention. Same-device processes fail closed, because their next read with the old
   key fails. *Cost:* disk use of about 2–3× (backup plus journal). During the rewrite, a sync client
   may upload intermediate states, which the ritual and the final upload supersede.
   *Spike, required before planning ends:* kill -9 at several points during an in-place rekey under a
   `DELETE` journal must leave a file that opens with the old or the new key. Also measure the
   journal size and record whether the cipher salt changes.
2. **Copy, rekey the copy, verify, fsync, then atomically rename over `vault.db`.** The sync client
   sees one atomic replacement, and the original is never touched. *Cost:* on POSIX, a process that
   opened the old inode before the rename can **commit writes into the orphaned file, and they are
   silently lost**. That needs the old file "poisoned" before the lock is released. On Windows,
   renaming over an open file fails. This is the fallback if the spike fails option 1.
3. In place, without a backup. Least disk, but no recovery path if the engine is not crash-safe.
   Rejected.

### D-F. Re-authentication
1. **Always require the current passphrase or the recovery key, even when unlocked.** *(Recommended,
   §8.1.)* The operation works on a locked vault too.
2. Allow it from an unlocked session alone. This is more convenient but turns an unattended unlock
   into a lockout.

### D-G. Recovery key as the current credential (resetting a forgotten passphrase)
1. **Allowed.** *(Recommended.)* It is the kit's natural use. Today a forgotten passphrase means
   living on the raw hex forever.
2. Passphrase only.

### D-H. This device's state afterwards
1. **Stay unlocked with the new key** (keychain updated, activity recorded). *(Recommended.)* MCP on
   this device keeps working. Races fail closed (§5.3).
2. Always end locked, so the user unlocks with the new passphrase to prove they remember it. This is
   safer against typos, but the double confirmation already covers that, and it interrupts the
   user's AI tools.

### D-I. Folder preconditions
1. **Refuse when there are sidecars, conflicted copies, `.pre-NNN.bak` files or a rekey backup.**
   Reuse relocation's rule with a neutral `VAULT_FOLDER_UNSETTLED`. *(Recommended.)* An unresolved
   fork plus a rekey leaves the losing copy readable only with the old secret. A lingering backup
   keeps an old-key copy around, which defeats the point.
2. Refuse only on sidecars, and warn about the rest. This is faster in an emergency, but the user
   carries old-key copies forward.

### D-J. Schema version
1. **Refuse a newer schema. Allow a behind schema and never migrate.** *(Recommended.)* Re-encryption
   works at page level, so the two risky operations stay decoupled.
2. Require the current schema, which on CLI means auto-migrating first. That couples two backups and
   two failure modes.

### D-K. Lineage
1. **A rekey counts as a write.** It bumps the generation and records last-seen, so `status` shows
   it and divergent copies classify as a fork. *(Recommended.)* The planner decides whether the bump
   can go in the same transaction as the rekey, or must come immediately before it.
2. No bump. *Cost:* status cannot show that the vault was re-keyed.

### D-L. Recovery kit text
1. **Add a line `Key issued: <ISO time>` and the sentence "This replaces any earlier recovery kit for
   this vault."** Applied to `init`, desktop create and SDK `createVault` as well, since they all
   render the same text. *(Recommended.)* Otherwise two kits look the same apart from 64 hex
   characters. SDK acceptance still holds (kit = `renderRecoveryKit` output).
2. Leave the text unchanged.
3. *(Separate, deferred)* A "show kit again" command. It would render key material on demand, so it
   is not in this advance.

### D-M. Cloud-folder confirmation
1. **When `looksLikeCloud`, require an explicit confirmation** (CLI `[y/N]` or `--yes`; desktop
   checkbox) that other devices are locked and synced. *(Recommended.)*
2. Informational text only.

### D-N. MCP and SDK
1. **Neither gets a rekey. The SDK docs describe the effect on handles.** *(Recommended.)* Rekey is an
   operator task. An integrator would see both passphrases, and a model could lock the user out.
2. An SDK `changePassphrase`. Rejected: it widens SDK §15's risk instead of reducing it.

### D-O. Error experience on other devices
1. **Keep the existing codes** (`VAULT_LOCKED`, `WRONG_PASSPHRASE`). Add one hint line to the CLI
   `WRONG_PASSPHRASE` output, and to the desktop copy, saying the passphrase may have been changed on
   another device, and document it in sync.md. *(Recommended.)* A rekeyed file cannot be told apart
   from a replaced one.
2. A new `VAULT_KEY_CHANGED` code. It cannot be detected reliably, so it would sometimes be wrong.

### D-P. Disk-space pre-flight
1. **Check free space against the strategy's need** (for example 3× the size of `vault.db` under
   D-E 1) and refuse early. *(Recommended.)* Failing midway on a full disk is the worst moment.
2. Rely on the failure-and-rollback path alone.

---

## 10. Architecture notes (DDD and hexagonal; guidance, not a plan)

- **Bounded context `vault`.** The new use case (for example `ChangePassphrase`, a `UseCase`) lives in
  `application/use-cases/`. It composes existing ports (`VaultStore`, `VaultCrypto`, `KeychainPort`,
  `VaultFolder`, `DeviceIdentity`) and one new outbound port for re-encryption (for example
  `VaultRekeyer` in `application/ports/`).
- **The infra adapter is tech-named** (for example `SqliteVaultRekeyer`). It owns the SQLCipher
  mechanics, the backup, verification and the lineage bump. No SQLite code goes in the use case.
- **Domain:**
  - `PASSPHRASE_UNCHANGED`, `VAULT_FOLDER_UNSETTLED`, `REKEY_FAILED` in `VaultErrorCode`, with
    doc comments that obey the `error-copy.test.ts` constraints
  - a pure rule for "folder settled for rekey", in `domain/services/` or `policies/`, shared with
    relocation where it fits
  - reuse of `Passphrase` and `KeyHex`
- **Use cases never call each other.** Rekey does not call `UnlockVault`. It shares
  `resolveUnlockKey` (an application service) for authentication.
- **The rekey goes around `SqliteVaultSessions`, deliberately.** It is a vault-level operation like
  `readLineage`, and it must not trigger the idle guard or `migrate`. The gotcha "a new entry point
  outside `withSession` bypasses the guard" is accepted, because rekey authenticates explicitly.
- **Delivery:**
  - the CLI command, with prompts and the confirmation
  - IPC channel `vault:changePassphrase`, with a zod schema, handler, preload, bridge and the kit slot
  - container wiring
  - the `VALIJA_PARITY` pair `{ cli: "change-passphrase", ipc: ["vault:changePassphrase", "vault:readRecoveryKit"] }`
- **Tests per layer:**
  - domain rules
  - the use case with fakes: every precondition, the keychain failure after commit, and the race
    leaving the vault locked
  - the adapter against a real SQLCipher file: round-trip, content equality, integrity, no sidecar,
    backup lifecycle
  - **fault injection** (child process killed mid-rekey)
  - concurrency (a second connection waiting, then failing busy or failing closed)
  - CLI and IPC handlers, desktop copy parity
- **Golden fixture and conformance test: unchanged.** No migration.

---

## 11. Acceptance criteria

**Core (§2.2, §5.2)**
- [ ] After `change-passphrase` with valid credentials:
  - the new passphrase and the new kit hex open the vault
  - the old passphrase and the old kit hex give `WRONG_PASSPHRASE`
  - every project, item, binding and FTS search result is identical
  - `integrity_check` returns ok
- [ ] `vault.json` bytes are identical before and after.
- [ ] No `-wal`, `-shm` or `-journal` remains. The journal mode is `DELETE`. The rekey backup is
      gone after success.
- [ ] The lineage generation goes up by exactly one, and the writer is this device (D-K).
- [ ] The new kit is printed or shown once, includes `Key issued`, and no kit file is written. On the
      desktop, a second `vault:readRecoveryKit` returns `null`.

**Credentials and guards (§5.1)**
- [ ] It works when the vault is locked and when it is unlocked. Both cases require the current
      credential.
- [ ] `--recovery-key` and the desktop toggle authenticate with the kit hex (D-G).
- [ ] Each of these refuses with **byte-identical** `vault.db` and `vault.json` and an unchanged
      keychain:
  - wrong credential (`WRONG_PASSPHRASE`)
  - weak new passphrase (`WEAK_PASSPHRASE`)
  - same key (`PASSPHRASE_UNCHANGED`)
  - unsettled folder (`VAULT_FOLDER_UNSETTLED`, files listed)
  - newer schema (`VAULT_SCHEMA_TOO_NEW`)
  - insufficient space (D-P)
- [ ] A behind-schema vault is re-keyed and its `schema_version` is unchanged (D-J).
- [ ] A cloud-looking folder without confirmation is refused by the CLI (or `--yes` is required) and
      blocked by the desktop checkbox (D-M).

**Crash safety (§5.2, D-E)**
- [ ] In fault-injection runs that kill the process at each stage boundary (before backup, during
      re-encryption, before verify, before backup deletion), the next open succeeds with the old or
      the new key, or a kept backup opens with the old key. Never with neither.
- [ ] A simulated write failure (disk full, I/O error) gives `REKEY_FAILED`, and the vault still
      opens with the old credential.
- [ ] A leftover rekey backup is flagged by `status`, `doctor`, desktop Diagnostics and Sync with
      "previous key" wording, and is counted by relocation's unsettled check.

**This device and concurrency (§5.3)**
- [ ] After success, the OS keychain holds the new key, and an MCP `get_context` succeeds without
      re-unlocking.
- [ ] If the keychain write fails after commit, the result is success with the vault locked and a
      "unlock with new passphrase" message. The vault opens with the new passphrase.
- [ ] A connection holding a write lock makes the rekey wait and then fail busy, with nothing changed.
      A session open with the old key during or after the rekey fails closed (`VAULT_LOCKED`) and never
      writes anywhere.
- [ ] A Mode P SDK handle opened before the rekey gets `VAULT_LOCKED` on its next call. A recording
      fake OS keychain shows the rekey never touched the SDK's in-memory adapter.
- [ ] The keychain never ends up holding the old key after commit.

**Multi-device (§6)**
- [ ] On a second "device" (separate `VALIJA_STATE_HOME`, old key in its keychain, synced `vault.db`
      copied in), the next session gives `VAULT_LOCKED`, `unlock` with the old passphrase gives
      `WRONG_PASSPHRASE` with the D-O hint, and `unlock` with the new passphrase is a fast-forward
      with no fork.
- [ ] A divergent old-key copy that replaces the new one: the old passphrase opens it, and lineage
      and docs explain the reverted rekey. This is documented and tested at the lineage-classification
      level.

**Surfaces and docs**
- [ ] The CLI command and IPC channel exist with a `VALIJA_PARITY` pair. There is no MCP tool, MCP
      argument or SDK export for rekey. The SDK and MCP public surfaces are unchanged.
- [ ] Desktop `en`/`es` copy exists for the three new codes, and the catalog parity test passes.
      Leaving "unlocked" (the D-H keychain-failure case) calls `resetWorkspaceView()`.
- [ ] The following ship in the same commit:
  - `docs/flows/change-passphrase.md`
  - the `docs/sync.md` section
  - the `docs/vault-format.md` notes, plus the cipher-salt fact from the spike
  - SPEC §8 and §9
  - `specs/vault.md`
  - `docs/sdk.md`
  - README and CHANGELOG
- [ ] `npm run typecheck && npm run lint && npm run test && npm run docs:check` pass at the root, and
      the desktop tests pass. There is no new runtime dependency and no network call.

---

## 12. Deliverables summary (not a plan)

| Deliverable | Layer |
|---|---|
| Three error codes; the folder-settled rule; reuse of the passphrase and key-hex values | vault domain |
| `ChangePassphrase` use case; `VaultRekeyer` port | vault application |
| SQLCipher rekey adapter (backup, verify, lineage bump); recognising a rekey backup in `FileVaultFolder` | vault infra |
| Kit text (`Key issued`, the supersedes sentence) | vault infra (renderer) |
| `change-passphrase` command; WRONG_PASSPHRASE hint; container wiring | delivery |
| `vault:changePassphrase` channel, Settings dialog, kit-screen reuse, `en`/`es` copy, Diagnostics and Sync wording | desktop |
| Parity pair; the flow doc | living docs |
| sync.md, vault-format.md, SPEC, specs, sdk.md, README, CHANGELOG | docs |
| Spike report (D-E): crash safety of in-place rekey, journal size, cipher salt | `advances/REKEY/` (planner) |

---

## 13. Biggest risk

**A rekey that is interrupted or skewed by sync can leave the user unable to open their vault, or
silently reverted.** In-place re-encryption of a large SQLCipher file depends on an engine guarantee
nobody here has verified: whether SQLite3MultipleCiphers' rekey is crash-safe under a `DELETE`
journal. Meanwhile, a sync client uploading mid-rewrite, or an unsynced device "winning" with an
old-key copy, can undo the rotation without any error.

- *Mitigations:* the D-E spike before planning completes; a ciphertext backup kept on failure; a
  mandatory fault-injection test; the D-I and D-M preconditions; a lineage bump; and honest docs.

**Runner-up:** users may believe a rekey makes a leaked secret harmless. It does not cover copies that
already exist, such as sync version history, backups and conflicted copies (§6). The CLI preamble,
the desktop dialog and the docs must say so in plain words.
