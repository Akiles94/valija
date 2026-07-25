Verdict: PASS

# M3 — Bring-your-own-cloud vault sync · Change Review (re-review)

Re-review of `feat/sync-M3` at HEAD (`f10b2e9`) against base
`claude/mobile-multiplatform-availability-epie1a` (`83cae10`), after the implementer's
fix commit `2fcf51f` addressing the prior FAIL. Reviewed the full diff against
`refined.md` §7 and `plan.md`, not against commit messages.

## Gate/ritual status

- Gate R: `advances/M3/refined.md` present, "Approved at Gate R — Oscar 2026-07-23". OK.
- Gate P: `advances/M3/plan.md` first line `Approved: Oscar 2026-07-23`. OK.
- Review: this file (`review.md`) is the only writable output. OK.

## Build/verification (run by the reviewer)

- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0 (the single "info" is a pre-existing biome-config migration
  notice, not a code finding).
- `npm run test` → 47 files, **231 tests, all passing** (6.1s).
- No `.only` / `.skip` / `.todo` anywhere in `src/`.
- MCP `src/delivery/mcp/server.ts` byte-for-byte unchanged (diff stat empty).
- No `synchronous=OFF`, no `node:http/https/net/dgram`, no `fetch(` in production `src/`.

## Line count (diff vs base, `src/`)

| Bucket | Added | Deleted |
|---|---|---|
| Production (`src/**` non-test) | 1047 | 70 |
| Tests (`src/**/*.test.ts`) | 1309 | 29 |
| Docs + specs + README/CHANGELOG | 765 | 54 |

Production came in above the plan's ~800 estimate but the shape matches the plan; test
volume (1309) is well above the ~650 estimate, in the safe direction.

## Prior findings — verified resolved in current code

| Prior | Was | Now | Evidence |
|---|---|---|---|
| C1 (crit) | conflicted-copy regex didn't match real Dropbox names | `/conflicted[ -]?copy/i` + `/\.sync-conflict-/i`; OneDrive `-hostname` intentionally unmatched, documented | `src/vault/infra/file-vault-folder.ts:19`; test `file-vault-folder.test.ts:42-79` asserts the real `vault (Oscar's conflicted copy 2026-07-23).db` matches |
| C2 (crit) | `lock` printed "single file … safe" unconditionally | reassurance only when `sidecars.length === 0`, else "NOT safely at rest" warning, never both | `src/delivery/cli/vault-commands.ts:67-78` |
| C3 (gate) | `file-vault-folder.test.ts` missing | present, covers all four `inspect()` fields (sidecars/conflictedCopies/staleBackups/looksLikeCloud) against real vendor filenames | `src/vault/infra/file-vault-folder.test.ts` |
| W1 | cloud detection case-sensitive, no markers | lowercased path markers + `.dropbox/.stfolder/…` marker files | `file-vault-folder.ts:8-12,58-62`; test `:100-116` |
| W2 | last-writer device id computed then discarded | `writerLabel` helper surfaced in lock/status/doctor | `src/delivery/cli/render.ts:14-21`, `render.test.ts`; used in `vault-commands.ts:63,97`, `doctor.ts:111` |
| W3 | no genuinely-dangling `-wal` test | spawns a real writer, SIGKILLs it mid-flight, proves fold+recover | `src/shared/infra/upgrade-wal.test.ts:139-173` |
| W5 | doctor recomputed status per check | status computed once, shared across the M3 checks | `doctor.ts:145-160` |
| W6 | VaultStatus opened db twice | single `readLineage` open; key verify folded into it | `vault-status.use-case.ts:64-75` |
| W7 | non-atomic device-state write | write-tmp-then-`renameSync`, `mode 0o600` | `file-device-identity.ts:87-96` |
| W8 | stale `.pre-NNN.bak` invisible | `staleBackups` reported; doctor + `docs/sync.md` flag it | `file-vault-folder.ts:24,35`; `doctor.ts:85-89` |
| S2 | untyped error ctor | `vaultError(code, message)` typed against `VaultErrorCode` | `src/vault/domain/errors.ts:17-19` |
| S3/S4 | commitWrite cleanup / ok-err | sentinel rollback + `ok`/`err`; last-seen only after commit | `context/infra/vault-sessions.ts:115-139` |
| S6 | `parseGeneration` too loose | rejects `""`, `"0x10"`, `"1e3"` via `^\d+$` guard | `generation.ts:12-25` |
| S7 | idle clock not started at init | `recordActivity` on create | `create-vault.use-case.ts:49-50` |

## Deliberately-not-changed items — judged acceptable

- **S1** `parseAutoLockTtl` returns `number | null`, not a `Result` — explicitly approved
  in the plan (Slice 6/24). A malformed TTL falling back to the 15-min default rather than
  failing the CLI is the safer behaviour for a safety-net feature. Accept.
- **S8** `SessionGuard.guard()` refreshes activity at session **open**, not on "successful
  command" (plan D-6 wording). Because all input parsing is parse-don't-validate *before*
  a session opens (`save-context.use-case.ts:45-48`), a session that opens is effectively
  the command succeeding; the deviation is a wording gap, not a behaviour bug. Accept.
- **S9** `upgrade-wal.test.ts` location under `shared/infra/` — co-located with the code it
  exercises (`sqlite.ts`/`migrations.ts`), consistent with the repo's co-location rule. Accept.

## Acceptance criteria (refined §7)

| Criterion | Status | Evidence |
|---|---|---|
| Single `vault.db`, no sidecars after any command/lock | Met | `sqlite.ts:26-28` DELETE; `sqlite.test.ts:57-85`; `lock-vault.test.ts:37` |
| Bare `vault.db` loses no committed data | Met | `sqlite.test.ts:76-84` (copy + reopen) |
| `synchronous` not weakened to OFF; crash recoverable | Met | no `synchronous=OFF` in tree; `upgrade-wal.test.ts:139-173` SIGKILL recovery |
| Each write bumps generation + fresh stamp; header unchanged | Met | `sqlite-lineage-store.ts:45-57`; `vault-sessions.test.ts`; header still `schemaVersion:1` (`vault-store.ts:8`) |
| Two-device clean A→B and B→A fast-forward | Met | `multi-device-sync.test.ts:89-117` |
| Divergence → `VAULT_FORK_DETECTED`, nothing deleted, both copies open | Met | `multi-device-sync.test.ts:119-163`; `unlock-vault.test.ts:111-132` |
| Device/last-seen/activity outside `VALIJA_HOME` | Met | `state-paths.ts:14`; `multi-device-sync.test.ts:191-207` |
| `lock` verifies single file, drops key, prints generation | Met | `lock-vault.use-case.ts:28-38`; `vault-commands.ts:49-79` |
| `status` reports single-file/generation/writer/TTL, not in pack | Met | `vault-status.use-case.ts`; `mcp/server.test.ts:181-206` |
| TTL elapsed → key dropped + `VAULT_LOCKED`; fresh unlock continues | Met | `session-guard.ts:31-35`; `multi-device-sync.test.ts:165-189` |
| Within-TTL activity refreshes; timestamp device-local | Met | `session-guard.ts:37`; `session-guard.test.ts`; `file-device-identity.test.ts` |
| TTL configurable (default 15) + disable (`0`/`off`); visible in status | Met | `auto-lock-ttl.ts:10-18`; `auto-lock-ttl.test.ts`; `vault-commands.ts:100-110` |
| Doctor: journal/single-file, sidecar/conflicted/cloud/TTL | Met | `doctor.ts:65-125` |
| `VALIJA_HOME` placement needs no code change; no `--cloud` branch | Met | `vault-paths.ts` unchanged; `--cloud` deferred (D-5) |
| Populated WAL vault upgrades; content + FTS identical; backup taken/removed | Met | `upgrade-wal.test.ts:80-107`; `003-lineage.test.ts` |
| Forced mid-upgrade failure leaves prior state intact, backup kept | Met | `upgrade-wal.test.ts:109-137` (`.pre-002.bak` kept, `.pre-003.bak` absent) |
| No network/telemetry/daemon/OS hooks | Met | grep clean; auto-lock lazy at command time |
| MCP surface byte-for-byte unchanged; no sync data in responses/pack | Met | `server.ts` unchanged; `server.test.ts:89-100,181-206` |
| Crypto path unchanged; second device opens with same passphrase | Met | `openVaultDb` keying unchanged; `multi-device-sync.test.ts` uses one key across devices |
| Docs/specs updated (SPEC §2/§10b/§12-Q3, shared/vault/delivery, docs/sync.md) | Met | `docs/SPEC.md`, `specs/*.md`, `docs/sync.md:1-138` |

All criteria met.

## Hard gates

- Security surface: no key/secret logged (only the intended one-time recovery kit at
  `init`, unchanged); lineage lives in the encrypted `meta`, header gains nothing; device
  state is non-secret and non-synced (`state-paths.ts`); SQLCipher keyed before any pragma
  (`sqlite.ts:19-27`); rollback journal keeps `synchronous` default. No breach.
- Tests: present for every new behaviour; suite green (231/231). No breach.
- Ritual: refined.md (Gate R) → plan.md with `Approved:` line (Gate P) → this review.md. OK.
- Conventions/placement: value objects in `domain/values/`, service in `domain/services/`,
  `SessionGuard` in the new `application/policies/` subfolder, ports in
  `application/ports/`, tech-named `Sqlite*/File*` adapters in `infra/`. `state-paths.ts`
  sits beside the established `vault-paths.ts` bare file in the shared persistence kernel —
  consistent with the standing exception. No breach.

## Issues

### Critical
None.

### Warning
None.

### Suggestion (non-blocking; do not gate merge)
1. `src/delivery/cli/doctor.ts:146` — the comment "each call opens the SQLCipher db
   (twice)" is stale after the W6 single-open fix; `VaultStatus.execute()` now opens the db
   once. The optimisation (compute status once) is still valid; only the parenthetical count
   is wrong. Reword to "(once)".
2. `WriteStamp`/`DeviceId` are opaque non-empty strings rather than ULID-shape-checked as
   the plan's Slice 2 wording suggested (`write-stamp.ts:13-19`, `device-id.ts:13-19`). The
   choice is documented and internally consistent with how the codebase treats opaque
   IdGenerator output, and fork detection only needs equality + uniqueness, so it is safe —
   noted only as a plan/wording deviation.
3. `ImportItems` where *every* chunk fails still returns `ok(...)` inside `session.write`,
   so the transaction commits and bumps the generation for a no-op import
   (`import-items.use-case.ts:56-68`). Benign — generation is opaque per plan assumption 6
   — but a guard to skip the bump when `imported === 0` would avoid an empty lineage step.

None of the above blocks the merge. Verdict stands at PASS.
