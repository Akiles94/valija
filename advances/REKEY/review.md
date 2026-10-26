Verdict: FAIL

# REKEY — Change review

**Reviewed:** `git diff feat/sdk-SDK...HEAD` on `feat/rekey-REKEY` (12 commits, 3a48368 … 662624e).
**Against:** `advances/REKEY/refined.md` (Gate R, D-A … D-P option 1), `advances/REKEY/plan.md`
(`Approved: Oscar 2026-10-22`, P-1 … P-21 (a), plus the binding **Amendment after Slice 0**, D-E 1′),
and `advances/REKEY/spike.md`.

**Why it fails, in one line:** once the re-encryption has committed and verified, two calls can still
throw. If either does, the use case aborts before the keychain swap and before the kit is returned.
The vault is then re-keyed, the user sees an unexpected error and never gets the new kit, and the OS
keychain still holds the **old** key. That breaks the §11 criterion "The keychain never ends up
holding the old key after commit" (and §5.3 and §8.4). Details are under C1. The fix is small. Everything
else is solid.

---

## Verification run (by the reviewer)

| Command | Result |
|---|---|
| root `npm run typecheck && npm run lint && npm run test && npm run docs:check && npm run context:check` | green: 140 files, 1233 tests. Guide up to date (25 flows, 674/674 exports). Context 11/11 fresh |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | green: 75 files, 1264 tests |
| `npx vitest run src/vault/infra/sqlite-vault-rekeyer.fault-injection.test.ts` (verbose) | 5/5 ran and passed (not skipped): baseline, 7 boundaries, 11 mid-rekey kills, EFBIG in the rekey, EFBIG in the backup |
| `git diff --stat feat/sdk-SDK...HEAD -- src/delivery/mcp src/delivery/sdk migrations golden fixture package*.json desktop/package.json` | only `src/delivery/mcp/server.test.ts`, a test-only Container literal. No production MCP/SDK change, no dependency, no migration |
| Authorship | all 12 commits are author and committer `Oscar Vinueza <os.vinueza94@gmail.com>`. `grep -iE 'claude\|anthropic\|co-authored'` over the messages finds nothing |

## Line count

| Kind | Added / removed |
|---|---|
| Production (`src/`, `desktop/src/`, `tools/`, excluding tests and `src/testing/`) | **+1064 / −23**. The plan estimated ~815 (range 730–920). The overrun is mostly `sqlite-vault-rekeyer.ts` (269 vs ~150; the extra is the D-E 1′ salt and spill steps, the malformed-key and missing-db guards, and the explicit restore branches) and `change-passphrase.tsx` (176 vs ~130). It is justified, not sprawl. |
| Tests and test support | +2488 / −13 |
| Docs (advances, docs, specs, generated guide, `.context`) | +3659 / −100 |

## Ritual evidence (CLAUDE.md)

- `refined.md` records approval at Gate R by Oscar on 2026-10-22 (3a48368).
- `plan.md` line 1 reads `Approved: Oscar 2026-10-22`. The D-E 1′ amendment is recorded at the top, dated 2026-10-26 (2649da3).
- `spike.md` was the Slice 0 deliverable (622664c). Its NO-GO and the stop-and-ask were honoured, per P-1 (a).
- Branch: `feat/rekey-REKEY` follows `{feature}/{ADVANCE}`.
- The trail is complete.

---

## Acceptance criteria (refined.md §11)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | After the change, the new passphrase and kit open; the old ones give `WRONG_PASSPHRASE`; content identical; `integrity_check` ok | **met** | `change-passphrase.use-case.test.ts:139` (locked and unlocked loop), `:169`. `sqlite-vault-rekeyer.test.ts:111` (`contentChecksum`, NOTADB for OLD) |
| 2 | `vault.json` byte-identical | **met** | `sqlite-vault-rekeyer.test.ts:140` |
| 3 | No `-wal`/`-shm`/`-journal`; mode `DELETE`; backup gone | **met** | `sqlite-vault-rekeyer.test.ts:140`; fault-injection `:93` (`readdirSync` = `[vault.db, vault.json]`) |
| 4 | Generation +1, writer = this device | **met** | `sqlite-vault-rekeyer.test.ts:111`, use case `:139` (last-seen) |
| 5 | Kit shown once with `Key issued`, no kit file; second `vault:readRecoveryKit` is `null` | **met** | `change-passphrase-command.test.ts:82,195`; `vault-handlers.change-passphrase.test.ts` ("first … second is null"); `recovery-kit.ts` |
| 6 | Works locked and unlocked, both require the credential | **met** | use case `:139` loop; `settings.tsx` button in both branches (662624e); the use case never reads the keychain to authenticate (`change-passphrase.use-case.ts:132-135`) |
| 7 | `--recovery-key` and the desktop toggle (D-G) | **met** | use case `:169`, command test `:145`, DOM test "recovery-key toggle" |
| 8 | Six refusals leave `vault.db`, `vault.json` and the keychain byte-identical | **met** | use case `:205-:299` (`snapshotVaultFiles`, keychain unchanged, rekeyer never called); space: `sqlite-vault-rekeyer.test.ts:172` |
| 9 | Behind schema re-keyed, `schema_version` unchanged (D-J) | **met** | `sqlite-vault-rekeyer.test.ts:158`, use case `:182` (no `.pre-NNN.bak`) |
| 10 | Cloud folder: the CLI refuses without `y`/`--yes`; the desktop checkbox blocks | **met** | command test `:107-:133`, DOM test "cloud folder", use case `:282` backstop (P-6) |
| 11 | Kill at each stage boundary and mid-rekey → old or new opens, or the backup opens with old; never neither | **met** | `sqlite-vault-rekeyer.fault-injection.test.ts:96,110` (SIGKILL, S7c NEW-first on a hot journal, restore leg); spike S7 for 20 MB–1.3 GB |
| 12 | Simulated write failure → `REKEY_FAILED`; old credential opens | **met** | fault-injection `:124` (`ulimit -f` inside the rekey, as the amendment requires), `:138`; `sqlite-vault-rekeyer.test.ts:235` |
| 13 | Leftover backup flagged by status, doctor, Diagnostics and Sync; counted by relocation | **met** | `vault-commands.ts` `backup:` line, `diagnostics.ts` `rekeyBackupAdvice`, `sync.tsx`, `sync-handlers.ts`, `vault-relocation.ts:48`, plus their tests |
| 14 | After success the OS keychain holds the new key; MCP `get_context` works without re-unlock | **met** | `change-passphrase.surfaces.test.ts:75` |
| 15 | Keychain write fails after commit → success, locked, "unlock with new passphrase"; new passphrase opens | **met** | use case `:317`, command test `:178`, `session-state.test.ts` `afterPassphraseChanged(false)` |
| 16 | A write lock makes the rekey wait, then fail busy, nothing changed; an old-key session fails closed and never writes | **met** | `sqlite-vault-rekeyer.test.ts:219`, `change-passphrase.surfaces.test.ts:117` |
| 17 | Mode P handle → `VAULT_LOCKED`; the recording keychain shows the SDK adapter untouched | **met** | `change-passphrase.surfaces.test.ts:91` (`RecordingKeychain.calls`, `InMemoryKeychain.prototype.setKey` spy) |
| 18 | **The keychain never ends up holding the old key after commit** | **not met** | Covered for `setKey` throwing (use case `:317`) and for the race (`:335`). **Not** covered for any other throw after the commit, and two such throws exist: see **C1** |
| 19 | Second device: `VAULT_LOCKED`, old passphrase → `WRONG_PASSPHRASE` + hint, new → fast-forward | **met** | `change-passphrase.multi-device.test.ts:116` |
| 20 | A divergent old-key copy replaces the new one → lineage reports a fork; docs explain | **met** | multi-device `:135`; `docs/sync.md` "If you skipped step 1: a reverted change" |
| 21 | CLI command + IPC channel + `VALIJA_PARITY` pair; no MCP or SDK surface | **met** | `build-program.ts`, `channels.ts` (38 channels, `surfaces.test.ts`), `valija-guide.ts` pair; `server.test.ts:123` 5 tools / 2 prompts; surfaces test `:112` |
| 22 | `en`/`es` copy for the three codes; catalog parity; `resetWorkspaceView()` on leaving unlocked | **met** | `en.ts`/`es.ts`, catalogs/error-copy tests green; `app.tsx` `passphraseChanged`, `app.shell.test.ts` |
| 23 | Docs in the same commit (flow, sync.md, vault-format + salt fact, SPEC §8/§9, specs/vault.md, sdk.md, README, CHANGELOG) | **met** | all present. The sync.md restore steps delete the journal before the rename, and the threat-model sentence is verbatim |
| 24 | Loops green; no new dependency; no network | **met** | reviewer run above |

**23 / 24 met. #18 is not met.**

---

## Gate check

| Gate | Result |
|---|---|
| Security surface | **Breach (C1)**, for the "never the old key after commit" invariant, on a post-commit exception path. Everything else holds: no secret is logged; rekeyer messages carry codes only (`failureCode`, never `error.message`); `assertKeyHex` runs on the new key (`isKeyHex`, `sqlite-vault-rekeyer.ts:64`); the raw 96-hex `rekey="x'<key><salt>'"` form (`:147`) is pinned by the source scan (`sqlite-vault-rekeyer.test.ts:287`, no `.rekey(` / `hexrekey` / `hexkey`); the IPC response has no `keyHex` and the kit crosses through the one-shot slot; SQLCipher is always keyed through `openVaultDb`; MCP and SDK are unchanged |
| Tests for new behaviour / suite passing | Suite passes. The post-commit failure paths in C1 have no test |
| Ritual | OK |
| Naming / placement | OK. `folder-settlement.ts` → `domain/services/`, `vault-rekeyer.ts` → `application/ports/`, `change-passphrase.use-case.ts` → `use-cases/`, `sqlite-vault-rekeyer.ts` is a tech-named infra adapter. No bare files at a layer root and no new kind folder. `ChangePassphrase` without a `UseCase` suffix follows the repo (F19, approved) |
| CLI ↔ desktop parity | OK (plan §4.3 table, every row implemented) |

---

## Implementers' reported deviations: rulings

1. **`settleJournal` → `dropColdJournal`** (`src/shared/infra/sqlite.ts:116-131`). **Accepted. It is safe, and it cannot delete a hot or live journal.**
   - **Ordering.** It runs after `applyKey`'s verifying read and after `refuseNewerSchema`. A wrong key throws `SQLITE_NOTADB` and a newer schema throws `SchemaTooNewError` before it, so neither ever reaches it. The read-only `probeSchemaVersion` path never calls it.
   - **Mechanism.** The PERSIST → DELETE switch goes through `sqlite3PagerSetJournalMode` (bundled `sqlite3.c:67157-67190`). It first takes SHARED through `sqlite3PagerSharedLock`, which itself plays back any hot journal with the connection's already-verified key. It then needs RESERVED before calling `sqlite3OsDelete`. A concurrent writer that holds RESERVED or higher makes the lock fail, and the error is deliberately ignored ("an optimization only"), so a live journal is never deleted.
   - **Rollback interplay.** A hot journal can therefore only be rolled back, never deleted. The cost on every surface is one `existsSync`.
   - See **W3** for the missing negative test.
2. **`RekeyStage` gains `"released"`.** Accepted. It matches spike S7's seventh boundary, and the fault matrix kills on it.
3. **Living-docs pins moved, and the test-only Container literal in `server.test.ts`.** Accepted. No production MCP change.
4. **Fault injection for free space, verify and rename via `vi.mock`.** Accepted. The amendment's binding requirement, an in-rekey write failure through `ulimit -f`, is met with a real child (`fault-injection.test.ts:124`).
5. **Adapter refuses a malformed key or a missing `vault.db`.** Accepted, and required by spike S3.
6. **Relocation refusal message reworded, code unchanged.** Accepted (§5.4).
7. **CLI `promptLine` uses a short-lived readline on a TTY.** Accepted. `close()` pauses stdin and the hidden prompt resumes it.
8. **Desktop disables Submit until `sync.status` answers, clears secrets after every submit, and Cancel returns to Settings.** Accepted, but see **W2** (no rejection handling).
9. **Slice 7 race test runs in-process via `onStage`.** Accepted. It exercises the real busy and NOTADB paths.
10. **Full `easy-repo-context stamp`.** Accepted. `context:check` reports 11/11 fresh.

---

## Issues

### Critical (blocks PASS)

**C1. A throw after the commit skips the keychain swap and the kit, and leaves the OLD key in the keychain.**

`ChangePassphrase.execute` (`change-passphrase.use-case.ts:153-169`) treats everything after `rekeyer.rekey()` as infallible. Two calls are not:

- **`SqliteVaultRekeyer.rekey` → `rmSync(this.backupPath(), { force: true })` (`sqlite-vault-rekeyer.ts:82`).** It runs after `verify()` has proven the new file. `force` only suppresses `ENOENT`. On Windows, deleting a file that another handle opened without `FILE_SHARE_DELETE` fails with `EPERM`/`EBUSY`. That is exactly what happens when Defender scans, or Dropbox or OneDrive hashes, the brand-new ~vault-sized `.pre-rekey.bak` during the seconds-long rekey and verify. That is the cloud-folder scenario this feature targets. The throw escapes a `Result`-returning port, which breaks the port's contract.
- **`this.deviceIdentity.recordSeen(...)` (`:161`).** It runs **before** `storeNewKey` and does a `writeFileSync` + `renameSync` of `state.json` (`file-device-identity.ts:87-95`), which can throw (ENOSPC, EACCES).

If either throws, the re-encryption has committed and `vault.db` opens only with the new passphrase, but:

- (a) `setKey(new)` and `deleteKey` never run, so the keychain keeps the **old** key. That breaks §11 #18, §5.3 and §8.4. The old key does fail closed on the next session, but the spec forbids the state itself.
- (b) The new kit is never returned, so it is never shown. That breaks §11 #5 "printed or shown once".
- (c) The user is told something failed when the passphrase has in fact changed:
  - the CLI prints `error: EPERM: …` and exits 1 (`program.ts` catch)
  - the desktop IPC promise rejects and the dialog hangs on "Re-encrypting…" (W2)

**To flip to PASS:**
1. In `SqliteVaultRekeyer.rekey`, make the post-verify backup deletion non-throwing: catch it and still return `ok(stamp)`. A leftover backup is already flagged by `FileVaultFolder.rekeyBackups`, `status`, `doctor` and Sync, so nothing is lost. Optionally pass `maxRetries` on Windows.
2. In `ChangePassphrase.execute`, once `rekey` returned `ok`, run the keychain swap first, or guard `recordSeen` (and `recordActivity`) so a bookkeeping failure can never prevent `setKey`/`deleteKey` or the returned kit.
3. Add tests:
   - rekeyer: `rmSync` of the backup throws `EPERM` after verify → `ok(stamp)`, NEW opens, the backup is reported by `FileVaultFolder`
   - use case: a `DeviceIdentity` whose `recordSeen` throws → `ok`, the keychain holds the new key (or none), never the old one, and `keyHex` is returned

### Warnings (should fix; not blocking on their own)

**W1. `storeNewKey` conflates a `recordActivity` failure with a keychain refusal.**
- **Where:** `change-passphrase.use-case.ts:173-182`.
- **Problem:** if `setKey` succeeds but `recordActivity` throws, the catch deletes a perfectly good new key and reports "the OS keychain did not accept the new key". That fails closed, but the report is false.
- **Fix:** `try { setKey } catch { deleteKey; return false }`, then `recordActivity` in its own guarded step. This is naturally folded into the C1 fix.

**W2. The desktop dialog has no rejection handling.**
- **Where:** `change-passphrase.tsx:83-89` and `:37`.
- **Problem 1:** if `bridge.vault.changePassphrase` rejects (any unexpected main-process throw, including C1), `working` stays `true` forever. The Cancel button is hidden while working, the secret fields are never cleared (contrary to the component's own contract), and the user is stuck on "Re-encrypting…".
- **Problem 2:** if `bridge.sync.status()` rejects, `cloud` stays `null` and Submit is disabled forever with no message.
- **Fix:** wrap the submit in `try { … } finally { clearSecrets(); setWorking(false); }` with a generic error copy, and treat a failed `sync.status` as `cloud = true` (the safe default: it asks for the confirmation).

**W3. No regression test that `dropColdJournal` preserves a live journal.**
- **Problem:** it now runs on every `openVaultDb` across CLI, MCP, desktop and SDK. Its safety rests on SQLite's RESERVED-lock check (correct, see ruling 1), but only the cold case is tested (`sqlite.test.ts:96`).
- **Fix:** add a test where a worker holds `BEGIN IMMEDIATE` plus an uncommitted write, a second `openVaultDb` runs, and then the journal still exists, the holder commits, and `integrity_check` is ok.

**W4. The desktop `REKEY_FAILED` copy always says "Nothing changed: your current passphrase still works".**
- **Problem:** the adapter also returns `REKEY_FAILED` when the restore failed, or when the vault "could not be confirmed intact" (`sqlite-vault-rekeyer.ts:185-198`). The CLI message names the backup and the manual step. The desktop user is reassured falsely in the one case where they must act. Spec §7 says "If a backup is kept, it is named".
- **Fix:** the desktop cannot carry the path (code-only IPC), but it can route this case differently. Either use a distinct code for "backup kept, manual restore needed", or have the copy point to Sync/Diagnostics, which already flag the backup. This is rare, but it is the worst moment to mislead.

### Suggestions

- **S1.** `folder-settlement.ts` (domain) imports `VaultFolderInspection` from `application/ports`. This copies the existing `vault-relocation.ts` precedent, so it is consistent, but it inverts the clean-architecture dependency. A future clean-up could move the inspection shape to `domain/values/`.
- **S2.** The desktop trims the recovery key (`current.trim()`) but the CLI `--recovery-key` does not. Trim in `resolveUnlockKey` once, so both surfaces, and `unlock`, behave the same.
- **S3.** The CI fault matrix uses a ~6 MB vault. Nothing asserts that at least one mid-rekey kill actually landed in the commit window (a hot journal), so S7c can pass vacuously in CI. The spike covers it, but consider asserting `outcomes.some(o => o.hotJournal)` across the late-fraction kills, or logging the count.
- **S4.** `release()` swallows every error by design. A one-line comment noting that `verify()` is the single source of truth (it is partly there) plus the `released` stage is enough. No change needed.
- **S5.** The plan's §8 production estimate was exceeded by ~15% over the upper bound. When C1 is fixed, keep the fix local: no new helper classes.

---

## What would flip this to PASS

1. **C1:** the post-commit backup deletion is non-throwing in `SqliteVaultRekeyer`, and `ChangePassphrase` guarantees the keychain swap and the kit return once `rekey` is `ok`, whatever the device-state bookkeeping does.
2. Tests pinning both paths, as listed under C1.
3. Both verification loops still green.

W1–W4 are strongly recommended in the same pass (W1 and W2 fall out of the C1 fix almost for free), but they do not block on their own.
