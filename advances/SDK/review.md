Verdict: PASS

# SDK — change review

**Reviewed:** `git diff feat/secret-warning-SECRET-WARN...HEAD` on `feat/sdk-SDK` (13 commits, `d2b072c` … `f90d534`), against `advances/SDK/refined.md` (Gate R approved) and `advances/SDK/plan.md` (`Approved: Oscar 2026-10-21` on line 1; P-18 = (b), the rest (a)).

**Ritual trail:** `refined.md` (Gate R status line) → `plan.md` with its `Approved:` line (commit `de245fd`, which comes before any `src/**` commit) → `spike.md` (Slice 0) → this file. Each slice is its own commit, and the docs ship in the same commit as the code.

## Verification run by the reviewer

| Check | Result |
|---|---|
| Root `npm run typecheck && npm run lint && npm run test` | pass: 111 files, 1074 tests (lint: 1 biome-config *info*, which predates this advance) |
| `desktop/` `npm run typecheck && npm run lint && npm run test` | pass: 73 files, 1210 tests |
| `npm run build` | pass: `dist/program.js`, `dist/sdk.js`, a shared chunk, and `dist/types/delivery/sdk/index.d.ts` |
| `npm run smoke:sdk` | pass, all 9 steps: pack, clean consumer, `nodenext` types with `skipLibCheck` off, inert import, create → save → pack, `--version` 0.3.0, no commander or MCP in the sdk graph |
| Lint and typecheck again, with `dist/types` present | pass |
| `git status` after build and smoke | clean |
| Slice 11 step 2: migrations, golden fixture, `context-pack-markdown.ts`, `context-pack.ts` | empty diff |
| Step 3: `package.json` | only `exports` and `scripts` changed; `package-lock.json` and `desktop/package.json` have empty diffs |
| Step 4: `mcp/server.ts`, `cli/program.ts`, `ipc/channels.ts`, `preload/` | empty diff |
| Steps 5, 6, 7, 9, 10 (greps) | no matches |
| Step 8, `setKey` in `src/delivery/sdk` | matches **only in test assertions**. No production match. The intent holds, so I accept this deviation. |
| IPC channels | 37 unique channel strings in `channels.ts`, unchanged |
| MCP | 5 `registerTool` + 2 `registerPrompt`; `server.test.ts` "exactly the 5 tools and 2 prompts" passes. Its diff is only the two F11 fields. |
| CLAUDE.md | exactly one added line under *Surface parity*, with the approved wording |

## Line count

| Area | Added / removed |
|---|---|
| `src/` production (excluding tests and `src/testing`) | +1,081 / −75 |
| `desktop/src` production | +230 / −15 |
| Build config (`package.json`, `tsup.config.ts`, `tsconfig.sdk.json`) | +28 / −3 |
| `scripts/sdk-pack-smoke.mjs` | 180 |
| Tests | +3,576 |
| Test support (`src/testing`) | +136 |
| Docs (docs, specs, README, CHANGELOG, CLAUDE.md) | +500 |

Production comes to about 1,340 lines, against the plan's ~1,035 (range 940–1,130). Most of the overrun is doc comments and the extra desktop wiring. This is not a gate.

## Acceptance criteria (refined §13)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Mode K save/handoff visible in `show`, MCP `get_context`/`search_context` and desktop, with `source` = client | met | `sdk-round-trip.test.ts:82`, `:109`. The desktop's `content:show` calls the same `showProject` use case over the same `buildContainer` (`content-handlers.ts:36`). |
| 2 | CLI/MCP content visible to the SDK; pack byte-identical; `listProjects` parity | met | `sdk-round-trip.test.ts:123`; `vault-handle.ts` (getContextPack → `renderContextPackMarkdown`) |
| 3 | Resolution `vaultRoot` → `VALIJA_HOME` → `~/.valija`; shared state; no other file | met | `sdk-round-trip.test.ts:203`, `:218`; `vault-lifecycle.test.ts:105` |
| 4 | Mode K: locked → `VAULT_LOCKED`; expiry drops the OS key; `lock()` locks the CLI | met | `vault-lifecycle.test.ts:53`, `:80`, `:92` |
| 5 | No pin/edit/archive/list-items/export/status in the public types | met | `dto/results.ts` `ValijaVault`; `vault-handle.test.ts:279`; Slice 11 step 7 grep is empty |
| 6 | Passphrase and recovery key open; wrong → `WRONG_PASSPHRASE`; both → validation error | met | `vault-lifecycle.test.ts:114`, `:129`, `:138`, `:148`; `sdk-schemas.ts` refine |
| 7 | §11.1: zero OS-keychain calls; CLI `status` locked; MCP `VAULT_LOCKED` | met | `keychain-isolation.test.ts:63`, `:92` (0 constructions, 0 calls, then `expectOtherSurfacesLocked`); `container.ts:92` (`options.keychain ?? new OsKeychain()`) |
| 8 | Mode P activity never shared; the OS session still auto-locks | met | `in-memory-activity-device-identity.ts`; `keychain-isolation.test.ts:107`; `vault-handle.test.ts:246` |
| 9 | TTL proactive and lazy; `0`/`off`; unref'd | met | `idle-lock-timer.ts` (`timer.unref()`); `idle-lock-timer.test.ts:68`; `vault-handle.test.ts:219`, `:229`, `:238` |
| 10 | `lock()`/`close()` drop the in-process key; later `VAULT_LOCKED`; OS session unaffected | met | `vault-handle.ts` `forgetKey`/`lock`/`close`; `vault-handle.test.ts:205`, `:212` |
| 11 | Fork → non-fatal `forkNotice`, nothing deleted | met | `vault-lifecycle.ts` `openInProcess`; `vault-lifecycle.test.ts:188` |
| 12 | `createVault` → CLI unlock by passphrase and by the kit's hex; header/KDF = init | met | `sdk-round-trip.test.ts:164`; `vault-lifecycle.test.ts:286` |
| 13 | Kit = `renderRecoveryKit`; no kit file | met | `vault-lifecycle.test.ts:300`; `sdk-round-trip.test.ts:218` |
| 14 | `VAULT_ALREADY_EXISTS` leaves files untouched; `WEAK_PASSPHRASE` writes nothing | met | `vault-lifecycle.test.ts:311`, `:323` |
| 15 | The returned handle is Mode P (§11.1) | met | `keychain-isolation.test.ts:92` (`mode === "in-process"`, zero OS calls) |
| 16 | Secret → `POSSIBLE_SECRET`, nothing written, no override in types | met | `vault-handle.test.ts:100`; fields mapped one by one in `vault-handle.ts` save |
| 17 | `imported` rejected; `supersedes` as on MCP | met | `sdk-schemas.ts` (`z.enum(ITEM_TYPES)`); `vault-handle.test.ts:89`, `:113`, `:126` |
| 18 | No DTO or error carries key hex, passphrase or refused content (serialization test) | met | `vault-handle.test.ts:254`; `to-valija-error.test.ts:28`, `:43`; `sdk-schemas.test.ts:133` |
| 19 | `LATEST+1` refused on CLI unlock and every content command incl. export, every MCP tool, desktop unlock and handlers, `CheckVaultUpgrade`, SDK Mode P open, every Mode K op | met | `cli/schema-guard.test.ts:117-130` (14 commands); `server.schema-guard.test.ts:48-52` (5 tools); `content-handlers.session-safety.test.ts` (6 handlers) + `to-ipc-result.test.ts` + `lock-aware-bridge.test.ts`; `unlock-vault.schema-guard.test.ts`; `sdk-schema-guard.test.ts:78`, `:111`. CLI `unlink`/`links` and desktop `content:edit`/`content:export`/import/bindings are not exercised one by one, but they all go through `withSession` → `SqliteVaultSessions.open` → `openVaultDb`'s refusal (see W3). |
| 20 | Bytes unchanged, no `.pre-*.bak`, both keychains unchanged, OS key still present | met | `snapshotVaultFiles` equality and keychain assertions in the files above; `vault-sessions.test.ts` (newer schema, with and without TTL expiry: key kept); `sdk-schema-guard.test.ts` (`state.json` byte-equal, in-memory `setKey` never called) |
| 21 | `status`/`doctor`/Diagnostics report it non-fatally; `lock` still drops the key | met | `vault-status.use-case.ts` `tooNewStatus`; `diagnostics.ts` `checkVault` (no `fatal`); `cli/schema-guard.test.ts:151`, `:161`, `:173`; `lock-vault.use-case.test.ts`; `diagnostics-handlers.test.ts` |
| 22 | The migration runner refuses (backstop) | met | `migrations.ts` `migrate` → `refuseNewerSchema` first; `migrations.test.ts` |
| 23 | Desktop `en`/`es` copy, no unlock loop, no upgrade-confirm screen; `catalogs.test.ts` passes | met | `schema-too-new.tsx`; `session-state.ts` (`afterStatusCheck` checks `schemaTooNew` first); `unlock-outcome.test.ts`; `schema-too-new.dom.test.tsx`; desktop suite green |
| 24 | Behind vault, both modes → `VAULT_UPGRADE_REQUIRED`, nothing migrated | met | `vault-sessions.ts` `prepare`; `vault-lifecycle.test.ts:232`, `:245` |
| 25 | `allowUpgrade` → migrated via the shared runner with its backups | met | `vault-lifecycle.test.ts:256` |
| 26 | CLI/MCP auto-migrate unchanged | met | `vault-sessions.test.ts` "by default a behind vault is migrated"; `vault-lifecycle.test.ts:277`; `unlock-vault.upgrade-gate.test.ts` unmodified |
| 27 | Four §8 concurrency tests; no false fork; no sidecar | met | `sdk-concurrency.test.ts:122`, `:135`, `:150`, `:171` |
| 28 | Tarball import resolves; `nodenext` types | met | `npm run smoke:sdk` steps 2–5, 7 |
| 29 | Import inert; no CLI/MCP load; bin works | met | `sdk-import-inert.test.ts`; `sdk-module-graph.test.ts`; smoke steps 6, 8, 9 |
| 30 | `docs/sdk.md`: both modes, createVault + kit obligations, every code, honest limits, schema version, tested example | met | `docs/sdk.md` (all 23 codes present; "schema 4" at :14/:260; JS-string limit at :299); `docs-example.test.ts` |
| 31 | README, SPEC §1/§3/§10, specs ×3, vault-format, CHANGELOG, CLAUDE.md line in the same commit | met | per-slice commits; `CLAUDE.md` +1 line; SPEC hunks at §1, §3, §8, §10 |
| 32 | No new runtime dependency, network call, MCP tool/argument, CLI command, IPC channel or migration | met | Slice 11 steps 2–4; 37 channels; `sdk-module-graph.test.ts:61`, `:71` |
| 33 | Loops green at root and in `desktop/` | met | see the run above |

## Hard gates

No breaches.
- **Security surface:**
  - Mode P and `createVault` never construct `OsKeychain` (`container.ts:92`).
  - Mode K never calls `setKey`.
  - No key, passphrase or kit appears in any DTO, error, log or file. `toValijaError` returns a plain `{code, message}`, and `unexpectedError` never copies thrown text.
  - SQLCipher keying is unchanged: `applyKey` is the old three statements, moved verbatim.
  - The KDF is unchanged. `argon2.ts` now only zeroes its own buffer after copying it.
  - The MCP surface is unchanged.
- **Tests:** present for every new behaviour, and all suites pass.
- **Ritual:** evidenced.
- **Placement:**
  - `shared/domain/services/`
  - tech-named `vault/infra/in-memory-*.ts` adapters
  - `delivery/sdk/{facade,dto,mapping,validation}/`
  - SDK integration tests beside the entry (precedent: `delivery/multi-device-sync.test.ts`)
  - test support under `src/testing/`

  No loose file sits at any `domain/application/infra` root.

## Reported deviations: judgement

1. **`BEGIN IMMEDIATE` in `commitWrite` (`vault-sessions.ts:181-191`): correct and safe.**
   - **Nesting.** There are no nested transactions. The only other `db.transaction` is inside `migrate`, which runs during `prepare`, never inside a write. If a caller ever nested `.immediate()` inside an open transaction, better-sqlite3 would turn it into a `SAVEPOINT`.
   - **Read-then-write paths.** The reads that use cases do before `session.write` run in autocommit, and on this rollback journal they release `SHARED` straight away. So the `RESERVED` acquisition at `BEGIN IMMEDIATE` goes through the busy handler, which is the whole point. The old deferred `BEGIN` → read → upgrade path is the one SQLite refuses at once to avoid deadlock.
   - **Failure handling.** A `SQLITE_BUSY` at `BEGIN` throws before any state exists. A busy `COMMIT` leaves `db.inTransaction` true, so better-sqlite3's wrapper rolls back before rethrowing, and the stamp bump is rolled back with it. Both map to `BUSY_MESSAGE`.
   - **Effect on other surfaces.** It changes CLI/MCP/desktop write contention from instant failure to a wait of up to 5 s. The CHANGELOG documents this.
2. **`initializeDb` maps only `SchemaTooNewError`:** justified. A wrong-key mapping is meaningless on a fresh file, and the plan required the "Could not create vault db" message to stay.
3. **`prepare()` wraps `migrate` in try/catch:** fine. However, see W1 for what is now *outside* any try.
4. **Handle-specific `VAULT_LOCKED` messages, and unlisted codes → `STORAGE_ERROR`:** fine. The messages carry no secret, and the codes stay inside the closed union.
5. **`startIdleLockTimer`:** the optional `now`, the delay capped at the `setTimeout` ceiling, and counting from start when there is no activity are all sound. Each is tested (`idle-lock-timer.test.ts:42`, `:80`).
6. **`createVault` with `autoMigrate:false`; `index.ts` exporting types plus two functions only:** fine.
7. **Empty `-wal`/`-shm` left on legacy pre-0.3.0 WAL vaults by the read-only probe:** acceptable, but see W2.
8. **Step 8 grep matching only test assertions:** accepted (see the table above).

## Issues

### Critical
None.

### Warning

- **W1. `SqliteVaultSessions.open` can now leak an open connection** (`src/context/infra/vault-sessions.ts`, `open` / `prepare` / `sessionOver`).
  - The database is now opened *before* the idle guard. Three things run while it is open and outside any `try`:
    - `schemaVersion(db)` in `prepare`
    - `this.guard.guard(vaultId)`, which can throw from a `state.json` write or from `OsKeychain.deleteKey`
    - repository construction in `sessionOver`
  - If any of them throws, `open()` neither closes `db` nor maps the error. Before this advance the guard ran before any connection existed, and the repositories were built inside the catch.
  - The cost is an fd leak in long-lived processes (MCP server, desktop main, SDK host), plus raw throws instead of `STORAGE_ERROR` on the CLI and MCP.
  - **Fix:** in `open()`, wrap `prepare` + `sessionOver` in `try { … } catch (e) { db.value.close(); throw e; }`, or map busy to `BUSY_MESSAGE` the way `openDb` does. Also add a test where the guard's identity throws and the connection is closed.
- **W2. Refused SDK and desktop calls can leave empty sidecars on legacy WAL vaults** (`src/shared/infra/sqlite.ts` `readOnlySchemaVersion`).
  - On a pre-0.3.0 WAL vault, the read-only probe creates `-wal`/`-shm`.
  - When the open is then refused (`VAULT_UPGRADE_REQUIRED` on a Mode P open without `allowUpgrade`, or a declined desktop upgrade), the sidecars stay in a possibly synced folder. That conflicts with §8's "no sidecar remains after any SDK call", for this legacy case only. It is self-healing at the next accepted open, and the spike documents it.
  - **Fix:** record which sidecars exist before the probe, and after `close()` unlink any zero-length `-wal`/`-shm` the probe created. Add a test on the `upgrade-wal` fixture.
- **W3. The refusal tests leave out a few commands and handlers, and one test name overclaims.**
  - Not covered one by one:
    - CLI `unlink` and `links` (missing from `cli/schema-guard.test.ts:117-130`)
    - desktop `content:edit` and `content:export`
    - the import and bindings handlers
  - The test titled "every content handler…" (`content-handlers.session-safety.test.ts`) covers 6 of them.
  - The behaviour holds structurally: all of them go through `withSession` and `toIpcResult`, which I verified. Still, add the rows, or rename the test to match what it covers.

### Suggestion

- **S1.** `resolveUnlockKey` (`vault/application/services/resolve-unlock-key.ts`) never zeroes the derived `Uint8Array` after `bytesToHex(key)`. Zeroing it is a one-line `key.fill(0)` that finishes the P-16 intent on the Mode P path.
- **S2.** A busy `migrate` inside `prepare` maps to the generic "Could not open vault" message instead of `BUSY_MESSAGE`. Use `isBusyError` there too, for consistency with `openDb` and `commitWrite`.
- **S3.** `desktop/src/shared/ipc/messages.ts:4-15`: the existing `IpcResult` JSDoc is now orphaned above the new `SchemaVersionsMessage` doc block, so `IpcResult` lost its documentation. Move `SchemaVersionsMessage` above the old comment.
- **S4.** `facade/idle-lock-timer.ts` is a timing policy, not a facade. Consider `delivery/sdk/policies/idle-lock-timer.ts`, which mirrors `vault/application/policies/`.
- **S5.** `withLockDetection` now routes two session states. The plan's own alternative name, `withSessionRouting`, would read truer. Defer it to a cleanup advance, since it touches existing call sites.
- **S6.** `keychain-isolation.test.ts` checks that CLI and MCP are locked only after the Mode P handles were closed or had expired. It would be stronger to also assert it *while* a Mode P handle is open. The zero-`setKey` record already implies it.
- **S7.** `es.ts` `schemaTooNew.howToFix`: in "vuelve a abrirla", the pronoun refers to "Valija Desktop" only implicitly. "…y vuelve a abrir la aplicación." is clearer.

## What would flip this to FAIL

Nothing currently does. A later change would need to break a §13 criterion or a hard gate: any OS-keychain construction or call on the Mode P or create path, a migration without `allowUpgrade`, or a refusal path that writes to the vault.
