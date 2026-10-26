Verdict: PASS

# REKEY — Change review (second pass)

**Reviewed:** `git diff feat/sdk-SDK...HEAD` on `feat/rekey-REKEY` (14 commits, 3a48368 … 4fa24a7). The
focus is the fix commit `4fa24a7`, checked against the first-pass findings C1 and W1–W4. The rest of
the diff was re-checked for regressions.
**Against:** `advances/REKEY/refined.md` (Gate R), `advances/REKEY/plan.md` (`Approved: Oscar 2026-10-22`,
plus the binding Amendment after Slice 0, D-E 1′), and `advances/REKEY/spike.md`.

**Summary:** C1 is fixed. After `rekey` returns `ok`, nothing left in the use case, the CLI command or
the desktop handler can throw:
- the keychain swap runs first
- the state bookkeeping is best effort
- the post-verify backup delete cannot throw
- the kit and the IPC mapping are pure

W1–W4 are fixed too, and each has a test. Both loops are green and no hard gate is breached. Three
non-blocking warnings remain (below).

---

## Verification run (by the reviewer)

| Command | Result |
|---|---|
| root `npm run typecheck && npm run lint && npm run test && npm run docs:check && npm run context:check` | green. 140 files, **1237** tests (was 1233). Guide up to date: 25 flows, 676/676 exports. Context: 11 fresh, 0 broken |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | green. 75 files, **1274** tests (was 1264) |
| Authorship | all 14 commits have author and committer `Oscar Vinueza <os.vinueza94@gmail.com>`. `grep -ciE 'claude\|anthropic\|co-authored'` over every message returns 0. The branch is `feat/rekey-REKEY` |
| Scope of the fix | `git diff 662624e 4fa24a7` changes no `plan.md`/`refined.md`, no MCP or SDK production file, no dependency and no migration |

## Line count

| Kind | Whole advance (+/−) | Fix commit `4fa24a7` (+/−) |
|---|---|---|
| Production (`src/`, `desktop/src/`, `tools/`; excluding tests and `src/testing/`) | +1170 / −32 | +135 / −38 (incl. i18n copy) |
| Tests and test support | +2685 / −14 | +199 / −3 |
| Docs and other (advances, docs, specs, guide, `.context`) | +3867 / −105 | rest |

The fix stayed local as S5 asked: two private methods, one module-level helper, and one error class
in the per-module `errors.ts`. No new helper classes.

## Ritual evidence (CLAUDE.md)

- `refined.md` was approved at Gate R (3a48368).
- `plan.md` line 1 is `Approved: Oscar 2026-10-22 …`, and the D-E 1′ amendment is recorded (2649da3).
- `spike.md` is present, and the first review is on record (bed67ad).
- The trail is complete.

---

## First-pass findings: verification

| Finding | Status | Evidence |
|---|---|---|
| **C1(a)** backup `rmSync` after verify could throw | **fixed** | `sqlite-vault-rekeyer.ts:83` calls `dropBackup()`, and `:187-193` wraps `rmSync` in try/catch. Also used in `recoverFrom` `:179`. Test: `sqlite-vault-rekeyer.test.ts` "after the commit (C1)" mocks `rmSync` → `EPERM` for `*.pre-rekey.bak` and asserts `ok`, stage `verified`, NEW opens, OLD is `NOTADB`, the backup opens with OLD, and `FileVaultFolder.inspect().rekeyBackups` lists it |
| **C1(b)** `recordSeen` before the keychain swap could throw | **fixed** | `change-passphrase.use-case.ts:106-107`: `storeNewKey` runs first, then `recordBookkeeping` (`:133-138`), whose two steps go through `ignoreFailure` (`:141-147`). Test: "when recording last-seen fails after the commit" asserts `ok`, a new `keyHex`, `unlockedOnThisDevice`, the keychain holds the NEW key, and the new passphrase unlocks |
| **W1** a `recordActivity` failure deleted a good key | **fixed** | `storeNewKey` (`:119-127`) wraps only `setKey`. `recordActivity` is best effort, and only when unlocked. Test: "when recording activity fails after setKey" asserts `sets == [newKey]`, the key stays, and last-seen is recorded |
| **W2** dialog hung on a rejection; Submit dead on a `sync.status` rejection | **fixed** | `change-passphrase.tsx`: `.catch(() => null)`, then `clearSecrets(); setWorking(false)` and the `unexpected` copy. `sync.status` rejected → `cloud = "unknown"`, which requires the confirmation (`cloud === false \|\| devicesConfirmed`, fail-safe) and shows `cloudUnknown`. DOM tests cover both, including cleared and enabled fields and a working Cancel |
| **W3** no test that `dropColdJournal` spares a live journal | **fixed** | `sqlite.test.ts` "leaves a live writer's journal alone": `BEGIN IMMEDIATE` plus an uncommitted insert, then a second `openVaultDb`. The journal survives, the second connection reads 0 rows, the writer commits, the row is visible, `integrity_check` is ok, and the journal is gone afterwards |
| **W4** desktop said "nothing changed" when the restore failed or nothing verified | **fixed** | `errors.ts` adds `RekeyUnresolvedError` (code still `REKEY_FAILED`) and `rekeyUnresolvedErr`. The rekeyer uses it only in `restoreBackup`'s two unresolved branches (`:199`, `:207`). `toIpcResult` emits `{ code, unresolved: true }`. The renderer shows `failedUnresolved`. Tests: `to-ipc-result.test.ts` (no message or path in the JSON; a plain `REKEY_FAILED` carries no flag), rekeyer `instanceof` assertions on both restore outcomes, and DOM en/es |

### Adversarial checks requested

**1. Can a committed rekey still end with the old key in the keychain or a lost kit?** I traced every
statement from `rekey` → `ok` to the user. None of them can throw:
- `storeNewKey`: `setKey` is guarded. `OsKeychain.deleteKey` swallows every error (`keyring.ts:20-26`).
- `recordBookkeeping`: guarded.
- `clock.now()`, `renderRecoveryKit`, `printOutcome`, and the `vault:changePassphrase` handler's slot assignment plus `toIpcResult`: all pure.

Inside the rekeyer, nothing after the `PRAGMA rekey` can escape:
- `release` catches.
- `verify`/`opensIntact` catch.
- `dropBackup` catches.
- `restoreBackup` catches `rmSync`/`renameSync`, and `existsSync` does not throw.

A recordSeen failure leaves last-seen at generation g while the vault is at g+1 →
`classifyLineage` returns `fast-forward`, never `fork` (`vault-lineage.ts:38-41`). It is benign, as the
comment says.

One residual case, an OS limit rather than a code path, is under Warning 1.

**2. Can the dialog hang?** No. A rejection resets `working`, clears the secrets and shows Cancel. A
`sync.status` rejection no longer disables Submit.

**3. Does `unresolved` leak a message or path over IPC?** No. It is the literal `true as const`
(`to-ipc-result.ts`), and the type is `unresolved?: true` (`messages.ts`). The test feeds a message that
contains a path and asserts the serialized result does not match `/backup|vault\.db/`. The CLI still
names the backup and the manual step (spec §7 "If a backup is kept, it is named").

**4. Is the Spanish copy neutral?** Yes:
- Imperatives are in the *tú* form ("bloquea", "espera", "Abre", "ejecuta", "Intenta", "No borres"). No voseo and no regional idioms.
- Screen names match the catalog's own labels ("Sincronización y seguridad", "Revisar mi configuración").
- "frase de contraseña" is used consistently.

Nit: "recifrado" is a coinage. The rest of the catalog says "volver a cifrar" (see Suggestion 1).

---

## Acceptance criteria (refined.md §11)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | New passphrase and kit open; old ones give `WRONG_PASSPHRASE`; content identical; `integrity_check` ok | met | `change-passphrase.use-case.test.ts` (locked and unlocked loop, recovery key); `sqlite-vault-rekeyer.test.ts` success block |
| 2 | `vault.json` byte-identical | met | `sqlite-vault-rekeyer.test.ts` success block |
| 3 | No `-wal`/`-shm`/`-journal`; mode `DELETE`; backup gone | met | rekeyer success test; fault-injection `readdirSync` = `[vault.db, vault.json]`. The EPERM path keeps the backup by design and flags it (§8.7 "flagged if left") |
| 4 | Generation +1, writer = this device | met | rekeyer success test; use-case last-seen assertions |
| 5 | Kit shown once with `Key issued`, no kit file; second `readRecoveryKit` is `null` | met | `change-passphrase-command.test.ts`; `vault-handlers.change-passphrase.test.ts`. Now also guaranteed when bookkeeping fails (C1 test) |
| 6 | Works locked and unlocked, both require the credential | met | use-case loop; `settings.tsx` both branches (662624e) |
| 7 | `--recovery-key` and the desktop toggle | met | use-case, command and DOM tests |
| 8 | Six refusals leave files and keychain byte-identical | met | use-case refusal block (`snapshotVaultFiles`, keychain unchanged, rekeyer never called) |
| 9 | Behind schema re-keyed, `schema_version` unchanged | met | rekeyer and use-case tests |
| 10 | Cloud folder: CLI refuses without `y`/`--yes`; desktop checkbox blocks | met | command tests; DOM "cloud folder". Stronger now: an unknown cloud state also blocks (W2 test) |
| 11 | Kill at every boundary or mid-rekey → old or new opens, or the backup opens with old | met | `sqlite-vault-rekeyer.fault-injection.test.ts` (unchanged by the fix, green) |
| 12 | Simulated write failure → `REKEY_FAILED`; old credential opens | met | fault-injection `ulimit -f`; rekeyer failure block |
| 13 | Leftover backup flagged by status, doctor, Diagnostics, Sync; counted by relocation | met | unchanged; the new C1 test also asserts `FileVaultFolder` reports it |
| 14 | After success the keychain holds the new key; MCP `get_context` works without re-unlock | met | `change-passphrase.surfaces.test.ts` |
| 15 | Keychain write fails after commit → success, locked, "unlock with new passphrase" | met | use-case keychain-refusal test; command test; `session-state.test.ts` |
| 16 | A write lock makes the rekey wait, then fail busy; an old-key session fails closed | met | rekeyer busy test; surfaces race test |
| 17 | Mode P handle → `VAULT_LOCKED`; SDK adapter untouched | met | surfaces test (`RecordingKeychain`, prototype spy) |
| 18 | **The keychain never holds the old key after commit** | **met** | `setKey` throwing (use case), the race (surfaces), and now `recordSeen`/`recordActivity` throwing (C1/W1 tests). The backup-delete throw is absorbed in the adapter (rekeyer C1 test). Residual OS-level case: Warning 1 |
| 19 | Second device: `VAULT_LOCKED`; old → `WRONG_PASSPHRASE` + hint; new → fast-forward | met | `change-passphrase.multi-device.test.ts` |
| 20 | Divergent old-key copy → fork; docs explain | met | multi-device test; `docs/sync.md` |
| 21 | CLI command + IPC channel + parity pair; no MCP or SDK surface | met | `build-program.ts`, `channels.ts`, `valija-guide.ts`, `server.test.ts` (5 tools), surfaces test |
| 22 | `en`/`es` copy for the three codes; catalog parity; `resetWorkspaceView()` | met | catalogs and error-copy tests green (the new keys `cloudUnknown`, `failedUnresolved` and `unexpected` exist in both); `app.shell.test.ts` |
| 23 | Docs in the same commit | met | the fix commit updates `specs/vault.md`, `specs/desktop.md`, `docs/flows/change-passphrase.md`, `docs/gui.md`, `docs/sync.md`, `.context` flows and gotchas, and the regenerated guide. `docs:check` and `context:check` are green |
| 24 | Loops green; no new dependency; no network | met | reviewer run above |

**24 / 24 met.**

## Gate check

| Gate | Result |
|---|---|
| Security surface | **No breach.** No secret is logged. Rekeyer messages are code-only (`failureCode`). The raw-key `rekey="x'…'"` form and its source-scan pin are unchanged. The IPC adds only a boolean flag, with no message or path. The response has no `keyHex`, and the kit crosses through the one-shot slot. SQLCipher is always keyed via `openVaultDb`. MCP and SDK are unchanged. Key derivation and keychain use are unchanged apart from the C1 reordering, which strictly narrows the old-key window |
| Tests for new behaviour / suite passing | Every fix has a test (4 root, 10 desktop). Both suites are green |
| Ritual | OK |
| Naming / placement | OK. `RekeyUnresolvedError` and `rekeyUnresolvedErr` live in the per-module `domain/errors.ts`, following the `VaultSchemaTooNewError`/`schemaTooNewErr` precedent. `CloudState` is a component-local type. No new files and no bare layer-root files |
| CLI ↔ desktop parity | OK. Both surfaces now distinguish an unresolved failure: the CLI through the message, which names the backup; the desktop through the flag |

---

## Issues

### Critical
None.

### Warnings (non-blocking; worth a follow-up)

**W1. A keychain that refuses both `setKey` and `deleteKey` still leaves the old key, silently.**
- **Where:** `storeNewKey` (`change-passphrase.use-case.ts:119-127`).
- **Why it happens:** `storeNewKey` ignores `deleteKey`'s boolean, and `OsKeychain.deleteKey` swallows every error.
- **Effect:** if the OS keychain refuses every write (a denied macOS prompt, a locked Secret Service), the old key stays, and the user is told "LOCKED on this device".
- **Why it is not blocking:** the key is inert against the new `vault.db`. The next session gets `NOTADB` and drops it, so it fails closed. No code can override an OS that refuses all writes.
- **Docs:** they state the absolute claim "the keychain holds the new key or none, never the old one" (`specs/vault.md`, `.context/gotchas.md`).
- **Fix:** follow `deleteKey` with a `getKey` probe. If the old key is still present, add a line to the outcome, e.g. a `keychainStale` flag that prompts "remove the `valija` entry from your OS keychain". Or soften the docs to say "unless the OS keychain refuses every change".

**W2. A success that kept the backup is silent at the moment of success.**
- **Where:** the EPERM path (`dropBackup`).
- **What happens:** the user gets "Passphrase changed" with no mention that an old-passphrase copy (`vault.db.pre-rekey.bak`) sits next to the vault. That matters to someone who is rotating a leaked passphrase. It is flagged later by `status`, `doctor` and Sync, which satisfies §5.4 and §8.7, so this is not a spec breach.
- **Fix (cheap):** retry the delete (`rmSync(…, { maxRetries: 3, retryDelay: 200 })`), then return whether the backup was kept, e.g. `LineageStamp & { backupKept: boolean }` or an output field. The CLI and the desktop then print one line pointing to `valija doctor` or Sync & safety.

**W3. `RekeyUnresolvedError` leaves the old key in the keychain.**
- **When:** an unlocked vault where verify failed and the restore rename also failed.
- **Problem:** `vault.db` may then hold the new key, and only the kept backup opens with the old one.
- **Why it is not blocking:** this fails closed at the next session (`NOTADB` → drop).
- **Fix:** `deleteKey` on an unresolved failure, so the state is honest, "locked", right away. It costs nothing, because restoring the backup requires an unlock with the old passphrase anyway.

### Suggestions

- **S1.** In `es.changePassphrase.failedUnresolved`, replace "previa al recifrado" with "previa al nuevo cifrado" or "anterior al cambio", to match the catalog's "volver a cifrar" vocabulary.
- **S2.** Still open from the first pass: S1 (the domain `folder-settlement.ts` importing an application port type), S2 (trim `--recovery-key` in `resolveUnlockKey`), and S3 (assert that at least one CI mid-rekey kill hit a hot journal).
- **S3.** `if (unlocked)` followed by a wrapped statement without braces (`change-passphrase.use-case.ts:136-137`) reads awkwardly. Braces or a single line would read better.
- **S4.** On the desktop `unexpected` path, the app does not re-query the vault phase. A rejection now can only happen before the commit, so the displayed state is right, but calling the existing refresh would make that hold without relying on the reasoning.

---

## What would change this verdict

Nothing currently blocks the merge. A FAIL would follow only if the post-commit path in
`ChangePassphrase.execute` regained a throwing call before `storeNewKey`, if `toIpcResult` began
forwarding `error.message`, or if either loop went red.
