Approved: Oscar 2026-10-22 — all Decisions to confirm (P-1 … P-21) at their recommended defaults (a)

# REKEY — Change the passphrase and re-encrypt the vault · Implementation Plan

**Spec:** `advances/REKEY/refined.md`. Oscar approved it at Gate R on 2026-10-22. Every decision
D-A … D-P is resolved at its recommended default (option 1), and D-D names the command
`valija change-passphrase`. This plan follows those resolutions and does not reopen them. The ones
that shape most of the plan are:
- **D-A 1 / D-B 1 / D-C 1:** the key stays flat. A passphrase change is a full re-encryption under
  `Argon2id(newPassphrase, existing salt, existing KDF params)`. `vault.json` stays byte-identical.
- **D-E 1:** take a ciphertext backup, re-encrypt in place, verify, then delete the backup. This
  holds only **if the Slice 0 spike passes**. §2 Slice 0 defines the fallback (D-E 2) and how the
  plan changes if the spike fails.
- **D-F 1 / D-G 1 / D-H 1:** always re-authenticate, with the passphrase or the recovery key. This
  device stays unlocked with the new key afterwards.
- **D-I 1 / D-M 1 / D-P 1:** refuse an unsettled folder, ask for the cloud confirmation, and check
  free disk space first.
- **D-N 1:** no MCP tool and no SDK method.

**Branch:** `feat/rekey-REKEY`, following `{feature}/{ADVANCE}`. The orchestrator reports that it
already exists and is stacked on `feat/sdk-SDK` → `feat/secret-warning-SECRET-WARN` →
`feat/project-detect-PROJECT-DETECT` → `feat/curation-CURATION`, all on current `origin/main`. The
working tree already holds every SDK change (`src/delivery/sdk/**`, the newer-schema guard,
`InMemoryKeychain`). The planner has not created or switched any branch. If a parent merges to
`main` first, rebase onto `main` before shipping.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** `.claude/hooks/guard-implementation.sh` enforces this mechanically for
> `src/**`, `desktop/**`, `tools/**`, `package.json` and build config. The planner never writes that
> line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Every claim in `refined.md` §3 was re-checked against the working tree, and all of them hold:
- the flat key hierarchy (`CreateVault.forgeVault`, `resolveUnlockKey`, `openVaultDb`'s
  `key="x'…'"`, `OsKeychain` with service `valija` and account = vaultId, `renderRecoveryKit`)
- the frozen five-field `vault.json`, its permissive zod parser, and the non-atomic
  `writeVaultHeader`
- the `DELETE` journal, the 5 s busy timeout, and `openVaultDb` refusing a newer schema before any
  pragma
- the migration backup convention, and the `STALE_BACKUP_PATTERN` that does not match `pre-rekey`
- sessions that read the keychain on every call and drop a key that fails with `SQLITE_NOTADB`
- lineage bumped only inside `session.write()`
- `RelocateVault`'s unsettled refusal
- the desktop's one-shot kit slot, code-only IPC errors, and Settings being reachable while locked
- the living-docs rules
- no rekey anywhere today

The facts below are **not in the spec**. Each one changes how a slice is written. F1–F6 were found
by **reading** the bundled SQLite3MultipleCiphers source
(`node_modules/better-sqlite3-multiple-ciphers/deps/sqlite3/sqlite3.c`, package 12.11.1, around
lines 338303–338340, 338999–339065 and 339285–339544). The spike confirms them empirically.

- **F1. Rekey refuses WAL.** `sqlite3_rekey_v2` returns "Rekeying is not supported in WAL journal
  mode." The vault is always `DELETE` after `openVaultDb`'s `settleJournal`, so this holds, but the
  adapter must open through `openVaultDb`, never through a raw connection.
- **F2. Rekey is one btree write transaction.** It runs `sqlite3BtreeBeginTrans(pBt, 1, 0)`, then
  `sqlite3PagerWrite` on **every** page (skipping only the 1 GiB lock-byte page), then
  `sqlite3BtreeCommit`, and rolls back on any error. Two consequences follow:
  - under `DELETE`, the rollback journal grows to about the size of the whole database (D-P)
  - the commit point is the journal's deletion (or header zeroing), exactly as for any SQLite
    transaction
- **F3. Journal pages are encrypted with the OLD key.** `sqlite3mcCodec` case 7 says: "The
  rollback journal must be written using the original key … always encrypt using the database's
  readkey". So a hot journal left by a kill mid-rekey is rolled back correctly by a connection
  that opens with the **old** key. What happens when a connection opens with the **new** key while
  that journal is hot is not answered by the source. It is a spike item (S7c).
- **F4. The raw-key form is a string.** `PRAGMA rekey` passes its value as a zero-terminated
  string to `sqlite3_rekey_v2`, so `PRAGMA rekey = "x'<64 hex>'"` takes the same raw-key path that
  `PRAGMA key = "x'…'"` takes today.
  - `PRAGMA hexrekey` and better-sqlite3's `db.rekey(Buffer)` pass **32 binary bytes as a
    passphrase**. That likely produces a file the `x'…'` recipe (and vault-format §11) cannot open.
  - The adapter therefore uses **only** `db.pragma(\`rekey="x'${hex}'"\`)`. Spike S2 proves this
    rule, and a source-scan test pins it.
- **F5. A rekey inside an explicit transaction is unsafe or unsupported.** The function begins
  and commits its own btree transaction. Inside a user `BEGIN`, that commit would end the
  caller's transaction under VDBE's feet. So **the lineage bump cannot share the rekey's
  transaction** (D-K: "or must come immediately before it"). Spike S4 confirms what actually
  happens (P-3).
- **F6. In `locking_mode = EXCLUSIVE`, SQLite keeps the rollback journal file and zeroes its
  header** instead of deleting it. This was inferred from SQLite's pager behaviour, not read in this
  tree. Holding the lock across backup → rekey (P-2) can therefore leave `vault.db-journal` on disk
  until the connection closes, or after it. Spike S5 records this, and the adapter's "no sidecar"
  test pins whatever remedy the spike picks.
- **F7. `OsKeychain.setKey` throws on failure, with no catch** (`src/vault/infra/keyring.ts`).
  `getKey` and `deleteKey` swallow errors. So D-H's "keychain write fails after commit" is a
  `try/catch` around `setKey` in the use case.
- **F8. `resolveUnlockKey` already derives with the header's salt and KDF, and zeroes the bytes.**
  The new key is derived by calling it with `{ passphrase: newPassphrase }`, so no second
  derivation helper is needed. The PASSPHRASE_UNCHANGED check compares the two hex keys (§5.1.6).
- **F9. `FileVaultStore.readSchemaVersion` is read-only and maps a wrong key to
  `WRONG_PASSPHRASE`.** It authenticates the current credential (§5.1.4) and reads the schema
  (§5.1.5) in one read-only open: no migration, no journal pragma, nothing written.
- **F10. `VaultFolderInspection` has no notion of a rekey backup.** `FileVaultFolder` adds a
  `rekeyBackups` field (`/\.pre-rekey\.bak$/i`). No existing pattern (sidecar, conflicted copy,
  `.pre-NNN.bak`) matches `vault.db.pre-rekey.bak`.
- **F11. `valija status` does not print folder backups today.** Only `doctor`
  (`diagnostics.ts:checkSyncFolder`) and the desktop Sync screen (`sync:status`) report
  `staleBackups`. Spec §5.4 also wants `status` to flag a rekey backup, so `statusCommand` gains
  one `backup:` line (P-16).
- **F12. `fail(error, remedy?)` already takes a remedy** (`src/delivery/cli/render.ts`). D-O's CLI
  hint is one `remedy` argument in `unlockCommand`, with no new rendering helper.
- **F13. Settings must not import the bridge.** `onboarding-settings.no-session.test.ts`
  asserts it structurally. Its vault actions also mount `Workspace` screens, which exist only
  while unlocked. The dialog must work locked **and** unlocked (D-F), so it cannot live in
  Settings or in `Workspace`. It becomes a third **overlay** above the phase switch, like Settings
  and the tour (`overlay-nav.ts`, P-13).
- **F14. The kit-pending phase routes to `RecoveryKitScreen`, and acknowledging it always lands
  on "unlocked"** (`afterKitAcknowledged()`). When the keychain write fails (D-H), acknowledging
  must land on "locked" instead. The phase gains one optional flag (P-14).
- **F15. `sync:status` already returns `looksLikeCloud`.** The dialog decides whether to show the
  cloud checkbox through the existing channel, with no new channel, and that call opens no
  session.
- **F16. The kit text renderer is positional, `(vaultId, keyHex, createdAt)`, with three callers:**
  - CLI `initCommand`
  - desktop `vault:init`
  - SDK `createVault`

  A fourth optional `issuedAt` parameter that defaults to `createdAt` gives D-L's "Key issued"
  line on every caller with **no change** to the SDK or init call sites. The SDK test compares
  against `renderRecoveryKit(...)` itself, so it still passes.
- **F17. The spec's success output lacks `createdAt`**, which the kit's existing `Created:` line
  needs. The use case returns the header's `createdAt` too (A3).
- **F18. Pinned surface counts break, by design:**
  - `build-program.test.ts`: the root help plus a new `change-passphrase` entry
  - `tools/living-docs/valija/surfaces/surfaces.test.ts`: CLI 21 → 22, IPC 37 → 38
  - `valija-guide.smoke.test.ts`: `ipc:` 37 → 38, `err:` 50 → 53, and `symbol:` 20 → whatever
    the run reports (expected 21)
  - `schema-too-new.dom.test.tsx`'s exhaustive vault-method list gains `changePassphrase`

  Each change is deliberate, in the slice that causes it.
- **F19. Use-case classes have no `UseCase` suffix in this repo** (`UnlockVault`, `CreateVault`,
  `RelocateVault`). CLAUDE.md says `XUseCase`, but the repo convention wins for consistency: the
  class is `ChangePassphrase` in `change-passphrase.use-case.ts` (§7).
- **F20. Fault injection has a precedent.** `src/shared/infra/upgrade-wal.test.ts` writes a CJS
  child script to a temp dir, spawns it with `process.execPath`, and `SIGKILL`s it. There is no
  `tsx`, and Node cannot resolve the repo's `.js` → `.ts` specifiers. A child that runs the **real**
  adapter must therefore be bundled at test time with `tsup`, which is already a devDependency
  (P-9).
- **F21. `docs/guide/**` is generated.** `npm run docs` regenerates it after new flows, symbols
  and codes, and `docs:check` fails while it is stale.

**Spec wrinkles** (none blocking; each is a P-decision):
- **W1.** §5.1.7 says the use case "receives the confirmation as input" but names no code for a
  missing one (P-6).
- **W2.** §5.2 keeps the backup "on failure". But D-I then refuses the next attempt while that
  backup exists, so a clean failure blocks a retry until the user deletes a file (P-7).
- **W3.** §5.3 says "never holds the old key after commit" and also "other surfaces wait for the
  lock". Read strictly, the first requires dropping the old key **before** commit, which turns
  the second into an immediate `VAULT_LOCKED` (P-4).
- **W4.** D-H "stay unlocked" does not say what happens to a vault that was **locked** before the
  change. §5.3 ("holds the new key … as with unlock") implies it ends unlocked (P-5).
- **W5.** "Generation goes up by exactly one" assumes the vault has been written at least once. On
  a never-written vault, `SqliteLineageStore.read()` is `null` and the first bump writes
  generation `0` (A4).

---

## 1. Summary

The plan has nine slices (0–8):

0. **Spike (no production code kept).** In-place rekey under the `DELETE` journal, on realistically
   sized vaults:
   - kill -9 at random points and at stage boundaries
   - opening with the new key while a journal is hot
   - journal size, cipher salt, lock behaviour and disk-full rollback
   - the backup restore path

   Writes only `advances/REKEY/spike.md`. **Go/no-go gate for D-E 1.**
1. **Recognise a rekey backup everywhere.** The three error codes, the folder-settled rule, the
   `rekeyBackups` inspection field, and relocation counting it. `doctor`, `status`, the desktop
   Sync screen and Diagnostics flag it, with `en`/`es` copy.
2. **Recovery kit text (D-L).** The `Key issued` line and the "replaces any earlier kit" sentence.
3. **`VaultRekeyer` port and `SqliteVaultRekeyer` adapter.** Disk pre-flight, exclusive lock,
   lineage bump, backup, rekey, verify, restore, and the fault-injection test.
4. **`ChangePassphrase` use case and container wiring.** Every precondition, the keychain swap,
   and the flow doc.
5. **CLI and the desktop IPC channel.** `valija change-passphrase`, the D-O hint,
   `vault:changePassphrase` (schema, handler, preload, bridge), the parity pair, and pinned
   surfaces.
6. **Desktop UI.** The overlay, the Settings button, `ChangePassphraseScreen`, the kit-screen
   reuse, `en`/`es` copy, DOM tests and `docs/gui.md`.
7. **Cross-surface integration and docs.** MCP after the change, an SDK Mode P handle,
   multi-device, a reverted rekey, sync.md, vault-format, SPEC, sdk.md, README, CHANGELOG and
   `.context/`.
8. **Final gate.**

**Production lines: about 815 in total, range 730–920** (≈ 455 in `src/`, ≈ 355 in
`desktop/src/`, ≈ 4 in `tools/living-docs`).
- Tests add about 1,370 lines, test support about 70, and docs about 380.
- There are zero migrations, new dependencies, MCP tools or arguments, and SDK exports.
- There is one new CLI command, one new IPC channel, and three new error codes.

---

## 2. Ordered slices

**Every slice ends green on both workspaces:**
```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test && npm run docs:check && npm run context:check
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
```
- After a slice adds an export, flow, code or symbol, run `npm run docs` before `docs:check` (F21).
- After a slice touches a file listed in `.context/manifest.yaml`, review the matching `.context/`
  note, then run `npx easy-repo-context stamp` before `context:check`.
- Each slice lists the docs that ship in the same commit.
- Every new export carries real TSDoc (`docs:check`).
- **Every root test that builds a container `vi.mock`s `../vault/infra/keyring.js`**, as the SDK
  advance does, so no test touches the real OS keychain.

---

### Slice 0 — Spike: is in-place `PRAGMA rekey` crash-safe under `DELETE`? (no production code kept)

**Rationale.** Spec §13 names this as the biggest risk. D-E 1 relies on an engine guarantee that
F2/F3 suggest but nobody has observed. No production code depends on D-E until this slice passes.

**Where:** scratch scripts in a throwaway working copy or the scratchpad. Only
`advances/REKEY/spike.md` is committed. The kill harness is a plain CJS script, following the
`upgrade-wal.test.ts` precedent (F20).

**Fixtures (S1).** Each vault is built through `openVaultDb` and `migrate` (schema v4) with a
random 64-hex key. Items are inserted through the real `items` table so the FTS triggers fire.
Three sizes:
- **S** about 20 MB (a heavy real vault)
- **M** about 200 MB (an imported multi-year history)
- **L** about 1.2 GB, which crosses the 1 GiB lock-byte page that F2 skips. Run it once, and
  record that it was skipped if the disk is too small.

For each fixture, record the page count, the file size, and a **content checksum**: the sha256 of
`SELECT * FROM projects, context_items, project_bindings, meta` in a fixed order, plus the FTS
match counts for three terms.

**Steps**

- **S2. Syntax and format.** Open with `key="x'OLD'"`, run `PRAGMA rekey="x'NEW'"`, then close.
  Then check:
  - a fresh connection opens with `key="x'NEW'"`, `integrity_check` is `ok`, and the checksum is
    equal
  - `x'OLD'` gives `SQLITE_NOTADB`
  - the file's first 16 bytes and `PRAGMA cipher_salt`, before and after (**does the cipher salt
    change?** This goes into vault-format §5.)
  - every row of vault-format §5's pragma table, after the rekey. All must be unchanged, so the
    vault-format §11 second implementation keeps working.
  - **The pitfall (F4):** on a copy, `db.rekey(Buffer.from(NEW, "hex"))` and `PRAGMA hexrekey`.
    Record whether `key="x'NEW'"` then opens the copy. The expectation is that it does not.
- **S3. Return shape.** Record what `db.pragma("rekey=…")` returns on success (a row such as
  `"ok"`?), and whether a failure **throws** or returns an error row.
- **S4. Inside a transaction (F5, P-3).** Run `BEGIN IMMEDIATE; UPDATE meta …; PRAGMA rekey=…`
  and record the error or behaviour, then whether `COMMIT` and a re-open still work.
- **S5. Locking (P-2).** Run `locking_mode = EXCLUSIVE`, `BEGIN EXCLUSIVE; COMMIT`, then a copy of
  the file, then the rekey, then close.
  - A worker-thread connection (the `holdWriteLock` pattern in `vault-sessions.test.ts`) tries to
    read during the backup and during the rekey. Record `SQLITE_BUSY` after 5 s.
  - After close, the worker reading with the **old** key gets `SQLITE_NOTADB`.
  - **Record whether `vault.db-journal` exists** after the commit, after close, and after one more
    normal open (F6). Then record which remedy leaves no sidecar: `locking_mode = NORMAL` plus one
    read before close, or a normal open/close.
- **S6. Cost (D-P, P-8).** For S, M and L:
  - the rekey duration
  - the peak `-journal` size, polled from the parent
  - the peak total folder size: db, backup and journal
  - the `integrity_check` duration (P-21)
- **S7. Kill matrix (crash safety, the go/no-go).** The child runs the recipe and prints a marker
  before each step: `LOCKED`, `BUMPED`, `BACKED_UP`, `REKEYING`, `REKEYED`, `VERIFIED`.
  - **S7a, stage boundaries:** kill on each marker (5 boundaries × 3 runs × S and M).
  - **S7b, mid-rekey:** kill after `REKEYING` plus a delay spread uniformly over the measured
    rekey duration (30 runs × S and M, 10 × L).
  - After every kill, the parent classifies the folder:
    - open with OLD: `integrity_check` plus the checksum
    - open with NEW: the same
    - the backup, if present, opened with OLD
  - It tabulates `{old-only, new-only, both, neither}`, and counts integrity or checksum
    failures.
  - **S7c (F3, the dangerous one):** whenever a hot journal exists after the kill, the **first**
    open uses the **NEW** key, which simulates a user typing the new passphrase after a crash.
    Record that it gives `SQLITE_NOTADB`, and that a following OLD-key open then passes
    `integrity_check` with an equal checksum.
- **S8. Restore path (D-E).** After a kill past `REKEYED`, `rename(vault.db.pre-rekey.bak,
  vault.db)`. OLD then opens with `integrity_check` `ok` and the pre-change checksum (apart from
  the lineage rows if P-3 (a)).
- **S9. Write failure.**
  - **(i)** Run the child under `sh -c "ulimit -f <blocks>; exec node …"` so the journal or db
    write hits the size limit. Record the code (`SQLITE_FULL` or `SQLITE_IOERR`), that the rekey
    rolled back, and that OLD opens intact.
  - **(ii)** Pre-create a **directory** named `vault.db-journal`. Record the code. This is the
    portable injection the committed adapter test uses.
- **S10. WAL refusal (F1).** On a WAL-mode copy, the rekey fails with the source's message.
- **S11. Windows (A8).** If a Windows machine is available, `copyFileSync` while S5's exclusive
  lock is held. Otherwise record "not run".

**Pass criteria (all required for D-E 1):**
- zero `neither` and zero integrity or checksum failures across S7a, S7b and S7c
- S7c never corrupts
- S8 restores
- S9 rolls back cleanly
- S2's §5 pragma table is unchanged and the `x'…'` recipe opens the rekeyed file

**Deliverable: `advances/REKEY/spike.md`.** It records:
- the library and SQLite versions
- tables for S2–S9
- the cipher-salt fact
- the chosen lock remedy (S5)
- the measured space factor (S6)
- the verdict, and the recipe

**Decision point (the orchestrator relays it to Oscar):**
- **Pass:** continue with D-E 1 as written. Slice 3 uses the S5 remedy, P-8's factor (or the S6
  measurement if P-8 (b)), and S3's return shape.
- **Fail on any criterion:** **stop.** Report `spike.md` and do not start Slice 1 until Oscar
  confirms the fallback (P-1). The fallback is **D-E 2**, which changes the plan as follows. Every
  other slice is unchanged.
  - **Slice 3's adapter becomes "copy → rekey the copy → fsync → verify → atomically rename over
    `vault.db`".**
    1. Take the exclusive lock on `vault.db` (S5) and bump the lineage in it.
    2. `copyFileSync` to `vault.db.rekey-tmp`.
    3. Open the **copy** with OLD, run the rekey to NEW, close, fsync, and reopen to verify.
    4. **Poison the original before releasing its lock.** Truncate it through the held connection's
       file descriptor, or overwrite its first page, so a process that opened the old inode fails
       with `SQLITE_NOTADB` and fails closed (keychain dropped) instead of committing into an
       orphan.
    5. `renameSync(tmp, vault.db)`, then fsync the directory.
    6. On **Windows**, a rename over an open file fails. The adapter catches `EPERM`/`EBUSY`,
       deletes the tmp file, leaves the original untouched (it is not poisoned until the rename
       is certain, so on Windows the poison step runs **after** the rename), and returns
       `REKEY_FAILED` ("close other Valija windows and try again").
  - **The leftover file is `vault.db.rekey-tmp`.** It holds the **NEW** key, not the old one.
    `FileVaultFolder` recognises it as `rekeyLeftovers`, and the wording becomes "an unfinished
    re-encryption; it is safe to delete". There is no restore path, because the original is never
    modified before the rename.
  - **D-P's factor drops** to about 2× (the copy plus its journal).
  - **The fault-injection test keeps the same matrix.** Kill boundaries become before the copy,
    during the copy's rekey, after verify, and between poison and rename. The invariant is the
    same: OLD or NEW opens `vault.db`, never neither.
  - **About +60 production lines** (poisoning plus the platform branch). The new risks are R4′
    (POSIX orphan writes, mitigated only by poisoning) and R4″ (Windows refusals while any other
    Valija process holds the file).

**Done when:** `spike.md` answers S1–S10 (S11 when possible) with a verdict, and `git status`
shows only `advances/REKEY/spike.md`.

---

### Slice 1 — Recognise a rekey backup everywhere (+ the three error codes and their copy)

**Rationale.** The vocabulary and the "folder settled" rule come first. Every later slice refuses
or reports with them, and the desktop error-copy test reads `src/vault/domain/errors.ts` directly
(SDK F17), so the copy must land in the same commit as the codes.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/domain/errors.ts` | + `PASSPHRASE_UNCHANGED`, `VAULT_FOLDER_UNSETTLED`, `REKEY_FAILED` | +9 |
| `src/vault/domain/services/folder-settlement.ts` | new: `unsettledFiles`, `refuseUnsettledFolder` | ~28 |
| `src/vault/domain/services/vault-relocation.ts` | the unsettled check also counts `rekeyBackups` | +2 |
| `src/vault/application/ports/vault-folder.ts` | + `rekeyBackups` field (doc) | +2 |
| `src/vault/infra/file-vault-folder.ts` | + `REKEY_BACKUP_PATTERN`, `rekeyBackups` | +5 |
| `src/delivery/diagnostics.ts` | `checkSyncFolder` "previous key" problem line (D-I, §5.4) | +12 |
| `src/delivery/cli/vault-commands.ts` | `statusCommand`: one `backup:` line when a rekey backup exists (F11) | +6 |
| `desktop/src/shared/ipc/messages.ts` | `SyncStatusResponse.rekeyBackups` | +2 |
| `desktop/src/main/ipc/handlers/sync-handlers.ts` | pass `rekeyBackups` through | +2 |
| `desktop/src/renderer/screens/sync.tsx` | `rekeyBackupsCount`, a warning line in the banner | +8 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | `errors.*` ×3, `sync.rekeyBackupsFound` (plural) | +9 each |
| `src/vault/domain/services/folder-settlement.test.ts` | new | ~50 (test) |
| `src/vault/infra/file-vault-folder.test.ts` | + `rekeyBackups` cases | +20 (test) |
| `src/vault/domain/services/vault-relocation.test.ts` | + a rekey backup refuses | +12 (test) |
| `src/vault/application/use-cases/relocate-vault.use-case.test.ts`, `vault-status.use-case.test.ts` (fixtures) | + `rekeyBackups: []` in inspection literals | +3 (test) |
| `src/delivery/diagnostics.test.ts` | + sync row wording | +20 (test) |
| `src/delivery/cli/vault-commands.test.ts` | + `statusCommand` prints the `backup:` line (and none without a backup) | +20 (test) |
| `desktop/src/main/ipc/handlers/sync-handlers.test.ts` | + the field | +6 (test) |

**1.1 `errors.ts`.** The doc comments obey `error-copy.test.ts`: no `;` and no double-quoted
UPPER_CASE word.
```ts
  /** The new passphrase derives the key the vault already has, so nothing changed. */
  | "PASSPHRASE_UNCHANGED"
  /**
   * The vault folder has sidecar files, conflicted copies or leftover backups — settle it before
   * re-encrypting (nothing changed).
   */
  | "VAULT_FOLDER_UNSETTLED"
  /** Re-encrypting the vault failed or did not verify — the vault still opens with the current passphrase. */
  | "REKEY_FAILED"
```

**1.2 `domain/services/folder-settlement.ts`** (pure, no I/O, beside `vault-relocation.ts`)
```ts
/** Every file that makes the folder "not a single vault at rest", in one list (D-I). */
export function unsettledFiles(inspection: VaultFolderInspection): string[] {
  return [
    ...inspection.sidecars,
    ...inspection.conflictedCopies,
    ...inspection.staleBackups,
    ...inspection.rekeyBackups,
  ];
}

/** Refuse to re-encrypt an unsettled folder, naming the files; `null` means settled. */
export function refuseUnsettledFolder(inspection: VaultFolderInspection): DomainError | null {
  const files = unsettledFiles(inspection);
  if (files.length === 0) return null;
  return vaultError(
    "VAULT_FOLDER_UNSETTLED",
    `Settle the vault folder first — resolve or remove: ${files.join(", ")}. Nothing was changed.`,
  );
}
```
Relocation keeps its own codes and messages (D-I default). Its conflicted/stale condition only
gains `|| sourceInspection.rekeyBackups.length > 0` (§5.4 "relocation's unsettled rule counts it
too", P-11).

**1.3 `FileVaultFolder`**
```ts
// The ciphertext copy a passphrase change takes before re-encrypting: "vault.db.pre-rekey.bak".
// Deleted on success. A leftover one is still encrypted with the PREVIOUS key (§5.4).
const REKEY_BACKUP_PATTERN = /\.pre-rekey\.bak$/i;
…
rekeyBackups: this.matching(entries, [REKEY_BACKUP_PATTERN]),
```

**1.4 Reporting (§5.4)**
- **`checkSyncFolder`** adds a problem when `rekeyBackups` is non-empty. The row is `ok: false`,
  not fatal:
  > `pre-rekey backup(s) encrypted with your PREVIOUS passphrase/key: <paths> — if "valija unlock"
  > works with your current passphrase, delete it; if it does not, restore it (see docs/sync.md,
  > "Changing your passphrase on a synced vault")`
  - When `status.value.unlocked` is true, the clause shortens to "the vault opens with your
    current key — delete it". So `checkSyncFolder(inspection, status)` gains the status argument.
  - `runDiagnostics` already holds both values.
- **`statusCommand`** prints `backup:   <path> — pre-rekey backup, encrypted with your PREVIOUS
  passphrase/key (see "valija doctor")`, read from `c.folder.inspect().rekeyBackups`. Only the CLI
  line is added. `VaultStatus` and its IPC shape are unchanged (P-16).
- **The desktop Sync banner** shows `sync.rekeyBackupsFound`. Desktop Diagnostics shows the shared
  `detail` text, exactly as it does today for stale backups (A9).

**1.5 Copy (neutral Spanish, no voseo)**

| key | en | es |
|---|---|---|
| `errors.PASSPHRASE_UNCHANGED` | That is your current passphrase. Choose a different one. | Esa es tu frase de contraseña actual. Elige una diferente. |
| `errors.VAULT_FOLDER_UNSETTLED` | Your vault folder has leftover files (a conflicted copy, a backup or an unfinished write). Resolve them first — nothing was changed. | La carpeta de tu bóveda tiene archivos sobrantes (una copia en conflicto, una copia de seguridad o una escritura sin terminar). Resuélvelos primero; no se cambió nada. |
| `errors.REKEY_FAILED` | Re-encrypting the vault failed. Nothing changed: your current passphrase still works. | No se pudo volver a cifrar la bóveda. No cambió nada: tu frase de contraseña actual sigue funcionando. |
| `sync.rekeyBackupsFound` one / other | 1 backup from a passphrase change found — it is encrypted with your previous passphrase / {count} backups from a passphrase change found — they are encrypted with your previous passphrase | Se encontró 1 copia de seguridad de un cambio de frase de contraseña; está cifrada con tu frase de contraseña anterior / Se encontraron {count} copias de seguridad de un cambio de frase de contraseña; están cifradas con tu frase de contraseña anterior |

**1.6 Tests**
- `folder-settlement.test.ts` covers:
  - an empty inspection gives `null`
  - each of the four lists alone refuses with `VAULT_FOLDER_UNSETTLED` and names its absolute path
  - all four together list every file
  - the message never contains a 64-hex run
- `file-vault-folder.test.ts`:
  - `vault.db.pre-rekey.bak` lands in `rekeyBackups` (absolute), and **not** in `staleBackups` or
    `conflictedCopies`
  - `vault.db.pre-003.bak` does not land in `rekeyBackups`
  - the match is case-insensitive
- `vault-relocation.test.ts`: a rekey backup alone gives `RELOCATION_SOURCE_UNSETTLED`.
- `diagnostics.test.ts`:
  - the sync row is `ok: false`, not fatal, says "PREVIOUS", and names the path
  - locked vs unlocked gives the two advice variants
  - `EXPECTED_NAMES` is unchanged
- `vault-commands.test.ts`: `statusCommand` with a `vault.db.pre-rekey.bak` present prints one
  `backup:` line naming it and the word "PREVIOUS". Without one, it prints no `backup:` line.
- `sync-handlers.test.ts`: `rekeyBackups` is passed through.
- `catalogs.test.ts` (en/es parity) and `error-copy.test.ts` pass unmodified.

**Docs in this commit:**
- `specs/vault.md`: the three codes, `folder-settlement.ts`, the `rekeyBackups` inspection field,
  and relocation counting it.
- `specs/delivery.md`: the sync row and the `status` backup line.
- `docs/flows/relocate-vault.md`: "leftover backups" now includes a rekey backup.
- `docs/flows/check-setup.md` and `docs/flows/check-vault-status.md`: one line each.

The three codes need a flow citation for `docs:check`. Slice 1 cites them in
`docs/flows/check-setup.md` ("What can go wrong") **only if** `docs:check` demands it before the
flow exists. Otherwise they wait for Slice 4's flow. The implementer picks whichever keeps
`docs:check` green.

**Done when:** both loops are green, and the existing relocation tests pass with only the
`rekeyBackups: []` fixture additions.

---

### Slice 2 — Recovery kit text (D-L)

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/infra/recovery-kit.ts` | + `issuedAt = createdAt` parameter, the `Key issued:` line, the "replaces" sentence | +5 |
| `src/vault/infra/recovery-kit.test.ts` | + cases | +18 (test) |

```ts
export function renderRecoveryKit(
  vaultId: string,
  keyHex: string,
  createdAt: string,
  issuedAt: string = createdAt,
): string
```
The text:
```
Created:     <createdAt>
Key issued:  <issuedAt>
Vault id:    <vaultId>
…
This replaces any earlier recovery kit for this vault.
Anyone holding this key can read your vault. Guard it like a key.
```

**Tests:**
- the 3-argument call prints `Key issued:  <createdAt>` and the "replaces" sentence
- the 4-argument call prints the given `issuedAt`
- the existing assertions are unchanged

`recovery-kit.dom.test.tsx`, `vault-handlers.hygiene.test.ts` and the SDK
`vault-lifecycle.test.ts` pass **unmodified** (F16).

**Docs in this commit:**
- `docs/flows/create-vault.md`: the kit now shows when its key was issued.
- `specs/vault.md` §infra `recovery-kit.ts`.

**Done when:** both loops are green and `git diff -- src/delivery/sdk` is empty.

---

### Slice 3 — `VaultRekeyer` port and `SqliteVaultRekeyer` adapter (+ fault injection)

**Rationale.** All SQLCipher mechanics live in one tech-named adapter (spec §10). The use case
stays free of SQLite. The adapter owns, in this order:
1. space
2. lock
3. bump
4. backup
5. rekey
6. verify
7. restore or delete

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/application/ports/vault-rekeyer.ts` | new: `RekeyRequest`, `VaultRekeyer` | ~22 |
| `src/vault/infra/sqlite-vault-rekeyer.ts` | new: `SqliteVaultRekeyer`, `RekeyStage`, `REKEY_BACKUP_SUFFIX` | ~150 |
| `src/vault/infra/sqlite-vault-rekeyer.test.ts` | new: round-trip, content, integrity, sidecars, backup lifecycle, space, busy, write failure, restore | ~260 (test) |
| `src/vault/infra/sqlite-vault-rekeyer.fault-injection.test.ts` | new: bundled child, SIGKILL matrix | ~150 (test) |
| `src/testing/rekey-child.ts` | new test support: child entry that runs the real adapter and prints stages | ~35 (test support) |
| `src/testing/vault-content.ts` | new test support: `contentChecksum(db)` (projects, items, bindings, non-lineage meta, FTS counts) | ~35 (test support) |

**3.1 The port (`application/ports/vault-rekeyer.ts`)**
```ts
/** What a re-encryption needs: both keys (hex) and who to record as the writer. */
export interface RekeyRequest {
  currentKeyHex: string;
  newKeyHex: string;
  writer: DeviceId;
}

/**
 * Re-encrypts the whole vault database from one key to another, crash-safe (D-E): afterwards it
 * opens with exactly one of the two keys. Counts as a write — bumps the lineage (D-K). Never
 * touches `vault.json` or any keychain.
 */
export interface VaultRekeyer {
  rekey(request: RekeyRequest): Result<LineageStamp, DomainError>;
}
```

**3.2 The adapter (`infra/sqlite-vault-rekeyer.ts`).** Each line reads as a step:
```ts
/** Where the pre-rekey ciphertext copy lives, next to vault.db (FileVaultFolder recognises it). */
export const REKEY_BACKUP_SUFFIX = ".pre-rekey.bak";

/** Stage markers, in order — observed only by the fault-injection test. */
export type RekeyStage = "locked" | "bumped" | "backed-up" | "rekeying" | "rekeyed" | "verified";

export class SqliteVaultRekeyer implements VaultRekeyer {
  constructor(
    private readonly paths: VaultPaths,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock,
    private readonly onStage: (stage: RekeyStage) => void = () => {},
  ) {}

  rekey(request: RekeyRequest): Result<LineageStamp, DomainError> {
    const room = this.ensureRoom();                         // D-P — refuses before anything is written
    if (!room.ok) return room;
    const db = this.openExclusively(request.currentKeyHex); // busy → STORAGE_ERROR, nothing changed
    if (!db.ok) return db;
    let stamp: LineageStamp;
    try {
      stamp = this.bumpLineage(db.value, request.writer);   // D-K, P-3 (a): own transaction, old key
      this.backUp();                                        // copy + fsync, under the held lock
      this.reencrypt(db.value, request.newKeyHex);          // PRAGMA rekey="x'…'" only (F4)
    } catch (error) {
      db.value.close();
      return this.recoverFrom(error, request.currentKeyHex);
    }
    this.release(db.value);                                 // S5 remedy: no -journal left (F6)
    const verified = this.verify(request.newKeyHex, stamp); // fresh connection, integrity + lineage
    if (!verified.ok) return this.restoreBackup(verified.error);
    rmSync(this.backupPath(), { force: true });
    return ok(stamp);
  }
}
```

The private helpers keep the class at about 150 lines:
- **`ensureRoom()`**:
  - `statfsSync(paths.root)`: `bavail * bsize` must be at least `REKEY_SPACE_FACTOR *
    statSync(db).size` (P-8)
  - otherwise `STORAGE_ERROR` "Not enough free disk space to re-encrypt the vault (needs about N
    MB, M MB free). Nothing was changed."
- **`openExclusively(key)`**:
  - `openVaultDb` (refuses a newer schema, settles the journal), then `pragma("locking_mode =
    EXCLUSIVE")`, then `exec("BEGIN EXCLUSIVE")` and `exec("COMMIT")`, which takes and keeps the
    lock (P-2 (a))
  - `isBusyError` → `STORAGE_ERROR` `REKEY_BUSY_MESSAGE` ("The vault is busy: another valija
    process held it for more than 5 s. Nothing was changed. Try again.")
  - `isWrongKeyError` → `WRONG_PASSPHRASE`. This is defensive: the use case already proved the key
    (F9).
- **`bumpLineage(db, writer)`**: `db.transaction(() => new SqliteLineageStore(db, idGen,
  clock).bump(writer)).immediate()`.
- **`backUp()`**:
  - `copyFileSync(db, backup)`
  - `fsyncSync` on the backup file
  - `onStage("backed-up")`
- **`reencrypt(db, newKey)`**:
  - `onStage("rekeying")`
  - `db.pragma(\`rekey="x'${newKey}'"\`)`, checking S3's return shape (a non-`ok` row throws)
  - `onStage("rekeyed")`
- **`release(db)`**: S5's remedy (for example `locking_mode = NORMAL` plus one read), then
  `db.close()`.
- **`verify(newKey, stamp)`**:
  - `openVaultDb(db, newKey)`
  - `PRAGMA integrity_check` is `"ok"` (P-21)
  - `SqliteLineageStore.read()` equals `stamp.writeStamp`
  - close, then `onStage("verified")`
  - any failure → `err(REKEY_FAILED …)`
- **`recoverFrom(error, oldKey)`**. The rekey threw, so the engine rolled back (F2):
  - if the OLD key opens and `integrity_check` is `ok`, delete the backup (P-7 (a)) and return
    `REKEY_FAILED` "Re-encrypting failed (<sqlite code>). Nothing changed: your current passphrase
    still works."
  - otherwise go to `restoreBackup`
- **`restoreBackup(cause)`**:
  - `renameSync(backup, db)` (atomic on one filesystem), then
    `REKEY_FAILED` "… your previous vault was restored from its backup; your current passphrase
    still works."
  - if the rename fails, return `REKEY_FAILED` naming the backup path and the manual restore step.
    The backup is **kept**.
- **Error messages never interpolate `error.message`.** They use only the SQLite `code`
  (`SQLITE_FULL`, …), so no SQL text and no key-bearing pragma can reach a message.

**3.3 Test support**
- `src/testing/vault-content.ts` → `contentChecksum(dbPath, keyHex)`. It is the sha256 over:
  - every row of `projects`, `context_items` and `project_bindings`, in id order
  - `meta` **minus** the four `lineage_*` keys
  - the `context_items_fts MATCH` counts for a fixed term list

  It gives "content identical row for row" (§5.2) in one equality.
- `src/testing/rekey-child.ts`. The entry that `tsup` bundles into a temp CJS file:
  - it reads `{ root, oldKey, newKey, writer }` from argv
  - it builds `SqliteVaultRekeyer(resolveVaultPaths(root), …, (stage) =>
    process.stdout.write(\`${stage}\n\`))`
  - it calls `rekey`, then prints `DONE <json result>`

  It is bundled once per test file (`tsup.build({ entry, format: "cjs", outDir: tmp, external:
  ["better-sqlite3-multiple-ciphers"] })`) and spawned with `NODE_PATH=<repo>/node_modules` (P-9).

**3.4 Tests: `sqlite-vault-rekeyer.test.ts`** (real SQLCipher, `makeUnlockedVault()` plus a few
saved items, projects and bindings)
1. **Round trip:**
   - NEW opens and OLD gives `SQLITE_NOTADB`
   - `contentChecksum` is equal
   - `integrity_check` is `ok`
   - the returned stamp's generation is the previous one + 1, the writer is the given device, and
     `read()` under NEW equals the stamp
2. **Files:**
   - `vault.json` sha256 is unchanged
   - no `-wal`, `-shm` or `-journal` exists
   - `PRAGMA journal_mode` is `delete`
   - no `vault.db.pre-rekey.bak` exists
3. **Behind schema (D-J):** with the marker set to `LATEST - 1` (`setStoredSchemaVersion`), the
   rekey succeeds and `schemaVersion` is unchanged under NEW.
4. **Space (D-P):** `statfsSync` is stubbed through `vi.spyOn(fs, "statfsSync")` (or an injected
   free-space reader, A11) to report too little:
   - `STORAGE_ERROR` mentioning "disk space"
   - `snapshotVaultFiles` is equal, so the bytes are untouched and there is no backup
5. **Busy:** the `holdWriteLock` worker (copied from `vault-sessions.test.ts`) holds `BEGIN
   IMMEDIATE` for 6.5 s:
   - `STORAGE_ERROR` busy
   - the snapshot is equal
   - OLD still opens
6. **Write failure (S9 ii):**
   - a directory named `vault.db-journal` → `REKEY_FAILED`
   - OLD opens with an equal checksum
   - no backup is left (P-7 (a))
   - the message holds no 64-hex run
7. **Verify failure → restore:** `verify` is forced to fail (spy on `openVaultDb` for the
   new-key call):
   - `REKEY_FAILED` "restored"
   - OLD opens with an equal checksum (bar the lineage)
   - no backup
8. **Restore impossible:** the rename is forced to fail:
   - `REKEY_FAILED` names the backup
   - the backup exists and OLD opens it
9. **Source scan (F4):** `sqlite-vault-rekeyer.ts` contains `rekey="x'` and no `.rekey(`,
   `hexrekey` or `hexkey`.
10. **Newer schema:** `LATEST + 1` → `VAULT_SCHEMA_TOO_NEW` (through `openVaultDb`) and the
    snapshot is equal.

**3.5 Tests: `sqlite-vault-rekeyer.fault-injection.test.ts`** (spec §5.2 "must be proven by a
fault-injection test"; POSIX-only `SIGKILL`, `describe.skipIf(process.platform === "win32")`, A10)
- **Fixture:** a vault of about 5–10 MB (CI-sized; Slice 0 covered the large sizes), its
  `contentChecksum`, OLD and NEW.
- **Boundary kills:** kill on `locked`, `bumped`, `backed-up`, `rekeyed` and `verified` (= "before
  backup deletion"). That covers the spec's "before backup, before verify, before backup deletion".
- **Mid-rekey kills:** kill after `rekeying` plus a delay from {0, 1, 2, 5, 10, 20} ms. That
  covers "during re-encryption".
- **After each kill, the assertions are:**
  1. at least one of `{OLD opens vault.db, NEW opens vault.db, OLD opens the backup}` holds;
  2. **never both** OLD and NEW on `vault.db`;
  3. whichever opens passes `integrity_check` with an equal `contentChecksum`;
  4. if a `-journal` remained, the **first** open attempt uses NEW (S7c) and gives
     `SQLITE_NOTADB`, then the classification above holds.
- **Restore leg:** for the kills past `rekeyed`, rename the backup over `vault.db` → OLD opens with
  an equal checksum.
- **Timeout:** 60 s.

**Docs in this commit:**
- `specs/vault.md`: the `vault-rekeyer.ts` port, and `sqlite-vault-rekeyer.ts` with its step
  order, messages and the F4 rule.
- `docs/vault-format.md` §5: a "Changing the key" note with the cipher-salt fact from the spike,
  "the §5 pragma table is unchanged", and "the raw-key form is `rekey="x'…'"`".

**Done when:**
- both loops are green
- the fault-injection test passes 3 runs in a row locally
- `git diff -- src/shared/infra/migrations src/testing/__fixtures__/golden-vault` is empty

---

### Slice 4 — `ChangePassphrase` use case and container wiring

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/application/use-cases/change-passphrase.use-case.ts` | new: `ChangePassphraseInput`, `ChangePassphraseOutput`, `ChangePassphrase` | ~105 |
| `src/delivery/container.ts` | + `changePassphrase` (and `SqliteVaultRekeyer`) | +5 |
| `src/vault/application/use-cases/change-passphrase.use-case.test.ts` | new: every precondition with fakes, the keychain swap, races | ~240 (test) |
| `src/delivery/container.test.ts` | + `changePassphrase` is wired, `OsKeychain` used (mocked) | +10 (test) |
| `docs/flows/change-passphrase.md` | new flow (entry points completed in Slice 5) | ~60 (docs) |

**4.1 Contracts**
```ts
/** Who the user is (current passphrase or recovery key), the new passphrase, and the sync confirmation. */
export interface ChangePassphraseInput {
  /** The current credential — always required, even when unlocked (D-F); the recovery key resets a forgotten passphrase (D-G). */
  current: UnlockKeyInput;
  newPassphrase: string;
  /** The user confirmed every other device is locked and synced — required when the folder looks cloud-synced (D-M). */
  otherDevicesConfirmed: boolean;
}

/** The re-keyed vault, plus its new raw key — for the recovery kit only, shown once. */
export interface ChangePassphraseOutput {
  vaultId: string;
  keyHex: string;
  createdAt: string;
  issuedAt: string;
  generation: Generation;
  /** false when the OS keychain could not store the new key — the vault is then locked here (D-H). */
  unlockedOnThisDevice: boolean;
}
```

**4.2 `execute`.** It follows spec §5.1's order. **Every refusal before step 8 writes nothing.**
```ts
async execute(input: ChangePassphraseInput): Promise<Result<ChangePassphraseOutput, DomainError>> {
  const header = this.store.readHeader();                                         // 1 VAULT_NOT_FOUND
  if (!header.ok) return header;
  const inspection = this.folder.inspect();
  const unsettled = refuseUnsettledFolder(inspection);                            // 2
  if (unsettled !== null) return err(unsettled);
  const newPassphrase = parsePassphrase(input.newPassphrase);                    // 3 WEAK_PASSPHRASE
  if (!newPassphrase.ok) return newPassphrase;

  const currentKey = await resolveUnlockKey(input.current, header.value, this.crypto);
  if (!currentKey.ok) return currentKey;
  const schema = this.store.readSchemaVersion(currentKey.value);                 // 4 WRONG_PASSPHRASE (read-only, F9)
  if (!schema.ok) return schema;
  if (compareSchema(schema.value, LATEST_SCHEMA_VERSION) === "newer") {           // 5 behind is allowed (D-J)
    return schemaTooNewErr(schema.value, LATEST_SCHEMA_VERSION);
  }

  const newKey = await resolveUnlockKey({ passphrase: newPassphrase.value }, header.value, this.crypto);
  if (!newKey.ok) return newKey;
  if (newKey.value === currentKey.value) return vaultErr("PASSPHRASE_UNCHANGED", UNCHANGED_MESSAGE); // 6
  if (inspection.looksLikeCloud && !input.otherDevicesConfirmed) {               // 7 (P-6)
    return vaultErr("VAULT_FOLDER_UNSETTLED", CONFIRM_SYNC_MESSAGE);
  }

  const vaultId = header.value.vaultId;
  const stamp = this.rekeyer.rekey({                                              // 8 space, then the rekey
    currentKeyHex: currentKey.value,
    newKeyHex: newKey.value,
    writer: this.deviceIdentity.deviceId(),
  });
  if (!stamp.ok) return stamp;

  this.deviceIdentity.recordSeen(vaultId, { generation: stamp.value.generation, writeStamp: stamp.value.writeStamp });
  return ok({
    vaultId,
    keyHex: newKey.value,
    createdAt: header.value.createdAt,
    issuedAt: this.clock.now().toISOString(),
    generation: stamp.value.generation,
    unlockedOnThisDevice: this.storeNewKey(vaultId, newKey.value),
  });
}

/** D-H: the new key replaces the old one; when the keychain refuses, leave no key at all — never the old one (§5.3). */
private storeNewKey(vaultId: string, keyHex: string): boolean {
  try {
    this.keychain.setKey(vaultId, keyHex);
    this.deviceIdentity.recordActivity(vaultId, this.clock.now());
    return true;
  } catch {
    this.keychain.deleteKey(vaultId); // OsKeychain.deleteKey never throws (F7)
    return false;
  }
}
```
- **The constructor** takes 7 ports, in this order: `store`, `crypto`, `keychain`, `folder`,
  `deviceIdentity`, `rekeyer`, `clock`.
- **`UNCHANGED_MESSAGE`** = "The new passphrase opens the vault with the key it already has. Choose
  a different passphrase — nothing was changed."
- **`CONFIRM_SYNC_MESSAGE`** = "This vault is in a synced folder. Lock valija on every other device,
  let sync finish, then confirm — nothing was changed."
- **Neither message ever contains the key**, and neither does `REKEY_FAILED`'s (Slice 3).
- **The use case calls no other use case.** It goes around `SqliteVaultSessions` deliberately (spec
  §10): it never touches the idle guard and never migrates.

**4.3 Container**
```ts
const rekeyer = new SqliteVaultRekeyer(paths, ulidIds, systemClock);
…
changePassphrase: new ChangePassphrase(store, crypto, keychain, folder, deviceIdentity, rekeyer, systemClock),
```
The `Container` interface gains `changePassphrase: ChangePassphrase`. The SDK builds containers
too, but its facade never reads this key (Slice 8 grep).

**4.4 Tests (`change-passphrase.use-case.test.ts`).** They use the real `FileVaultStore`,
`FileVaultFolder`, `Argon2VaultCrypto` with `FAST_KDF` (`makePassphraseVault`), and a
**`FakeVaultRekeyer`** (records its requests, returns a scripted result) for the precondition
cases. They use the real `SqliteVaultRekeyer` for the end-to-end cases.

1. **Locked and unlocked**, both with the passphrase → `ok`:
   - the new passphrase and `output.keyHex` open the vault (via `UnlockVault` in a second
     container); the old passphrase and the old key hex give `WRONG_PASSPHRASE`
   - the keychain holds the new key
   - activity is recorded and last-seen equals the stamp
2. **Recovery key as the credential (D-G)** → `ok`, same assertions.
3. **Every refusal**, each with `snapshotVaultFiles` equal, the keychain unchanged and the
   rekeyer never called:
   - no header → `VAULT_NOT_FOUND`
   - a sidecar, a conflicted copy, a `.pre-003.bak` or a `.pre-rekey.bak` → `VAULT_FOLDER_UNSETTLED`
     listing the files
   - `"short"` → `WEAK_PASSPHRASE`
   - a wrong current passphrase or a malformed recovery hex → `WRONG_PASSPHRASE`
   - `LATEST + 1` → `VAULT_SCHEMA_TOO_NEW`
   - new = current → `PASSPHRASE_UNCHANGED`
   - the recovery key plus a new passphrase that equals the old passphrase → `PASSPHRASE_UNCHANGED`
     (keys are compared, not passphrases)
   - a cloud folder with `otherDevicesConfirmed: false` → `VAULT_FOLDER_UNSETTLED` (P-6)
   - a rekeyer returning `STORAGE_ERROR` disk → passed through, with the keychain unchanged
4. **Order:** a weak new passphrase **and** a wrong current one gives `WEAK_PASSPHRASE` (step 3
   before step 4). An unsettled folder **and** a wrong passphrase gives `VAULT_FOLDER_UNSETTLED`.
5. **Behind schema (D-J):** `ok`, `schemaVersion` is unchanged, and no `.pre-NNN.bak` was ever
   created.
6. **Keychain failure after commit (§5.3):** a `ThrowingSetKeychain`, whose `setKey` throws on the
   **new** key, gives:
   - `ok` with `unlockedOnThisDevice: false`
   - `getKey(vaultId)` is `null`, not the old key
   - the new passphrase unlocks
7. **Same-device race (§5.3):** a second `SqliteVaultSessions` over the same keychain:
   - it reads the old key before the change; after the change its `withSession` gives
     `VAULT_LOCKED` and deletes the entry
   - `getKey` is `null` (fails closed), and the vault still opens with the new passphrase
   - **the keychain never ends up holding the old key:** a recording keychain's last `setKey` for
     the vaultId is the new key, and nothing sets the old key after the rekey
8. **No secret in errors:** every refusal's `message` and `code` holds no 64-hex run and neither
   passphrase.

**Docs in this commit:**
- **`docs/flows/change-passphrase.md`** (theme "Vault lifecycle", all seven sections):
  - Who, Why, Business rules (§5, §6 honestly)
  - What can go wrong, with all codes
  - Entry points: "added with the command in the next slice"
  - Steps citing `{{ChangePassphrase}}`, `{{refuseUnsettledFolder}}`, `{{resolveUnlockKey}}`,
    `{{SqliteVaultRekeyer}}`, `{{renderRecoveryKit}}`
  - Errors
- `specs/vault.md` §use cases.
- `specs/delivery.md` §container.

**Done when:** both loops are green, and `docs:check` reports `ChangePassphrase` and the three
codes cited.

---

### Slice 5 — CLI command and the desktop IPC channel (+ the D-O hint, the parity pair, pinned surfaces)

**Rationale.** The CLI and the IPC channel land together. `docs:check`'s parity rule then never
sees a CLI command without a desktop counterpart.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/cli/change-passphrase-command.ts` | new: `changePassphraseCommand` | ~75 |
| `src/delivery/cli/prompt.ts` | + `promptLine(question)` (visible input, shares the piped reader) | +6 |
| `src/delivery/cli/build-program.ts` | + `change-passphrase` after `status` | +10 |
| `src/delivery/cli/vault-commands.ts` | `unlockCommand`: the `WRONG_PASSPHRASE` remedy (D-O) | +4 |
| `desktop/src/shared/ipc/messages.ts` | + `VaultChangePassphraseRequest`, `VaultChangePassphraseResponse` | +18 |
| `desktop/src/shared/ipc/channels.ts` | + `"vault:changePassphrase"` in `CHANNELS` and `ChannelMap` | +6 |
| `desktop/src/main/ipc/schemas.ts` | + its zod schema | +8 |
| `desktop/src/main/ipc/handlers/vault-handlers.ts` | + the handler; the kit goes to the shared one-shot slot | +20 |
| `desktop/src/preload/index.ts` | + `changePassphrase` (hand-written) | +3 |
| `desktop/src/renderer/state/bridge.ts` | + `ValijaBridge.vault.changePassphrase` | +3 |
| `tools/living-docs/valija/composition/valija-guide.ts` | + the `VALIJA_PARITY` pair (P-15) | +4 |
| `src/delivery/cli/change-passphrase-command.test.ts` | new | ~170 (test) |
| `src/delivery/cli/vault-commands.test.ts` | + the D-O remedy case | +25 (test) |
| `src/delivery/cli/build-program.test.ts` | + root help line and `COMMAND_HELP["change-passphrase"]` (captured, F18) | +14 (test) |
| `desktop/src/main/ipc/handlers/vault-handlers.change-passphrase.test.ts` | new: wire shape, one-shot kit, no key on the wire or on disk | ~110 (test) |
| `desktop/src/main/ipc/schemas.test.ts` | + the channel's schema | +10 (test) |
| `tools/living-docs/valija/surfaces/surfaces.test.ts` | CLI list + `change-passphrase`; IPC 37 → 38 | +3 (test) |
| `tools/living-docs/valija/composition/valija-guide.smoke.test.ts` | `ipc` 38, `err` 53, `symbol` as reported | +3 (test) |
| `tools/living-docs/valija/services/surface-parity.test.ts` | + a channel declared in two pairs (`vault:readRecoveryKit`) pairs both rows | +15 (test) |
| `desktop/src/renderer/screens/__dom-tests__/schema-too-new.dom.test.tsx` | + `changePassphrase` in the exhaustive vault list | +1 (test) |

**5.1 `build-program.ts`**
```ts
program
  .command("change-passphrase")
  .description("Change the passphrase: re-encrypts the vault and shows a new recovery kit.")
  .option("--recovery-key <hex>", "prove it is you with your recovery kit instead of the current passphrase")
  .option("--yes", "confirm other devices are locked and synced (vaults in a cloud folder)")
  .action((options: ChangePassphraseOptions) => changePassphraseCommand(container, options));
```
The container is still read only inside the action, as living-docs requires.

**5.2 `change-passphrase-command.ts`** (spec §2.2, line by line)
```ts
/** `valija change-passphrase` options: authenticate with the kit, and pre-confirm the sync ritual. */
export interface ChangePassphraseOptions { recoveryKey?: string; yes?: boolean }

/**
 * `valija change-passphrase`: explains what changes, asks for the cloud confirmation, the current
 * credential and the new passphrase twice, re-encrypts, then prints the new recovery kit once.
 */
export async function changePassphraseCommand(c: Container, options: ChangePassphraseOptions): Promise<void> {
  printPreamble();
  const confirmed = await confirmOtherDevices(c, options.yes === true);
  const current = options.recoveryKey !== undefined
    ? { recoveryKeyHex: options.recoveryKey }
    : { passphrase: await promptHidden("Current passphrase: ") };
  const newPassphrase = await promptNewPassphrase();       // twice; a mismatch exits 1 before any work
  console.log("Re-encrypting vault (Argon2id ~1s, then the whole file is rewritten)...");
  const result = await c.changePassphrase.execute({ current, newPassphrase, otherDevicesConfirmed: confirmed });
  if (!result.ok) fail(result.error);
  printOutcome(c, result.value);
}
```
Three private helpers:
- **`printPreamble()`** prints spec §2.2's three lines.
- **`confirmOtherDevices(c, yes)`**:
  - when `c.folder.inspect().looksLikeCloud` is false → `true`, with no line printed
  - when cloud and `--yes` → it prints the warning line and returns `true`
  - otherwise it prints the warning, then `promptLine("Other devices are locked and synced? [y/N] ")`
  - anything but `y`/`yes` (case-insensitive) → `"Nothing changed."` and exit 1, **before** any
    credential prompt
- **`printOutcome(c, v)`**:
  - when unlocked: "Passphrase changed. Vault re-encrypted, generation N, still unlocked on this
    device."
  - otherwise: "Passphrase changed. Vault re-encrypted, generation N. It is now LOCKED on this
    device: the OS keychain did not accept the new key. Run \"valija unlock\" with your NEW
    passphrase."
  - then `renderRecoveryKit(v.vaultId, v.keyHex, v.createdAt, v.issuedAt)`
  - then the "THIS IS YOUR NEW RECOVERY KIT — shown ONCE. Your previous kit no longer opens this
    vault." line
  - then the two "other devices" and "destroy your old kit" lines from §2.2

`--yes` confirms **only** the sync question. Credentials are always prompted (D-M). No file is
written.

**5.3 D-O hint (`unlockCommand`)**
```ts
if (!result.ok) fail(result.error, result.error.code === "WRONG_PASSPHRASE" ? CHANGED_ELSEWHERE_HINT : undefined);
// CHANGED_ELSEWHERE_HINT = '(If you changed your passphrase on another device, use the new one — run "valija unlock" again.)'
```

**5.4 IPC (`messages.ts`)**
```ts
/** Current credential (passphrase or recovery key), the new passphrase, and the cloud-folder confirmation (D-M). */
export interface VaultChangePassphraseRequest {
  current: { passphrase?: string; recoveryKeyHex?: string };
  newPassphrase: string;
  otherDevicesConfirmed: boolean;
}
/**
 * Deliberately no `keyHex` — like `VaultInitResponse`, the new kit crosses once, as rendered text,
 * through `vault:readRecoveryKit` (§7).
 */
export interface VaultChangePassphraseResponse {
  vaultId: string;
  issuedAt: string;
  generation: number;
  unlockedOnThisDevice: boolean;
}
```
- **Schema:** `z.object({ current: z.object({ passphrase: z.string().optional(), recoveryKeyHex:
  z.string().optional() }), newPassphrase: z.string(), otherDevicesConfirmed: z.boolean() })`.
- **`ChannelMap` doc:** "Re-encrypts the vault under a new passphrase and keeps the new recovery
  kit pending for one read."

**5.5 Handler (`vault-handlers.ts`).** It shares the `pendingKitText` closure with `vault:init`, so
it is the same one-shot slot:
```ts
"vault:changePassphrase": async (req: VaultChangePassphraseRequest) => {
  const result = await getContainer().changePassphrase.execute(req);
  if (result.ok) pendingKitText = renderRecoveryKit(result.value.vaultId, result.value.keyHex, result.value.createdAt, result.value.issuedAt);
  return toIpcResult(result, (v): VaultChangePassphraseResponse => ({
    vaultId: v.vaultId, issuedAt: v.issuedAt, generation: v.generation, unlockedOnThisDevice: v.unlockedOnThisDevice,
  }));
},
```

**5.6 The parity pair**
```ts
{
  pair: { cli: "change-passphrase", ipc: ["vault:changePassphrase", "vault:readRecoveryKit"] },
  reason: "the CLI prints the new recovery kit; the desktop app reads it once over IPC",
},
```

**5.7 Tests**
- **`change-passphrase-command.test.ts`.** It uses `vi.mock("./prompt.js")` with a queued-answers
  fake, a `process.exit` spy (the `curation-commands.test.ts` harness), a real container over a
  temp `VALIJA_HOME` and `VALIJA_STATE_HOME`, and `keyring.js` mocked with `RecordingKeychain`.
  1. happy path, local folder → no confirmation prompt; stdout has "Passphrase changed",
     "generation", "VALIJA RECOVERY KIT", "Key issued", "This replaces any earlier recovery kit"
     and the "previous kit no longer opens" line; the new passphrase unlocks
  2. cloud folder (`VALIJA_HOME` under a `Dropbox` path segment):
     - `n` → exit 1, "Nothing changed.", no credential prompt was asked, snapshot equal
     - `y` → proceeds
     - `--yes` → no `promptLine` call
  3. `--recovery-key <hex>` → no "Current passphrase:" prompt
  4. new-passphrase mismatch → exit 1 before `execute` (spy), snapshot equal
  5. a wrong current passphrase → `error [WRONG_PASSPHRASE]`, exit 1
  6. **keychain failure:** the `RecordingKeychain` variant throws on `setKey` → the "LOCKED on this
     device … with your NEW passphrase" line, exit 0
  7. **no kit file:** after the run, no file under the temp roots matches `/[0-9a-f]{64}/` (the
     hygiene pattern)
- **`vault-commands.test.ts`:** a wrong passphrase → stderr contains the D-O hint.
- **`build-program.test.ts`:** the new root-help row and the captured `change-passphrase --help`
  text. Capture it from a real run, as the file's header says (F18).
- **`vault-handlers.change-passphrase.test.ts`** (the `vault-handlers.hygiene.test.ts` pattern,
  with a real `ChangePassphrase` over a temp vault):
  - `ok` → the response keys are **exactly** `vaultId`, `issuedAt`, `generation` and
    `unlockedOnThisDevice`, and `JSON.stringify(response)` holds no 64-hex run
  - the first `vault:readRecoveryKit` holds the new key and "Key issued"; the second is `null`
  - a failure → `{ ok: false, error: { code } }` only, and nothing is left in the slot
  - no file written under the roots contains a 64-hex run
- **Surfaces and parity:** the pinned lists and counts, and a channel listed in two pairs yields
  two rows with no orphan finding.

**Docs in this commit:**
- `docs/flows/change-passphrase.md`: entry points `{{cli:change-passphrase}}`,
  `{{ipc:vault:changePassphrase}}` then `{{ipc:vault:readRecoveryKit}}`, and the CLI and desktop
  steps.
- `docs/flows/unlock-vault.md`: "What can go wrong" gets the D-O line.
- `specs/delivery.md`: the command, `promptLine` and the hint.
- `specs/desktop.md`: the channel, its messages, and the shared kit slot.
- `docs/SPEC.md` §8: `valija change-passphrase [--recovery-key <hex>] [--yes]` plus one
  paragraph.

**Done when:**
- both loops are green
- `docs:check` shows a parity row `valija change-passphrase ↔ vault:changePassphrase,
  vault:readRecoveryKit`
- `git diff -- src/delivery/mcp src/delivery/sdk` is empty

---

### Slice 6 — Desktop UI: overlay, Settings button, dialog, kit reuse

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/renderer/state/overlay-nav.ts` | `Overlay` + `"change-passphrase"`; + `openChangePassphrase()` | +6 |
| `desktop/src/renderer/state/session-state.ts` | `kit-pending` + `lockedAfterKit?`; + `afterPassphraseChanged`; `afterKitAcknowledged(lockedAfterKit = false)` | +14 |
| `desktop/src/renderer/screens/change-passphrase.tsx` | new: `ChangePassphraseScreen` | ~130 |
| `desktop/src/renderer/screens/settings.tsx` | + `onOpenChangePassphrase`; a button in both Vault & sync branches; updated header comment | +8 |
| `desktop/src/renderer/app.tsx` | overlay branch, `passphraseChanged`, kit-pending acknowledgement with the flag | +22 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + `changePassphrase.*` (15 keys), `settings.changePassphrase`, the D-O hint in `errors.WRONG_PASSPHRASE` | +19 each |
| `desktop/src/renderer/styles/screens.css` | + `.screen.change-passphrase` (tokens only) | +10 |
| `desktop/src/renderer/screens/__dom-tests__/change-passphrase.dom.test.tsx` | new | ~190 (test) |
| `desktop/src/renderer/state/session-state.test.ts` | + `afterPassphraseChanged` / acknowledgement cases | +25 (test) |
| `desktop/src/renderer/state/overlay-nav.test.ts` | + `openChangePassphrase`; the auto-tour never interrupts it | +12 (test) |
| `desktop/src/renderer/app.shell.test.ts` | + structural: the overlay branch, `resetWorkspaceView()` in `passphraseChanged` | +12 (test) |
| `desktop/src/renderer/screens/onboarding-settings.no-session.test.ts` | unchanged; it must still pass (Settings stays bridge-free) | 0 |

**6.1 State**
```ts
| { phase: "kit-pending"; lockedAfterKit?: true }

/** The passphrase changed: show the new kit first; afterwards unlocked, or locked if the keychain refused the new key (D-H). */
export function afterPassphraseChanged(unlockedOnThisDevice: boolean): SessionState {
  return unlockedOnThisDevice ? { phase: "kit-pending" } : { phase: "kit-pending", lockedAfterKit: true };
}

/** Phase once the user confirmed they saved the recovery kit. */
export function afterKitAcknowledged(lockedAfterKit = false): SessionState {
  return lockedAfterKit ? { phase: "locked" } : { phase: "unlocked" };
}
```
- `canNavigateAwayFrom` is unchanged: kit-pending still blocks everything.
- The `Router`'s kit-pending case calls `afterKitAcknowledged(state.lockedAfterKit === true)`.

**6.2 `app.tsx`**
```tsx
) : overlayState.overlay === "change-passphrase" && canNavigateAwayFrom(state) ? (
  <ChangePassphraseScreen
    bridge={lockAwareBridge}
    onCancel={() => setOverlayState(openSettings())}
    onChanged={passphraseChanged}
  />
) : …

// Leaving "unlocked" for the kit screen: same C2 reset as every other session exit (gotcha).
function passphraseChanged(unlockedOnThisDevice: boolean) {
  setOverlayState(closeOverlay());
  setWorkspaceView(resetWorkspaceView());
  setState(afterPassphraseChanged(unlockedOnThisDevice));
}
```
Settings receives `onOpenChangePassphrase={() => setOverlayState(openChangePassphrase())}`.

**6.3 `screens/change-passphrase.tsx`**
- **On mount:** one `bridge.sync.status()` call reads `looksLikeCloud` (F15). It opens no session.
- **The fields:**
  - the explanation (`changePassphrase.explainer`, `oldCopies`)
  - a "use my recovery key instead" toggle that swaps "Current passphrase" for "Recovery key"
  - the new passphrase twice, validated with the existing `validateNewPassphrase` (`tooShort`,
    `mismatch`)
  - when cloud, the checkbox `changePassphrase.confirmOtherDevices`
- **Submit** is disabled until all of these hold:
  - the credential is non-empty
  - `validateNewPassphrase(...) === null`
  - the checkbox is ticked, when cloud
- **Busy state:** `changePassphrase.working` ("Re-encrypting…"). Every input is disabled while it
  is busy.
- **The call:** `bridge.vault.changePassphrase({ current, newPassphrase, otherDevicesConfirmed })`.
  - `ok` → `onChanged(value.unlockedOnThisDevice)`. The Router then shows `RecoveryKitScreen`,
    which reads the slot once.
  - an error → `errorCopy(code)` inline, and the screen stays.
- **On every exit path, the component clears its own password state** (`useState("")` setters
  after submit or cancel).
- **No `data-theme`:** it inherits the shell theme.
- **It never calls** `unlock`, `init`, `lock`, `relocation.*`, `content.*` or `import.*`.

**6.4 Settings.** The Vault & sync panel shows **"Change passphrase…"** in **both** branches,
locked and unlocked (D-F works locked). The header comment's "nothing here can … re-key" is
updated to: "Change passphrase only opens its own overlay — Settings itself still calls no IPC".

**6.5 Copy (neutral Spanish, no voseo)**

| key | en | es |
|---|---|---|
| `settings.changePassphrase` | Change passphrase… | Cambiar frase de contraseña… |
| `changePassphrase.title` | Change your passphrase | Cambia tu frase de contraseña |
| `changePassphrase.explainer` | This re-encrypts your whole vault with a new key. Your current passphrase and your current recovery kit will stop opening this vault. | Esto vuelve a cifrar toda tu bóveda con una clave nueva. Tu frase de contraseña actual y tu kit de recuperación actual dejarán de abrir esta bóveda. |
| `changePassphrase.oldCopies` | Copies made before now (sync history, backups, conflicted copies) stay readable with the old passphrase and kit. | Las copias hechas antes de ahora (historial de sincronización, copias de seguridad, copias en conflicto) se pueden seguir leyendo con la frase de contraseña y el kit anteriores. |
| `changePassphrase.currentLabel` | Current passphrase | Frase de contraseña actual |
| `changePassphrase.useRecoveryKey` | I only have my recovery key | Solo tengo mi clave de recuperación |
| `changePassphrase.recoveryKeyLabel` | Recovery key | Clave de recuperación |
| `changePassphrase.newLabel` | New passphrase | Nueva frase de contraseña |
| `changePassphrase.confirmLabel` | Repeat new passphrase | Repite la nueva frase de contraseña |
| `changePassphrase.cloudWarning` | This vault is in a synced folder. Lock Valija on every other device and let sync finish first. | Esta bóveda está en una carpeta sincronizada. Primero bloquea Valija en todos tus otros dispositivos y espera a que termine la sincronización. |
| `changePassphrase.confirmOtherDevices` | My other devices are locked and synced | Mis otros dispositivos están bloqueados y sincronizados |
| `changePassphrase.submit` | Change passphrase | Cambiar frase de contraseña |
| `changePassphrase.working` | Re-encrypting… | Volviendo a cifrar… |
| `changePassphrase.otherDevicesAfter` | Afterwards, unlock your other devices with the NEW passphrase and destroy your old recovery kit. | Después, desbloquea tus otros dispositivos con la NUEVA frase de contraseña y destruye tu kit de recuperación anterior. |
| `changePassphrase.tooShort` / `mismatch` | Passphrases must be at least 8 characters. / Those passphrases don't match. | Las frases de contraseña deben tener al menos 8 caracteres. / Esas frases de contraseña no coinciden. |
| `errors.WRONG_PASSPHRASE` (changed, D-O) | That passphrase doesn't match this vault. If you changed it on another device, use the new one. | Esa frase de contraseña no coincide con esta bóveda. Si la cambiaste en otro dispositivo, usa la nueva. |

**6.6 Tests**
- **`change-passphrase.dom.test.tsx`** (jsdom, a fake bridge as in `recovery-kit.dom.test.tsx`):
  1. **en and es:** the title, the explainer and the old-copies sentence render
  2. **local folder** → no checkbox; **cloud** → a checkbox, and Submit is disabled until it is
     ticked
  3. a mismatch or a short new passphrase → inline copy, Submit disabled, `changePassphrase` never
     called
  4. **recovery-key toggle** → the request carries `current.recoveryKeyHex`, not `passphrase`
  5. **busy** → "Re-encrypting…" shows and the inputs are disabled
  6. `ok({ unlockedOnThisDevice: false })` → `onChanged(false)` is called once
  7. `{ code: "PASSPHRASE_UNCHANGED" }` → its copy shows inline, and `onChanged` is not called
  8. **never modifies anything else:** every fake except `vault.changePassphrase` and
     `sync.status` has 0 calls
  9. it never renders a 64-hex run
- **`session-state.test.ts`:**
  - `afterPassphraseChanged(true)` → `{ phase: "kit-pending" }`
  - `afterPassphraseChanged(false)` → `lockedAfterKit: true`
  - `afterKitAcknowledged(true)` → `locked`; `afterKitAcknowledged()` → `unlocked`, unchanged for
    init
- **`overlay-nav.test.ts`:**
  - `openChangePassphrase()`
  - `autoTourOverlay` returns `current` while it is open
- **`app.shell.test.ts`:** `app.tsx` holds the `"change-passphrase"` overlay branch, and
  `passphraseChanged` calls `resetWorkspaceView()` before `setState` (the gotcha).
- `catalogs.test.ts`, `error-copy.test.ts`, `onboarding-settings.no-session.test.ts` and
  `no-network-surface.test.ts` all pass unmodified.

**Docs in this commit:**
- `docs/gui.md`: "Settings → Vault & sync → Change passphrase", covering both lock states, the
  toggle, the checkbox, the kit screen, and the D-H locked case.
- `specs/desktop.md`: the overlay, `afterPassphraseChanged`, and `lockedAfterKit`.

**Done when:** both loops are green and the desktop builds.

---

### Slice 7 — Cross-surface integration and the remaining docs

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/change-passphrase.surfaces.test.ts` | new: MCP after the change, an SDK Mode P handle, the recording keychain | ~140 (test) |
| `src/delivery/change-passphrase.multi-device.test.ts` | new: a second device, a reverted rekey | ~150 (test) |
| docs | listed below | ~250 (docs) |
| `.context/gotchas.md`, `.context/flows/change-passphrase.md` (new), `AGENTS.md` (one flow line) | agent notes (P-20) | ~45 (docs) |

**7.1 `change-passphrase.surfaces.test.ts`** (`keyring.js` mocked with `RecordingKeychain`)
1. **MCP works right after the change (§2.2 #2):**
   - unlock, then `changePassphrase` through `buildContainer({ vaultRoot })`
   - `buildMcpServer(container)` `get_context` (the `server.test.ts` client pattern) succeeds with
     no re-unlock
   - `RecordingKeychain.store` holds the new key
2. **A Mode P SDK handle (§2.5, §8.5):**
   - `openVault({ vaultRoot, passphrase })` (Mode P)
   - `RecordingKeychain.clearRecord()`, then the change through the CLI-style container
   - the handle's `search` → `{ code: "VAULT_LOCKED" }`
   - the recording shows the change's `setKey` only, under the vaultId, from the OS-keychain fake
   - the SDK's `InMemoryKeychain` is a separate object that the change never received (assert
     through `vi.spyOn(InMemoryKeychain.prototype, "setKey")`: zero calls after the change)
3. **No SDK or MCP surface:**
   - `Object.keys(await import("./sdk/index.js"))` has no `changePassphrase` and no `rekey`
   - `surfaces.test.ts` still lists the five tools (Slice 8 grep)
4. **A session open with the old key during the change** (the `holdWriteLock`-style worker opens
   with the old key once the stage is `rekeying`):
   - it waits, then fails with `STORAGE_ERROR` busy or `SQLITE_NOTADB` → `VAULT_LOCKED`
   - `contentChecksum` is unchanged afterwards (it never wrote)

**7.2 `change-passphrase.multi-device.test.ts`** (the `multi-device-sync.test.ts` pattern: two
`VALIJA_STATE_HOME`s, one vault folder copied between them)
1. **B with the old key in its keychain:**
   - copy A's re-keyed `vault.db`
   - B's next `withSession` → `VAULT_LOCKED`, and B's keychain is emptied
   - `unlockCommand` with the old passphrase → `error [WRONG_PASSPHRASE]` with the D-O hint
   - `UnlockVault` with the new passphrase → `ok`, `fork` undefined (a fast-forward to the bumped
     generation)
2. **Reverted rekey (§6):**
   - B wrote offline under the old key (generation g+1 from g)
   - B's file replaces A's
   - the old passphrase opens it, and A's new passphrase gives `WRONG_PASSPHRASE`
   - A unlocking with the old passphrase → `classifyLineage` gives **fork**: A's last-seen is the
     rekey's stamp at g+1, and B's file has a different stamp at g+1
   - this proves "lineage explains the reverted rekey"

**7.3 Docs in this commit**
- **`docs/sync.md`**, a new section "Changing your passphrase on a synced vault":
  - the ritual (lock B, sync, change on A, unlock B with the new passphrase)
  - what B sees (`VAULT_LOCKED`, then `WRONG_PASSPHRASE` with the old passphrase)
  - the reverted-rekey scenario and its fix (resolve the fork, change again)
  - old copies stay readable with the old secret, including vendor version history (purge it
    where possible)
  - the rekey backup and how to restore it
  - "deleting is not secure erase"
  - the threat-model sentence (§6)
- **`docs/vault-format.md`:**
  - §3: the key can change while `vault.json` stays byte-identical
  - §4: "the salt is still never regenerated; a passphrase change re-derives with the same salt
    and parameters"
  - §5: the Slice 3 note
  - §11: "a reader must re-derive on every open and never cache a key"
- **`docs/SPEC.md`:**
  - §8 (Slice 5)
  - §9 adds: "Changing the passphrase re-encrypts `vault.db` and invalidates the old kit for the
    current file only — earlier copies keep the old key. Losing passphrase + recovery kit =
    unrecoverable" (unchanged)
- **`specs/vault.md`:** a final pass.
- **`docs/sdk.md`:** "After a passphrase change, a Mode P handle gets `VAULT_LOCKED` on its next
  call; Mode K follows the OS keychain. The SDK cannot change a passphrase (by design)."
- **`README.md`:** a "Change your passphrase" line under the CLI section.
- **`CHANGELOG.md`** `Unreleased › Added`: `valija change-passphrase` and the desktop Settings
  "Change passphrase", the recovery kit "Key issued" line, and the rekey-backup reporting.
- **`.context/gotchas.md`** "vault / storage" gains one bullet:
  > Passphrase change re-encrypts in place via `SqliteVaultRekeyer` (raw-key `PRAGMA
  > rekey="x'…'"` only — never `db.rekey()`/`hexrekey`, F4), deliberately outside
  > `withSession`; it bumps lineage itself; a leftover `vault.db.pre-rekey.bak` is old-key
  > ciphertext and makes the folder unsettled.
- **`.context/flows/change-passphrase.md`**, plus its line in `AGENTS.md`.
- `npx easy-repo-context stamp`.

**Done when:** both loops are green, and `npm run docs`, `npm run docs:check` and
`npm run context:check` are clean.

---

### Slice 8 — Final gate (no file changes)

1. Run both full loops, plus `npm run docs:check && npm run context:check`.
2. `git diff --exit-code feat/sdk-SDK...HEAD -- src/shared/infra/migrations
   src/testing/__fixtures__/golden-vault src/delivery/mcp src/delivery/sdk package.json
   package-lock.json desktop/package.json` is **empty**: no migration, no fixture change, no MCP or
   SDK change, no dependency.
3. `grep -rnE "\.rekey\(|hexrekey|hexkey" src --include=*.ts --exclude=*.test.ts` returns nothing
   (F4).
4. `grep -rn "changePassphrase\|rekey" src/delivery/mcp src/delivery/sdk --exclude=*.test.ts`
   returns nothing (D-N).
5. `grep -rnE "console\.|writeFileSync" src/vault/infra/sqlite-vault-rekeyer.ts
   src/vault/application/use-cases/change-passphrase.use-case.ts` returns nothing: no logging and
   no kit file.
6. `grep -n "error.message\|\.message}" src/vault/infra/sqlite-vault-rekeyer.ts` returns nothing
   (messages carry codes only).
7. `grep -nE "unlock\(|init\(|lock\(|relocation\.|content\.|import\." desktop/src/renderer/screens/change-passphrase.tsx`
   returns nothing.
8. `server.test.ts` still reports 5 tools and 2 prompts, and `surfaces.test.ts` 22 CLI commands
   and 38 channels.
9. Walk spec §11 line by line against §4.2, then hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

1. **Every refusal happens before any write** (`ChangePassphrase.execute`):
   1. header
   2. folder settled
   3. new passphrase parsed
   4. current key resolved, then proven by a **read-only** probe (F9)
   5. schema not newer
   6. new key derived and compared
   7. cloud confirmation

   Only then does the rekeyer run, and its first step is the **space** check. Each of these is
   pinned by a `snapshotVaultFiles` equality.
2. **Inside the rekeyer, strictly in this order:**
   1. free space
   2. `openVaultDb` with the **old** key (refuses newer, settles the journal)
   3. take and **hold** the exclusive lock
   4. lineage bump (its own transaction, old key)
   5. backup copy, then **fsync**
   6. `PRAGMA rekey="x'NEW'"`
   7. release (no sidecar)
   8. verify with a **fresh** connection and the new key (`integrity_check` plus the lineage stamp)
   9. only then **delete the backup**

   A backup always exists from step 5 until verification has proven the new file. The engine's
   journal (F3) covers step 6.
3. **The new key never leaves the process before the commit is verified.** The keychain write,
   the returned `keyHex`, the CLI kit and the desktop slot all come after `rekey` returns `ok`.
   - A crash before the commit leaves the OLD credential working (the hot journal rolls back under
     the old key, F3).
   - A crash after the commit leaves the NEW **passphrase** working (the user typed it twice),
     plus an old-key backup.
   - S7c / Slice 3 test 4 prove that opening with the new key while the journal is hot cannot
     corrupt.
4. **Keychain swap (P-4 (a)):** after commit, `setKey(new)`, then `recordActivity`, then
   `recordSeen` (recorded right after the rekey). If `setKey` throws, `deleteKey` runs, so the
   vault is **locked** and the old key is never left. A concurrent process holding the old key
   fails with `SQLITE_NOTADB`, which deletes the entry: it fails closed.
5. **Re-authentication is unconditional (D-F).** The use case never reads the keychain to
   authenticate. An unlocked session grants nothing.
6. **Secrets:**
   - both passphrases are used only by `resolveUnlockKey`, which zeroes the derived bytes
   - neither the passphrases nor any key goes to logs, errors, IPC error payloads or files
   - rekeyer messages carry SQLite codes, never `error.message`
   - the desktop response has no `keyHex`, and the kit crosses once through the existing slot
   - the CLI writes no kit file
   - the renderer clears its password state on exit
   - strings cannot be wiped, and the docs say so
7. **Mode P isolation (§8.5):** the change writes only the OS keychain of the surface that runs it
   (CLI or desktop). It never receives the SDK's `InMemoryKeychain` (Slice 7 test 2).
8. **No MCP or SDK exposure (D-N):** no tool, argument or export (Slice 8 greps 2 and 4).
9. **The newer-schema refusal stays inert:** the read-only probe refuses before any open that
   could write. The rekeyer's `openVaultDb` refuses again before any pragma (defence in depth).
10. **The desktop leaves "unlocked" safely:**
    - `passphraseChanged` closes the overlay, then `resetWorkspaceView()`, then kit-pending
    - kit-pending blocks every route until acknowledged
    - it lands on locked when the keychain refused the new key
11. **The header contract:** `vault.json` is never opened for writing on this path. Byte equality
    is asserted in the Slice 3, 4 and 5 tests.

---

## 4. Test plan

### 4.1 By layer

| Layer | Files | Proves |
|---|---|---|
| Vault domain | `folder-settlement.test.ts`, `vault-relocation.test.ts` | the D-I rule and its file list; relocation counts a rekey backup |
| Vault infra | `file-vault-folder.test.ts`, `recovery-kit.test.ts`, `sqlite-vault-rekeyer.test.ts`, `sqlite-vault-rekeyer.fault-injection.test.ts` | backup recognised; kit text; round trip, content, integrity, sidecars, backup lifecycle, space, busy, write failure, restore, F4 rule; **kill -9 matrix** |
| Vault application | `change-passphrase.use-case.test.ts` | every §5.1 precondition, in order, inert; D-G; D-J; keychain failure; same-device race; no secret in errors |
| Delivery | `change-passphrase-command.test.ts`, `vault-commands.test.ts`, `build-program.test.ts`, `diagnostics.test.ts`, `container.test.ts` | prompts, confirmation, `--yes`, `--recovery-key`, outcome lines, no kit file; D-O hint; `status` backup line; help pinned; doctor flagging; wiring |
| Cross-surface | `change-passphrase.surfaces.test.ts`, `change-passphrase.multi-device.test.ts` | MCP after the change; Mode P → `VAULT_LOCKED`; isolation; old-key session fails closed; second device; reverted rekey → fork |
| Desktop main | `vault-handlers.change-passphrase.test.ts`, `schemas.test.ts`, `sync-handlers.test.ts` | wire shape without a key; one-shot kit; code-only errors; disk hygiene |
| Desktop state | `session-state.test.ts`, `overlay-nav.test.ts` | kit-pending then unlocked or locked; overlay |
| Desktop DOM / structure | `change-passphrase.dom.test.tsx`, `app.shell.test.ts`, `schema-too-new.dom.test.tsx`, `catalogs`, `error-copy`, `onboarding-settings.no-session` | en/es copy, checkbox gate, toggle, busy, errors, never modifies anything else; `resetWorkspaceView`; Settings stays bridge-free |
| Living docs | `surfaces.test.ts`, `valija-guide.smoke.test.ts`, `surface-parity.test.ts` | the new command and channel, counts, the double-listed kit channel |

### 4.2 Acceptance criteria (spec §11) → where each is checked

| §11 criterion | Checked by |
|---|---|
| New passphrase and new kit open; old ones give `WRONG_PASSPHRASE`; content identical; `integrity_check` ok | `change-passphrase.use-case.test` 1–2, `sqlite-vault-rekeyer.test` 1 (`contentChecksum`) |
| `vault.json` byte-identical | `sqlite-vault-rekeyer.test` 2, use case 1 |
| No `-wal`/`-shm`/`-journal`; mode `DELETE`; backup gone | `sqlite-vault-rekeyer.test` 2 |
| Generation +1, writer = this device | `sqlite-vault-rekeyer.test` 1, use case 1 (last-seen) |
| Kit once, `Key issued`, no kit file; desktop second read `null` | `recovery-kit.test`, `change-passphrase-command.test` 1 and 7, `vault-handlers.change-passphrase.test` |
| Works locked and unlocked, always with a credential | use case 1 (both states); dialog test (works from both Settings branches) |
| `--recovery-key` and the desktop toggle (D-G) | use case 2, command test 3, DOM test 4 |
| Six refusals with bytes, header and keychain unchanged | use case 3 (+ `sqlite-vault-rekeyer.test` 4 for space) |
| Behind schema re-keyed, `schema_version` unchanged (D-J) | `sqlite-vault-rekeyer.test` 3, use case 5 |
| Cloud folder: CLI refuses without `y`/`--yes`; desktop checkbox blocks | command test 2, DOM test 2, use case 3 (P-6 backstop) |
| Kill at each stage boundary and mid-rekey → old or new opens, or the backup opens with old; never neither | `sqlite-vault-rekeyer.fault-injection.test` + Slice 0 S7 |
| Simulated write failure → `REKEY_FAILED`; old credential opens | `sqlite-vault-rekeyer.test` 6 |
| Leftover backup flagged by status, doctor, Diagnostics, Sync; counted by relocation | `vault-commands.test` (status line, Slice 1), `diagnostics.test`, `file-vault-folder.test`, `vault-relocation.test`, `sync-handlers.test` |
| Keychain holds the new key; MCP `get_context` works without re-unlock | `change-passphrase.surfaces.test` 1 |
| Keychain write fails after commit → success, locked, message; new passphrase opens | use case 6, command test 6, session-state + DOM test 6 |
| A write lock makes the rekey wait then fail busy, nothing changed; an old-key session fails closed and never writes | `sqlite-vault-rekeyer.test` 5, `change-passphrase.surfaces.test` 4, use case 7 |
| Mode P handle → `VAULT_LOCKED`; the recording keychain shows the SDK adapter untouched | `change-passphrase.surfaces.test` 2 |
| Keychain never holds the old key after commit | use case 6–7 |
| Second device: `VAULT_LOCKED`, old passphrase → `WRONG_PASSPHRASE` + hint, new → fast-forward | `change-passphrase.multi-device.test` 1 |
| Divergent old-key copy replaces the new one → lineage classifies the fork; docs explain | `change-passphrase.multi-device.test` 2 + `docs/sync.md` |
| CLI and IPC with a parity pair; no MCP or SDK surface | `surfaces.test`, `docs:check` parity row, surfaces test 3, Slice 8 greps |
| en/es copy for the three codes; catalog parity; `resetWorkspaceView()` on leaving unlocked | Slice 1 copy + `catalogs`/`error-copy`; `app.shell.test` |
| Docs in the same commit | per-slice docs + review |
| Loops green; no new dependency, no network | every slice; Slice 8 step 2; `no-network-surface.test` |

### 4.3 Surface parity

| Capability | CLI | Desktop | MCP | SDK |
|---|---|---|---|---|
| Change the passphrase (current passphrase) | `valija change-passphrase` | Settings → Change passphrase | — (D-N) | — (D-N) |
| …with the recovery key (D-G) | `--recovery-key <hex>` | "I only have my recovery key" toggle | — | — |
| Cloud-folder confirmation (D-M) | `[y/N]` or `--yes` | checkbox | — | — |
| New kit shown once | printed | kit screen via `vault:readRecoveryKit` | — | — |
| Keychain refused the new key | "LOCKED on this device" line | kit, then the Locked screen | — | — |
| Leftover rekey backup flagged | `status` line, `doctor` sync row | Sync banner, Diagnostics row | — | — |
| After a change elsewhere | `unlock` hint (D-O) | `WRONG_PASSPHRASE` copy with hint | `VAULT_LOCKED` (existing) | Mode P `VAULT_LOCKED` |

### 4.4 Verification loop

```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test && npm run docs && npm run docs:check && npm run context:check
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
cd /home/user/valija && npx vitest run src/vault                          # Slices 1–4
cd /home/user/valija && npx vitest run src/vault/infra/sqlite-vault-rekeyer.fault-injection.test.ts   # Slice 3, run 3×
cd /home/user/valija && npx vitest run src/delivery tools/living-docs     # Slices 5, 7
cd /home/user/valija/desktop && npx vitest run src/renderer src/main/ipc  # Slices 5–6
```

---

## 5. Assumptions (each one a place the plan could be wrong)

- **A1. The spike's results transfer to CI.** Slice 0 runs on the developer's Linux machine.
  macOS uses the same SQLite pager code. Windows is covered only by A8.
- **A2. `statfsSync` (Node ≥ 18.15) reports usable free space** on the vault filesystem, including
  cloud-synced folders and network mounts. Where it throws, the pre-flight is skipped and the
  rekey relies on rollback (D-P 2 behaviour), with the skip noted in the result message.
- **A3. The output carries `createdAt`** (F17). The spec's output list is "the shape plus what the
  kit needs".
- **A4. "Generation +1" is asserted only on a vault written at least once** (W5). A never-written
  vault goes from no stamp to generation `0`, which `UnlockVault` already treats as a fast-forward.
- **A5. A rekey on a behind-schema vault leaves `schema_version` unchanged.** `openVaultDb`'s
  `settleJournal` is not a migration. On a pre-0.3.0 WAL vault it folds the WAL first, which is the
  existing behaviour of every open.
- **A6. Bumping the lineage under the old key before the backup is acceptable** on a later
  `REKEY_FAILED` (P-3 (a)). Content is unchanged, and other devices see a fast-forward. §5.2 says
  "content identical apart from the lineage rows".
- **A7. `copyFileSync` produces a consistent backup** while this connection holds the SQLite
  exclusive lock. No other connection can write, and on POSIX the advisory locks do not block the
  copy's read.
- **A8. On Windows, `copyFileSync` of a file another handle has open with a byte-range lock
  succeeds** for vaults under 1 GiB. SQLite locks only the lock-byte region at the 1 GiB offset.
  This is untested unless S11 runs. If it fails, the error surfaces as `REKEY_FAILED` with nothing
  changed.
- **A9. Desktop Diagnostics shows the shared English `detail` for the sync row**, exactly as it
  does today for stale backups. The Sync banner is the localized surface.
- **A10. The fault-injection test is POSIX-only** (`SIGKILL`). CI on Windows skips it. The spike
  plus the Linux and macOS CI runs carry the proof.
- **A11. `vi.spyOn(fs, "statfsSync")` works on the ESM `node:fs` namespace in vitest.** If it does
  not, `SqliteVaultRekeyer` takes an optional `freeBytes` reader as a 5th constructor parameter,
  with a default that uses `statfsSync`, mirroring `onStage`.
- **A12. Bundling the adapter with `tsup` inside a test takes 2 s or less** and needs no new
  dependency. `tsup` is already a devDependency, and `docs:check` uses it the same way.
- **A13. Comparing keys with `===` is acceptable.** Both keys belong to the caller, and there is
  no remote timing oracle.
- **A14. Docs per slice satisfy "same commit".** The version stays `0.3.0`, and the CHANGELOG entry
  goes under `Unreleased`.
- **A15. A crash after the commit but before the kit is shown leaves the user with the new
  passphrase but no new kit.** Since `PASSPHRASE_UNCHANGED` refuses the same passphrase, getting a
  fresh kit means choosing yet another passphrase. `docs/sync.md` documents this; it is rare and
  fails safe.

---

## 6. Decisions to confirm

Each decision has a recommended default **(a)**, listed first.

**P-1. What happens if the Slice 0 spike fails.**
- **(a) Recommended:** stop after Slice 0, report `spike.md`, and switch to the D-E 2 fallback
  described in Slice 0 only after Oscar confirms it.
- (b) Switch to D-E 2 automatically and continue.

*Trade-off:* (a) costs a round-trip. But D-E 2 brings its own risks: POSIX orphan writes that
only poisoning prevents, and Windows refusing the rename while any other Valija process holds the
file. Oscar should accept those knowingly. (b) is faster, but ships a strategy nobody approved.

**P-2. Holding the lock across backup and rekey.**
- **(a) Recommended:** `locking_mode = EXCLUSIVE` plus `BEGIN EXCLUSIVE; COMMIT` right after
  opening. The lock is held through bump → backup → rekey and released before verify. A journal
  that remains (F6) is removed by S5's remedy.
- (b) No held lock. Copy, then rekey, in two quick steps.

*Trade-off:* with (a), no other process can commit between the backup and the rekey, so a
restored backup never loses a write. It costs an S5-verified release step. With (b) the code is
simpler, but a concurrent MCP save in that window (milliseconds) would be missing from a restored
backup. It would still be present in the re-keyed vault.

**P-3. Where the lineage bump goes (D-K).**
- **(a) Recommended:** its own `IMMEDIATE` transaction under the old key, after the lock and
  before the backup.
- (b) After the rekey, under the new key, before the lock is released.
- (c) In the same transaction as the rekey. Only possible if S4 shows the engine supports it, and
  F5 suggests it does not.

*Trade-off:*
- (a) means a backup and a crash after the commit both carry the bump. A later `REKEY_FAILED`
  leaves one harmless extra generation (A6).
- (b) leaves a re-keyed vault with no bump if the process crashes between the two, which weakens
  fork detection exactly in the scenario of §6.
- (c) is ideal, but the source reading argues against it.

**P-4. The keychain swap on this device (W3).**
- **(a) Recommended:** keep the old key in the keychain during the rekey, so other surfaces wait or
  get busy as §5.3 describes. After the commit, `setKey(new)`. If that throws, `deleteKey`, so the
  vault ends locked.
- (b) Delete the old key **before** the rekey. Restore it on `REKEY_FAILED` if the vault was
  unlocked, and set the new key after the commit.

*Trade-off:*
- With (a), MCP and desktop on this device keep working and do not see a spurious "locked" during
  a short re-encryption. The old key sits in the keychain for the milliseconds between the commit
  and `setKey`. A crash in that window leaves a stale key that the next session drops through
  `SQLITE_NOTADB`, so it fails closed.
- (b) meets §8.4's "never holds the old key after commit" mechanically. But every concurrent call
  gets `VAULT_LOCKED` ("ask the user to unlock") during the change, and the desktop's lock routing
  would bounce to the Locked screen under the dialog.

**P-5. A vault that was locked before the change (W4).**
- **(a) Recommended:** it ends **unlocked**, with the new key in the keychain and activity
  recorded, the same as when it was unlocked (§5.3 "as with unlock"). The CLI says "still unlocked"
  or "now unlocked".
- (b) It stays locked if it was locked.

*Trade-off:* (a) is one rule, matches §2.3/§5.3 literally, and the user has just authenticated.
(b) respects a deliberate "lock", but needs the use case to read the keychain first and adds a
second outcome to every surface.

**P-6. What the use case does without the cloud confirmation (W1).**
- **(a) Recommended:** refuse with `VAULT_FOLDER_UNSETTLED` and the message "Lock valija on every
  other device, let sync finish, then confirm — nothing was changed." This is a backstop: both
  surfaces block before calling.
- (b) Add a fourth code, `SYNC_CONFIRMATION_REQUIRED`.
- (c) No check in the use case. The surfaces only.

*Trade-off:* (a) keeps the spec's three codes and defends against a future caller. Its desktop
copy talks about leftover files, but the desktop can never reach this case. (b) is more precise,
but deviates from §7 and needs copy and flow updates. (c) contradicts "the use case receives the
confirmation as input".

**P-7. The backup after a clean failure (W2).**
- **(a) Recommended:** when the rekey fails and the vault then **verifiably** opens with the old
  key (`integrity_check` ok), delete the backup. Keep it only when that check fails, or when a
  restore was needed and failed.
- (b) Always keep it on failure (the spec's literal "kept on failure").

*Trade-off:* (a) avoids leaving an old-key copy that §8.7 wants short-lived, and lets the user
simply retry. Under (b), D-I would refuse the retry until they delete the file by hand. (b) keeps
a belt-and-braces copy that the verified vault makes redundant.

**P-8. The disk-space factor (D-P).**
- **(a) Recommended:** a constant `REKEY_SPACE_FACTOR = 3` (× `vault.db` size), the spec's
  example, covering the backup, the journal and slack.
- (b) Use the spike's measured peak (about 2×) × 1.2.

*Trade-off:* (a) is conservative and simple to explain. On a 200 MB vault it needs 600 MB free,
and it may refuse when about 450 MB would have been enough. (b) is tighter and data-driven, but
the factor then depends on one machine's measurements.

**P-9. The fault-injection harness (F20).**
- **(a) Recommended:**
  - bundle the **real** adapter with `tsup` into a temp CJS file per test run
  - spawn it with `NODE_PATH`
  - the adapter takes an optional `onStage` observer (default no-op), which only the test passes
- (b) A plain-JS child that replicates the pragma recipe (the `upgrade-wal.test.ts` style).

*Trade-off:* (a) tests the code that ships, step order included. It costs one optional
constructor parameter and about 2 s of bundling. (b) needs no seam, but tests a copy of the recipe
that can silently drift from the adapter.

**P-10. How the leftover rekey backup appears in the folder inspection.**
- **(a) Recommended:** a separate `rekeyBackups: string[]` field.
- (b) Fold it into `staleBackups`.

*Trade-off:* (a) lets every surface say "encrypted with your **previous** key", which §5.4 asks
for. It costs one field and a few fixture updates. (b) has zero churn, but its wording ("a prior
upgrade did not finish") would be wrong.

**P-11. Sharing the folder-settled rule with relocation.**
- **(a) Recommended:** a new pure `domain/services/folder-settlement.ts` (`unsettledFiles`,
  `refuseUnsettledFolder` → `VAULT_FOLDER_UNSETTLED`) used by `ChangePassphrase`. Relocation keeps
  its codes and only counts `rekeyBackups`.
- (b) Relocation also switches to `refuseUnsettledFolder` and its code to `VAULT_FOLDER_UNSETTLED`.

*Trade-off:* (a) follows D-I's default ("relocation untouched") with one condition added. (b)
removes a near-duplicate rule, but changes a shipped desktop error code and its copy and tests.

**P-12. Where the CLI command lives.**
- **(a) Recommended:** a new `src/delivery/cli/change-passphrase-command.ts`, following the
  `import-command.ts` precedent.
- (b) Inside `vault-commands.ts`.

*Trade-off:* (a) keeps `vault-commands.ts` at about 130 lines, with each file about one command
family. (b) groups every vault-lifecycle verb in one file of about 210 lines.

**P-13. Where the desktop dialog lives (F13).**
- **(a) Recommended:** a third overlay, `"change-passphrase"`, rendered above the phase switch
  like Settings and the tour, and opened from Settings.
- (b) A `Workspace` screen.
- (c) A modal inside Settings.

*Trade-off:* only (a) works while **locked** (D-F, §2.3) and keeps Settings bridge-free (its
structural test). (b) is unreachable when locked. (c) breaks the no-bridge rule.

**P-14. Reusing the kit screen after a change (F14).**
- **(a) Recommended:** reuse the `kit-pending` phase with an optional `lockedAfterKit` flag.
  `afterKitAcknowledged(lockedAfterKit)` lands on locked or unlocked.
- (b) A new `passphrase-kit-pending` phase.

*Trade-off:* (a) keeps exactly one kit route, `RecoveryKitScreen`, with its acknowledgement gate.
(b) duplicates the routing and the `canNavigateAwayFrom` rule.

**P-15. How the parity row is created.**
- **(a) Recommended:** the declared `VALIJA_PARITY` pair `{ cli: "change-passphrase", ipc:
  ["vault:changePassphrase", "vault:readRecoveryKit"] }`, as spec §10 lists it.
- (b) Rely on automatic pairing through the shared `changePassphrase` use case.

*Trade-off:* (a) also documents the kit channel's role, like the `init` pair. It needs a
`surface-parity.test.ts` case proving that one channel can sit in two pairs. (b) is zero config,
but the row would not mention `vault:readRecoveryKit`.

**P-16. What `valija status` prints about backups (F11).**
- **(a) Recommended:** one `backup:` line, only for a rekey backup.
- (b) Also list `.pre-NNN.bak` migration backups, which `status` ignores today.

*Trade-off:* (a) is the spec's scope. (b) is consistent and cheap, but changes `status` output
for an unrelated case outside this advance.

**P-17. Which `WRONG_PASSPHRASE` gets the D-O hint.**
- **(a) Recommended:** the CLI `unlock` output, and the desktop `errors.WRONG_PASSPHRASE` copy
  (shown everywhere that code appears).
- (b) Also the CLI `change-passphrase` wrong-current-credential error.

*Trade-off:* (a) is what D-O names. Under (b), a user who changed the passphrase elsewhere would
also see the hint when retrying here, but the CLI then has two remedy call sites.

**P-18. The kit text layout (D-L).**
- **(a) Recommended:** a new `Key issued:` line under `Created:` (columns re-aligned), and the
  sentence "This replaces any earlier recovery kit for this vault." just above the final "Anyone
  holding this key…" line. For `init`, desktop create and SDK `createVault`, Key issued =
  `createdAt`.
- (b) Show `Key issued` only on kits from a passphrase change.

*Trade-off:* (a) uses one template, as D-L asks ("applied to init, desktop create and SDK"). (b)
makes kits look different depending on their origin.

**P-19. The CLI command's position in `--help`.**
- **(a) Recommended:** right after `status`, with the vault-lifecycle verbs.
- (b) Right after `lock`.

*Trade-off:* cosmetic. Either way, the pinned help test changes once.

**P-20. `.context/` notes.**
- **(a) Recommended:** a gotcha bullet, plus a new `.context/flows/change-passphrase.md` and its
  `AGENTS.md` line.
- (b) The gotcha bullet only.

*Trade-off:* (a) gives agents the security-critical step order in one place. It costs about 30
lines to keep stamped. (b) is lighter, but agents then rely on `docs/flows` alone.

**P-21. How verification is done.**
- **(a) Recommended:** a fresh connection with the new key, `PRAGMA integrity_check`, and a check
  that the lineage stamp equals the bump.
- (b) `PRAGMA quick_check`.

*Trade-off:* (a) is the strongest check, and the acceptance criteria name `integrity_check`. On
large vaults it adds seconds (S6 measures it). (b) is faster, but skips index-content checks.

---

## 7. Naming, placement, and ubiquitous language

**Placement** (CLAUDE.md, "no bare files at a layer's root"):

| New file | Folder kind | Precedent |
|---|---|---|
| `vault/domain/services/folder-settlement.ts` | `services/` | `vault-relocation.ts`, `vault-lineage.ts` |
| `vault/application/ports/vault-rekeyer.ts` | `ports/` | `vault-mover.ts`, `vault-folder.ts` |
| `vault/application/use-cases/change-passphrase.use-case.ts` (+ test) | `use-cases/` | `relocate-vault.use-case.ts` |
| `vault/infra/sqlite-vault-rekeyer.ts` (+ 2 tests) | tech-named infra adapter | `sqlite-lineage-store.ts`, `file-vault-mover.ts` |
| `delivery/cli/change-passphrase-command.ts` (+ test) | delivery CLI, one file per command family | `import-command.ts` |
| `delivery/change-passphrase.{surfaces,multi-device}.test.ts` | delivery integration tests | `multi-device-sync.test.ts` |
| `testing/rekey-child.ts`, `testing/vault-content.ts` | test support | `schema-skew.ts`, `passphrase-vault.ts` |
| `desktop/src/renderer/screens/change-passphrase.tsx` | `screens/` | `relocate-vault.tsx` |
| `desktop/src/renderer/screens/__dom-tests__/change-passphrase.dom.test.tsx` | `__dom-tests__/` | `recovery-kit.dom.test.tsx` |
| `desktop/src/main/ipc/handlers/vault-handlers.change-passphrase.test.ts` | beside its handler | `vault-handlers.hygiene.test.ts` |
| `docs/flows/change-passphrase.md`, `.context/flows/change-passphrase.md`, `advances/REKEY/spike.md` | docs | existing flows |

No new file sits loose at a `domain/application/infra` root, and no new kind folder is needed.
The rekeyer is an outbound **port** (`ports/`), and the settlement rule is a pure domain service
(`services/`).

**Names**

| Name | Verdict |
|---|---|
| `ChangePassphrase` (class), `change-passphrase.use-case.ts`, container key `changePassphrase` | the spec's verb and D-D's command; no `UseCase` suffix, following the repo (F19: `UnlockVault`, `RelocateVault`) |
| `ChangePassphraseInput { current, newPassphrase, otherDevicesConfirmed }`, `ChangePassphraseOutput` | `…Input`/`…Output` like `UnlockInput`/`RelocateVaultOutput`. `current` avoids an ambiguous `passphrase` next to `newPassphrase` |
| `VaultRekeyer.rekey(RekeyRequest)`, `SqliteVaultRekeyer`, `RekeyStage`, `REKEY_BACKUP_SUFFIX` | `Vault<Role>` port like `VaultMover`, `<Tech><Port>` adapter. *Rekey* is the SQLCipher term and stays technical and internal. *Alternative* if Oscar prefers domain words everywhere: `VaultReencryptor` / `SqliteVaultReencryptor` |
| `refuseUnsettledFolder`, `unsettledFiles` | mirrors `refuseUnsafeRelocation`; returns `DomainError \| null` like it |
| `rekeyBackups` (inspection), `REKEY_BACKUP_PATTERN` | next to `staleBackups` / `STALE_BACKUP_PATTERN` |
| `PASSPHRASE_UNCHANGED`, `VAULT_FOLDER_UNSETTLED`, `REKEY_FAILED` | the spec's codes (§7) |
| `changePassphraseCommand`, `ChangePassphraseOptions`, `promptLine` | `xCommand` like `unlockCommand`; `promptLine` next to `promptHidden` |
| `vault:changePassphrase`, `VaultChangePassphraseRequest/Response` | `vault:<verb>` and `Vault<Verb>Request/Response` like `vault:upgradeCheck` |
| `ChangePassphraseScreen`, overlay `"change-passphrase"`, `openChangePassphrase`, `afterPassphraseChanged`, `lockedAfterKit`, catalog `changePassphrase.*`, `sync.rekeyBackupsFound` | mirror `RelocateVaultScreen`, `openSettings`, `afterCreateSuccess`, `relocate.*`, `sync.staleBackupsFound` |
| `contentChecksum`, `snapshotVaultFiles` (reused) | test-support verbs |

**Ubiquitous language.** The user-facing copy says:
- *change your passphrase*, *re-encrypt*, *new recovery kit*, *previous passphrase/key*
- *other devices locked and synced*, *copies made before now*

It **never** says *rekey*, *rotate*, *reset password*, *account* or *login* to the user. *Rekey*
appears only in code, the `REKEY_FAILED` code and docs for implementers.

---

## 8. Estimated line count and risks

### Production lines

| Area | Lines |
|---|---|
| `src/vault/domain` (errors, folder-settlement, relocation) | ~40 |
| `src/vault/application` (port, use case, inspection doc) | ~130 |
| `src/vault/infra` (rekeyer, folder, kit) | ~160 |
| `src/delivery` (command, prompt, build-program, vault-commands, diagnostics, container) | ~125 |
| `tools/living-docs` (parity pair) | ~4 |
| `desktop/src` (messages, channels, schemas, handlers ×2, preload, bridge, overlay, session state, screen, settings, app, sync, catalogs ×2, css) | ~355 |
| **Total production** | **~815 (range 730–920)** |

Tests add about 1,370 lines, test support about 70 (`rekey-child.ts`, `vault-content.ts`), and
docs about 380:
- `docs/flows/change-passphrase.md` ≈ 60, `sync.md` ≈ 70, `gui.md` ≈ 30, vault-format ≈ 30
- SPEC, `specs/` ×3, sdk.md, README, CHANGELOG
- `.context/` ≈ 45
- `spike.md` (implementer)

The D-E 2 fallback adds about 60 production lines.

### Risks

1. **R1. The engine's crash safety** (spec §13). Mitigations:
   - the Slice 0 go/no-go
   - the F3 source reading
   - a permanent fault-injection test
   - the backup kept until verification
   - P-1's stop-and-ask fallback
2. **R2. A sync client or an unsynced device silently reverts the rekey** (§6). Mitigations:
   - D-I and D-M preconditions
   - the lineage bump, which makes it a fork (the Slice 7 test)
   - `docs/sync.md`

   This cannot be prevented without a network, and the residual risk is accepted by the spec.
3. **R3. Users believe old copies are now safe.** Mitigations: the CLI preamble, the dialog's
   `oldCopies` sentence, and sync.md's threat-model sentence.
4. **R4. Platforms.** Windows `copyFileSync` under SQLite's lock (A8) and POSIX-only fault
   injection (A10). If the fallback is taken: R4′ POSIX orphan writes and R4″ Windows rename
   refusals.
5. **R5. Exclusive locking mode leaves `vault.db-journal`** (F6). Pinned by the "no sidecar" test,
   with S5 choosing the remedy. A leftover journal would make the folder look unsettled and block
   the next change.
6. **R6. Disk and time on large vaults.** About 3× free space (P-8) and seconds of rewriting plus
   `integrity_check`. Other surfaces on this device get "vault busy" after 5 s during a long
   change, as §5.3 accepts. The CLI and desktop show a busy line.
7. **R7. Same-device race** leaves the vault locked (§5.3). It fails closed and is accepted.
8. **R8. Secrets in JS strings** cannot be wiped. This is documented, and bytes are zeroed on a
   best-effort basis.
9. **R9. Test runtime.** About 25 s more (the fault matrix, two 6.5 s busy holds, Argon2 with
   `FAST_KDF`, tsup bundling).
10. **R10. Size.** About 815 production lines over nine slices, spanning vault, delivery, desktop
    and living docs. Each slice is independently green, and the riskiest code (Slice 3) is
    isolated behind one port.

---

## 9. Repo structure after execution

Legend: `+` new · `~` changed · unmarked = unchanged context.

```
valija/
├── AGENTS.md                                             ~ + change-passphrase flow line (P-20)
├── CHANGELOG.md                                          ~ Unreleased › Added: change-passphrase (CLI + desktop), kit "Key issued", rekey-backup reporting
├── README.md                                             ~ + "Change your passphrase"
├── .context/
│   ├── gotchas.md                                        ~ + vault/storage rekey bullet
│   ├── flows/change-passphrase.md                        + agent flow note (P-20)
│   └── manifest.yaml                                     ~ re-stamped
├── advances/REKEY/
│   ├── refined.md                                        (unchanged)
│   ├── plan.md                                           + THIS FILE
│   └── spike.md                                          + Slice 0 findings (implementer)
├── docs/
│   ├── flows/
│   │   ├── change-passphrase.md                          + new flow
│   │   ├── unlock-vault.md                               ~ D-O hint
│   │   ├── create-vault.md                               ~ kit "Key issued"
│   │   ├── relocate-vault.md                             ~ rekey backup counts as unsettled
│   │   ├── check-setup.md                                ~ sync row: pre-rekey backup
│   │   └── check-vault-status.md                         ~ status backup line
│   ├── guide/**                                          ~ regenerated by npm run docs
│   ├── sync.md                                           ~ + "Changing your passphrase on a synced vault"
│   ├── vault-format.md                                   ~ §3/§4/§5/§11 notes + cipher-salt fact
│   ├── SPEC.md                                           ~ §8 command + paragraph · §9 rule
│   ├── sdk.md                                            ~ Mode P handles → VAULT_LOCKED after a change
│   └── gui.md                                            ~ Settings → Change passphrase
├── specs/
│   ├── vault.md                                          ~ codes · folder-settlement · rekeyBackups · port · adapter · use case · kit
│   ├── delivery.md                                       ~ command · promptLine · hint · diagnostics row · status line · container
│   └── desktop.md                                        ~ channel · messages · overlay · lockedAfterKit
├── tools/living-docs/valija/
│   ├── composition/
│   │   ├── valija-guide.ts                               ~ + VALIJA_PARITY pair (change-passphrase)
│   │   └── valija-guide.smoke.test.ts                    ~ ipc 38 · err 53 · symbol as reported
│   ├── services/surface-parity.test.ts                   ~ + channel in two pairs
│   └── surfaces/surfaces.test.ts                         ~ 22 commands · 38 channels
├── src/
│   ├── vault/
│   │   ├── domain/
│   │   │   ├── errors.ts                                 ~ + PASSPHRASE_UNCHANGED, VAULT_FOLDER_UNSETTLED, REKEY_FAILED
│   │   │   └── services/
│   │   │       ├── folder-settlement.ts                  + unsettledFiles, refuseUnsettledFolder
│   │   │       ├── folder-settlement.test.ts             +
│   │   │       ├── vault-relocation.ts                   ~ counts rekeyBackups
│   │   │       └── vault-relocation.test.ts              ~
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   │   ├── vault-folder.ts                       ~ + rekeyBackups
│   │   │   │   └── vault-rekeyer.ts                      + RekeyRequest, VaultRekeyer
│   │   │   ├── services/resolve-unlock-key.ts            (unchanged — reused for both keys)
│   │   │   └── use-cases/
│   │   │       ├── change-passphrase.use-case.ts         + ChangePassphrase
│   │   │       ├── change-passphrase.use-case.test.ts    +
│   │   │       ├── relocate-vault.use-case.test.ts       ~ fixture field
│   │   │       └── vault-status.use-case.test.ts         ~ fixture field
│   │   └── infra/
│   │       ├── sqlite-vault-rekeyer.ts                   + SqliteVaultRekeyer, RekeyStage, REKEY_BACKUP_SUFFIX
│   │       ├── sqlite-vault-rekeyer.test.ts              +
│   │       ├── sqlite-vault-rekeyer.fault-injection.test.ts  + kill -9 matrix (bundled child)
│   │       ├── file-vault-folder.ts                      ~ + REKEY_BACKUP_PATTERN, rekeyBackups
│   │       ├── file-vault-folder.test.ts                 ~
│   │       ├── recovery-kit.ts                           ~ + issuedAt, "Key issued", "replaces" sentence
│   │       └── recovery-kit.test.ts                      ~
│   ├── delivery/
│   │   ├── container.ts                                  ~ + changePassphrase (SqliteVaultRekeyer)
│   │   ├── container.test.ts                             ~
│   │   ├── diagnostics.ts                                ~ sync row: pre-rekey backup, previous key
│   │   ├── diagnostics.test.ts                           ~
│   │   ├── change-passphrase.surfaces.test.ts            + MCP after · SDK Mode P · isolation · old-key session
│   │   ├── change-passphrase.multi-device.test.ts        + second device · reverted rekey → fork
│   │   ├── mcp/                                          (unchanged — 5 tools, 2 prompts)
│   │   ├── sdk/                                          (unchanged — no API change)
│   │   └── cli/
│   │       ├── build-program.ts                          ~ + change-passphrase
│   │       ├── build-program.test.ts                     ~ pinned help
│   │       ├── change-passphrase-command.ts              + changePassphraseCommand
│   │       ├── change-passphrase-command.test.ts         +
│   │       ├── prompt.ts                                 ~ + promptLine
│   │       ├── vault-commands.ts                         ~ unlock D-O hint · status backup line
│   │       └── vault-commands.test.ts                    ~ status backup line · D-O hint
│   ├── shared/                                           (unchanged — no migration; schema stays v4)
│   └── testing/
│       ├── rekey-child.ts                                + bundled child entry (fault injection)
│       └── vault-content.ts                              + contentChecksum
└── desktop/src/
    ├── shared/
    │   ├── ipc/
    │   │   ├── channels.ts                               ~ + "vault:changePassphrase"
    │   │   └── messages.ts                               ~ + VaultChangePassphraseRequest/Response · SyncStatusResponse.rekeyBackups
    │   └── i18n/catalogs/
    │       ├── en.ts                                     ~ + errors ×3 · WRONG_PASSPHRASE hint · changePassphrase.* · settings.changePassphrase · sync.rekeyBackupsFound
    │       └── es.ts                                     ~ (same keys, neutral Spanish)
    ├── preload/index.ts                                  ~ + vault.changePassphrase
    ├── main/ipc/
    │   ├── schemas.ts                                    ~ + vault:changePassphrase
    │   ├── schemas.test.ts                               ~
    │   └── handlers/
    │       ├── vault-handlers.ts                         ~ + vault:changePassphrase (shared one-shot kit slot)
    │       ├── vault-handlers.change-passphrase.test.ts  + wire shape · one-shot kit · hygiene
    │       ├── sync-handlers.ts                          ~ + rekeyBackups
    │       └── sync-handlers.test.ts                     ~
    └── renderer/
        ├── app.tsx                                       ~ + change-passphrase overlay · passphraseChanged · kit ack flag
        ├── app.shell.test.ts                             ~
        ├── screens/
        │   ├── change-passphrase.tsx                     + ChangePassphraseScreen
        │   ├── settings.tsx                              ~ + "Change passphrase…" (locked and unlocked)
        │   ├── sync.tsx                                  ~ + rekey-backup banner line
        │   ├── recovery-kit.tsx                          (unchanged — reused)
        │   └── __dom-tests__/
        │       ├── change-passphrase.dom.test.tsx        +
        │       └── schema-too-new.dom.test.tsx           ~ exhaustive vault list
        ├── state/
        │   ├── overlay-nav.ts                            ~ + "change-passphrase", openChangePassphrase
        │   ├── overlay-nav.test.ts                       ~
        │   ├── session-state.ts                          ~ kit-pending lockedAfterKit · afterPassphraseChanged · afterKitAcknowledged(flag)
        │   ├── session-state.test.ts                     ~
        │   ├── bridge.ts                                 ~ + vault.changePassphrase
        │   └── create-vault-validation.ts                (unchanged — reused by the dialog)
        └── styles/screens.css                            ~ + .screen.change-passphrase (tokens only)
```

**Net:**
- **20 new files, plus this plan:**
  - 6 production files:
    - `src/vault/domain/services/folder-settlement.ts`
    - `src/vault/application/ports/vault-rekeyer.ts`
    - `src/vault/application/use-cases/change-passphrase.use-case.ts`
    - `src/vault/infra/sqlite-vault-rekeyer.ts`
    - `src/delivery/cli/change-passphrase-command.ts`
    - `desktop/src/renderer/screens/change-passphrase.tsx`
  - 9 test files:
    - `folder-settlement.test.ts`
    - `change-passphrase.use-case.test.ts`
    - `sqlite-vault-rekeyer.test.ts`
    - `sqlite-vault-rekeyer.fault-injection.test.ts`
    - `change-passphrase-command.test.ts`
    - `change-passphrase.surfaces.test.ts`
    - `change-passphrase.multi-device.test.ts`
    - `vault-handlers.change-passphrase.test.ts`
    - `change-passphrase.dom.test.tsx`
  - 2 test-support files: `src/testing/rekey-child.ts`, `src/testing/vault-content.ts`
  - 3 docs: `docs/flows/change-passphrase.md`, `.context/flows/change-passphrase.md`,
    `advances/REKEY/spike.md` (written by the implementer in Slice 0)
- **About 55 changed files** (≈ 20 production, ≈ 15 tests, ≈ 20 docs and agent notes), plus the
  regenerated `docs/guide/**`.
- **No new folders**, so **no new kind folder**.
- **0** migrations, dependencies, MCP tools, arguments or prompts, and SDK exports.
- **1** new CLI command, **1** new IPC channel, **3** new error codes.
