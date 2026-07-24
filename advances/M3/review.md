Verdict: FAIL

# M3 — Bring-your-own-cloud vault sync · Change review

**Branch:** `feat/sync-M3` · **Base:** `claude/mobile-multiplatform-availability-epie1a` (merge-base `83cae10`)
**Reviewed:** the full diff `83cae10...ce35816` (9 implementation commits), against
`advances/M3/refined.md` (Gate R, approved 2026-07-23) and `advances/M3/plan.md`
(Gate P, `Approved: Oscar 2026-07-23`).

This is a strong advance. The architecture is right, the module boundaries hold, the
security surface is not weakened anywhere I could find, and the docs/specs are unusually
honest. It fails on a hard gate — a planned test file that does not exist — and that gap
is not cosmetic: it hides a real functional defect in the very behaviour it was meant to
cover (Dropbox conflicted-copy detection does not work). Two more user-facing defects and
a set of efficiency/robustness issues are listed below.

---

## 1. Line count

| Bucket | Added | Deleted | Plan estimate |
|---|---|---|---|
| `src/**` production (non-test) | 950 | 61 | ~800 |
| `src/**` tests | 1076 | 31 | ~650 |
| `docs/`, `specs/`, `CHANGELOG.md` | 252 | 26 | ~250 |
| **Total** | **2278** | **118** | ~1700 |

57 files touched. Over the estimate, mostly in tests, which is the right direction to
overshoot. No file is oversized; the largest new production file is
`src/vault/infra/file-device-identity.ts` at 91 lines.

## 2. Suite status

| Gate | Result |
|---|---|
| `npm run typecheck` | pass (clean) |
| `npm run lint` | pass — 138 files, 0 errors; 1 pre-existing `info` about migrating the biome config, unrelated to this diff |
| `npm run test` | pass — 45 files, 214 tests |
| `npm run build` | pass (`dist/program.js`, 100.75 KB) |

## 3. Advance ritual

| Requirement | Evidence |
|---|---|
| `refined.md` present | `advances/M3/refined.md` (658 lines), "Approved at Gate R — Oscar 2026-07-23", D-F Option A recorded |
| `plan.md` present with `Approved:` line | `advances/M3/plan.md:1` — `Approved: Oscar 2026-07-23` |
| Implementation only after approval | `83cae10 docs(M3): record Gate P approval` precedes `dedd345`, the first `src/**` commit |
| Branch name matches the plan | `feat/sync-M3` (plan.md:13) |
| `review.md` | this file |

Ritual satisfied.

---

## 4. Acceptance criteria (refined.md §7)

### At-rest single-file consistency (D-A)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| A1 | Single `vault.db`, no `-wal`/`-shm`/`-journal` at rest after **every** command | **Met** | `src/shared/infra/sqlite.ts:26-28` (checkpoint → `journal_mode = DELETE`); `src/shared/infra/sqlite.test.ts:186-214` asserts `journal_mode === "delete"` and all three siblings absent after close |
| A2 | Bare `vault.db` copy loses no committed data | **Met** | `src/shared/infra/sqlite.test.ts:205-213` copies only `vault.db`, reopens, reads the row back |
| A3 | `PRAGMA synchronous` not weakened to `OFF`; a simulated crash mid-write leaves a recoverable vault | **Partially met** | No `synchronous` pragma is set anywhere in `src/` (grep confirms) — that half is met. The "crash mid-write" half has **no test**: `src/shared/infra/upgrade-wal.test.ts:373-401` forces a *migration* failure (a transaction rollback in migration 002), which is not a crash and not a write. See W4. |

### Fork detection & lineage (D-B / D-C)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| B1 | Each write bumps generation + fresh stamp inside encrypted `meta`; `vault.json` unchanged | **Met** | `src/vault/infra/sqlite-lineage-store.ts:44-56`; `src/context/infra/vault-sessions.ts:118-143`; `src/context/infra/vault-sessions.test.ts:58-73`. `src/vault/infra/vault-header.ts` is untouched by the diff — `schemaVersion: z.literal(1)`, no new fields |
| B2 | Two-device clean A→B and B→A fast-forward | **Met** | `src/delivery/multi-device-sync.test.ts:100-127` |
| B3 | Divergence → `VAULT_FORK_DETECTED`, nothing deleted, both copies open with the same key | **Met** | `src/delivery/multi-device-sync.test.ts:129-176`; `src/vault/application/use-cases/unlock-vault.use-case.ts:59-76` returns the notice and skips `recordSeen` |
| B4 | Device/last-seen/activity record lives outside `VALIJA_HOME` | **Met** | `src/shared/infra/state-paths.ts:18-24`; `src/vault/infra/file-device-identity.test.ts:847-852`; `src/delivery/multi-device-sync.test.ts:193-207` |

### Handoff ritual (D-D)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| D1 | `lock` verifies single-file-at-rest, removes the key, prints an explicit "safe to switch" confirmation with the generation | **Not met** | The use case is correct (`src/vault/application/use-cases/lock-vault.use-case.ts:24-36`, tested at `lock-vault.use-case.test.ts:261-288`), but the CLI prints the at-rest claim **before and regardless of** the verify: `src/delivery/cli/vault-commands.ts:64-66` emits `On-disk state: single file (vault.db)` unconditionally, then line 68 contradicts it with `Warning: stray files present, not safely at rest`. Refined §6.5 requires the report "only print after the verify actually succeeded". See C2. |
| D2 | `status` reports at-rest state, generation, **last-writer id**, TTL/idle; none of it in `get_context`/`export` | **Partially met** | At-rest, generation, TTL and idle are all printed (`vault-commands.ts:85-103`) and tested (`vault-status.use-case.test.ts`). The **last-writer id is never surfaced** — `VaultStatusOutput.lastWriter` holds it, but the CLI collapses it to `this device`/`another device` (`vault-commands.ts:90`), so with three devices the user cannot tell which one wrote. Refined §1 step 3 shows `last written by device-A`. Non-leakage is covered by `src/delivery/mcp/server.test.ts:174-200`. See W2. |

### Idle auto-lock (D-I)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| I1 | TTL elapsed → next session open drops the key and returns `VAULT_LOCKED`; fresh unlock required | **Met** | `src/vault/application/policies/session-guard.ts:102-106`; `session-guard.test.ts:44-53`; `src/delivery/multi-device-sync.test.ts:178-191` (end-to-end with an injected clock) |
| I2 | Within TTL, activity refreshes and the vault stays unlocked; timestamp is device-local | **Met** | `session-guard.test.ts:33-42`; `file-device-identity.test.ts:837-845` |
| I3 | TTL configurable (default 15), disable via `0`/`off`, effective TTL visible in status/doctor; MCP returns the existing locked error | **Met** | `src/vault/domain/values/auto-lock-ttl.ts:10-17` + `auto-lock-ttl.test.ts`; `src/delivery/container.ts` wires `parseAutoLockTtl(process.env.VALIJA_AUTOLOCK_MINUTES)`; `SessionGuard` returns the exact `LOCKED_MESSAGE` literal now shared from `src/vault/domain/errors.ts:22` |

### Config & doctor (D-E)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| E1 | `doctor` reports journal mode + single-file, warns on sidecars, **recognizes a cloud folder by path/marker**, **warns loudly on a vendor "conflicted copy" file**, reports TTL/idle | **Not met** | `src/delivery/cli/doctor.ts:60-119` wires all five checks and they are advisory-only (correct). But the adapter behind two of them is wrong and untested: `FileVaultFolder.conflictedCopies` **does not match a real Dropbox conflicted copy** (C1), and `looksLikeCloud` implements only the path-substring half — the "or a vendor marker file" half of refined §5 D-E and plan step 28 is missing, and matching is case-sensitive (W1). `src/vault/infra/file-vault-folder.test.ts` — required by plan.md §9 (line 526) and plan.md §4 (line 341) — **does not exist**. |
| E2 | `VALIJA_HOME` placement needs no code change; `--cloud` deferred | **Met** | `resolveVaultPaths` untouched; `--cloud` deferred per plan D-5, documented in `specs/delivery.md` and `docs/SPEC.md` §10b |

### Upgrade (D-G)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| G1 | A populated **WAL** vault upgrades on next open: WAL folded in, journaling switches, lineage seeded, content + FTS identical | **Partially met** | `src/shared/infra/upgrade-wal.test.ts:344-371` proves the switch, schema 3, lineage seed, row content and FTS. It does **not** prove folding a live WAL: `buildLegacyWalVault` closes cleanly, and SQLite auto-checkpoints and removes `-wal` on last clean close, so there is nothing left to fold at the moment of upgrade. The test's own docblock (lines 309-324) admits this. `sqlite.test.ts:216-240` has the same limitation. Plan §2 step 40 explicitly required "leave a live `-wal`". See W3. |
| G2 | Ciphertext backup taken before touching populated data, removed only on success; forced mid-upgrade failure leaves prior state intact | **Met** | `src/shared/infra/migrations.ts:47-57` (`{ version: 3, sql: MIGRATION_003, backup: true }`); `003-lineage.test.ts:133-139`; `upgrade-wal.test.ts:373-401` asserts schema stays at 1, rows intact, `.pre-002.bak` kept and `.pre-003.bak` never created |

### Security & surface

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| S1 | No network call, no telemetry, no daemon, no OS hooks | **Met** | No new imports of `node:http(s)`/`net`/`fetch`/timers-based schedulers anywhere in the diff; `SessionGuard` is purely lazy at session open |
| S2 | MCP surface byte-for-byte unchanged; a test asserts no sync/lineage/session data reaches a tool response or pack | **Met** | `src/delivery/mcp/server.ts` is not in the diff at all. `server.test.ts:82-95` (pre-existing) asserts exactly 5 tools / 2 prompts; `server.test.ts:174-200` (new) asserts `get_context`/`search_context`/`list_projects` responses match none of `/generation/i`, `/lineage/i`, `/write.?stamp/i`, `/device.?id/i`, `/auto.?lock/i` |
| S3 | Crypto path unchanged; same passphrase opens the vault on a second device | **Met** | `argon2.ts`, `keyring.ts`, `recovery-kit.ts`, `vault-header.ts` untouched; `openVaultDb` still keys before any other statement and still verifies via `sqlite_master` *before* the new pragmas (`sqlite.ts:20-27`); `multi-device-sync.test.ts` opens both copies with the same key |

### Docs & specs (D-H)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| H1 | `docs/SPEC.md` §2 roadmap, new §10b, §12 Q3 resolved; `specs/{shared,vault,delivery}.md` updated in the same commit | **Met** | `docs/SPEC.md:39-46` (roadmap), `:54-103` (§10b), `:114-117` (Q3 struck and resolved); all three specs updated, plus `specs/context.md` for the `write()` seam; all in `ce35816` alongside the code |
| H2 | User-facing doc: placement, lock→sync→unlock ritual, auto-lock config, fork resolution | **Met** | `docs/sync.md` (117 lines) covers all four, plus an honest "what this does not do" |

---

## 5. Plan conformance

All nine slices landed. Deviations found, and how they read:

| Deviation | Assessment |
|---|---|
| `SessionGuard` in `vault/application/policies/` rather than bare at `application/` | **Correct and required.** This is what CLAUDE.md's "no bare files at a layer's root" rule demands; it was pre-agreed at Gate P (plan §7) and documented in `specs/vault.md`. |
| `DeviceId`/`WriteStamp` relaxed from ULID shape to non-empty string | **Justified.** Ids are opaque everywhere else in this codebase (`Project`/`ContextItem` ids are unchecked), and the test `SeqIds` generator does not produce ULIDs. Documented in `specs/vault.md` and in the file headers (`device-id.ts:5-9`, `write-stamp.ts:6-10`). |
| `UnlockVault` drops the separate `verifyKey` call in favour of `readLineage` | **Good.** Halves the db opens on the hot path, and `readLineage` maps `isWrongKeyError → WRONG_PASSPHRASE` identically (`file-vault-store.ts:66-70`). But `VaultStatus` was not given the same treatment — see W6. |
| `file-vault-folder.test.ts` not written | **Not justified anywhere.** Plan §9 and §4 both name it; neither the commit series nor the specs explain the omission, and `specs/vault.md`'s "Proof:" line silently drops it. This is the hard-gate breach. |
| `upgrade-wal.test.ts` does not leave a live `-wal` as plan step 40 required | **Documented, but a real reduction in coverage** on the advance's own top-named risk. See W3. |

**Module boundaries / naming / placement — all clean.** New files land in typed subfolders
(`domain/values/`, `domain/services/`, `application/ports/`, the new `application/policies/`),
infra adapters are tech-named (`SqliteLineageStore`, `FileDeviceIdentity`, `FileVaultFolder`),
`shared/infra/state-paths.ts` mirrors the existing `vault-paths.ts` sibling, and
`LOCKED_MESSAGE` lives in the standing `errors.ts` exception. `shared` gains no internal
imports. `context → vault` still runs only through the `VaultSessions` bridge, and the
`write()` seam is on that same bridge object. No new bare file at any layer root.
Ports carry no `better-sqlite3` types. I have no renames to propose.

---

## 6. Hard gates

| Gate | Result |
|---|---|
| Security surface not weakened | **Pass.** No key or secret is logged (lock/status/doctor print paths, generations and a `this device`/`another device` label — never the key, never the stamp). No plaintext at rest added: `vault.json` is byte-identical in shape, lineage lives in the encrypted `meta`. Key derivation, keychain use and SQLCipher keying are untouched; the new pragmas run strictly *after* `sqlite_master` proves the key. MCP exposes nothing new. Auto-lock only ever *removes* a key. |
| Tests present for new behavior | **FAIL.** `src/vault/infra/file-vault-folder.test.ts` was planned (plan.md:526, plan.md:341) and does not exist. `FileVaultFolder.conflictedCopies` and `looksLikeCloud` — the adapter behind two named acceptance criteria — have zero direct coverage, and the absence hid defect C1. |
| Suite passing | Pass (214/214, typecheck, lint, build). |
| Advance ritual evidenced | Pass. |
| Conventions / placement | Pass. |

---

## 7. Issues, prioritized

### Critical

**C1 — Dropbox "conflicted copy" files are not detected. The fork safety net's most visible
warning silently does nothing for the vendor the spec names first.**
`src/vault/infra/file-vault-folder.ts:6`
```ts
const CONFLICTED_COPY_PATTERNS = [/\(conflicted copy.*\)/i, /\.sync-conflict-/i, /\(conflicted\)/i];
```
The first pattern requires the literal `(conflicted copy`. Dropbox's real filename is
`<name> (<user>'s conflicted copy <date>).<ext>` — the `(` is followed by the *username*.
Verified against real vendor shapes:

| Filename | Matches? |
|---|---|
| `vault (Oscar's conflicted copy 2026-07-23).db` (Dropbox, real) | **no** |
| `vault-LAPTOP-X1.db` (OneDrive, real) | no |
| `vault.db.sync-conflict-20260723-101500-ABCDEF.db` (Syncthing) | yes |
| `vault.db (conflicted copy).db` (the synthetic name used in `multi-device-sync.test.ts:161`) | yes |

The only test touching this uses the synthetic name, so nothing catches it. Fix: drop the
required `(` — `/conflicted[ -]?copy/i` — keep `/\.sync-conflict-/i`, and either add an
OneDrive `<stem>-<hostname>.db` heuristic or state the gap in `docs/sync.md`. Cover it with
the real vendor filenames above.

**C2 — `valija lock` claims "single file (vault.db)" even when it just found sidecars.**
`src/delivery/cli/vault-commands.ts:64-71`
```ts
console.log(`Vault locked. On-disk state: single file (vault.db), ${generationText}${writerText}.`);
if (v.sidecars.length > 0) {
  console.log(`Warning: stray files present, not safely at rest: ${v.sidecars.join(", ")}`);
}
```
The user is told two contradictory things in consecutive lines. Refined §6.5 is explicit:
"the 'safe to switch' report must only print after the verify actually succeeded". Fix:
branch the whole on-disk-state clause on `v.sidecars.length === 0` — e.g.
`On-disk state: NOT safely at rest (stray: …)` on the failure path — so the reassuring
sentence is only ever emitted when the verify passed.

**C3 (hard gate) — `src/vault/infra/file-vault-folder.test.ts` is missing.**
Required by plan.md §9 (line 526) and plan.md §4's test-plan table (line 341, mapping it to
the "Doctor: journal/single-file, sidecar warn, cloud hint, conflicted-copy warn, TTL"
acceptance row). `sidecars` is covered indirectly by
`lock-vault.use-case.test.ts:277-288`; `conflictedCopies` and `looksLikeCloud` are covered
nowhere. `specs/vault.md`'s "Proof:" line was quietly written without it.

### Warning

**W1 — `looksLikeCloud` implements half of D-E.** `file-vault-folder.ts:29` is a
case-sensitive substring match on the root path only. Refined §5 D-E and plan step 28 both
say "**or a vendor marker file is present**" — not implemented. Also, `~/dropbox/valija`
(lowercase) and any Syncthing folder produce no hint. Lowercase the comparison and add the
marker-file probe (`.dropbox`, `.dropbox.cache`, `.stfolder`), or narrow the spec.

**W2 — the last-writer id is computed and then thrown away.** `VaultStatus` returns
`lastWriter: DeviceId` (`vault-status.use-case.ts:33`), `LockVault` returns
`writer: DeviceId` (`lock-vault.use-case.ts:9`), and every consumer collapses it to a
boolean label (`vault-commands.ts:63`, `:90`; `doctor.ts:104`). Refined §7 D2 asks status to
report "last-writer id" and §1 step 3 shows `last written by device-A`. Print a short prefix
of the id alongside the label (`another device (01J8F2…)`), which is what makes a
three-device fork diagnosable.

**W3 — no test ever exercises a hot/dangling `-wal`.** Both
`src/shared/infra/upgrade-wal.test.ts:325-341` and `src/shared/infra/sqlite.test.ts:216-240`
close the legacy WAL connection cleanly first, which makes SQLite checkpoint and delete the
`-wal` before the upgrade even runs. The property the plan asked for ("leave a live `-wal`",
step 40) — and the one that corresponds to the actual hazard, a crashed process — is
untested. This is the top-named risk in refined §9 and plan §8. It is reproducible: spawn a
short child script with `child_process`, have it open the vault in WAL mode, begin a write,
and `SIGKILL` it, then assert `openVaultDb` folds the surviving `-wal` and recovers the row.

**W4 — "a simulated crash mid-write leaves a recoverable, non-corrupt vault" (refined §7 A3)
is untested.** The forced-failure test exercises a migration transaction rollback, not a
crash during an item write. The same child-process technique as W3 covers both.

**W5 — `valija doctor` recomputes the whole vault status four times.**
`doctor.ts:144-148` calls `c.vaultStatus.execute()` from `checkVault`, `checkJournal`,
`checkLineage` and `checkAutoLock`. Each call does an OS keychain read, a folder inspect,
a header read+zod parse, **and two SQLCipher opens** (`verifyKey` then `readLineage`), and
`readLineage` also runs `migrate()`. That is 8 database opens, 4 keychain reads and 4
migration runs for one `doctor`. Compute the status once in `doctorCommand` and pass the
`VaultStatusOutput` into the four checks.

**W6 — `VaultStatus` opens the database twice, the exact thing `UnlockVault` was changed to
avoid.** `vault-status.use-case.ts:57-64`: `this.store.verifyKey(keyHex)` then
`this.store.readLineage(keyHex)`. `unlock-vault.use-case.ts:45-47` carries the comment
"a separate verifyKey call would only open the db twice for nothing" — but status still
does it. `readLineage` already returns `WRONG_PASSPHRASE` on a stale key, so `unlocked` can
be derived from its result in one open.

**W7 — the device-state file is written non-atomically and races across processes.**
`file-device-identity.ts:938-956`: every `recordSeen`/`recordActivity` is a full
read-modify-write with a plain `writeFileSync`, and `readState` swallows any failure and
returns `{}`. Two consequences. (a) The MCP server and a CLI command running concurrently
can clobber each other's `lastSeen` — last writer wins on the whole JSON. (b) A truncated
file (crash mid-write, full disk) reads as `{}`, so `deviceId()` mints a **new** id and the
per-vault last-seen record is gone — fork detection then silently classifies the next
divergent vault as a clean fast-forward. The safety net fails open, quietly. Fix: write to
`${state}.tmp` and `renameSync` onto the target, and pass `{ mode: 0o600 }`.

**W8 — `readLineage` runs `migrate()`, so `status`, `lock` and `doctor` now mutate the
vault and can drop a `.bak` sibling into the synced folder.**
`file-vault-store.ts:57-62` calls `migrate(db, this.paths.db)`. Migration 003 is
`backup: true`, so the first `valija status` on a 0.2.x vault writes
`vault.db.pre-003.bak` next to `vault.db` — inside the folder the sync client watches —
before deleting it. Transient on success, **permanent on failure**, and neither
`VaultFolder.sidecars` nor any doctor check mentions `.bak` files, so D-A's "single file at
rest" quietly does not hold during an upgrade. At minimum: document it in `docs/sync.md`,
and consider having `FileVaultFolder` report stale `*.bak` files so `doctor` can tell the
user to move or delete one.

### Suggestion

- **S1 — `parseAutoLockTtl` is the only `parseX` in the repo that does not return a
  `Result`**, and `auto-lock-ttl.ts` is the only file in a `values/` folder that declares no
  branded value type (`auto-lock-ttl.ts:10`; compare the 13 other `parseX` functions). The
  signature was specified in the plan and approved, so this is not a gate breach — but it
  reads as an outlier, and the silent fallback hides typos: `VALIJA_AUTOLOCK_MINUTES=of`
  (missing `f`) becomes 15 minutes instead of disabled, with no warning. Consider a branded
  `AutoLockTtl` with `parseAutoLockTtl(raw?): Result<AutoLockTtl | null, DomainError>`, and
  let the container fall back to 15 *and print a warning line*.
- **S2 — `UnlockVault` builds its error outside the per-context constructor.**
  `unlock-vault.use-case.ts:67` does `new DomainError("VAULT_FORK_DETECTED", …)`.
  `DomainError.code` is a plain `string`, so a typo in that literal compiles. `vaultErr`
  can't be used because it returns a `Result`. Add a sibling in `vault/domain/errors.ts`:
  `export const vaultError = (code: VaultErrorCode, message: string): DomainError => new DomainError(code, message);`
  and have `vaultErr` delegate to it. Keeps the "per-context error constructor" convention
  and type-checks the code.
- **S3 — `commitWrite`'s mutable capture is hard to read.**
  `vault-sessions.ts:118-143` uses `let bumped: LineageStamp | null`, assigns it inside the
  transaction closure, then needs `const stamp: LineageStamp = bumped;` to get past
  narrowing. Returning `{ result, stamp }` from the transaction removes the mutable, the
  alias and the `!== null` re-check.
- **S4 — style: `vault-sessions.ts:134` returns `{ ok: false, error: error.error }`
  inline** instead of `err(error.error)` from `shared/domain/result.ts`. It is the only
  hand-rolled `Result` literal in `src/`.
- **S5 — `VaultFolderInspection` mixes absolute paths and bare names.** `sidecars` are
  absolute (`file-vault-folder.ts:25`), `conflictedCopies` are `readdirSync` entry names
  (`:31`). Both are printed side by side to the user in `lock`, `status` and `doctor`, so
  the output is inconsistent. Make both absolute.
- **S6 — `parseGeneration` accepts more than it should.** `generation.ts:9` uses
  `Number(raw)`, so `parseGeneration("")` and `parseGeneration("  ")` both return `ok(0)`
  and `parseGeneration("0x10")` returns `ok(16)`. Guard with `/^\d+$/` before the numeric
  conversion.
- **S7 — the idle clock does not start at `init`.** `CreateVault` sets the keychain key but
  never calls `recordActivity`, so `lastActivityAt` is `null` and `SessionGuard` treats the
  vault as never-expired until the first context session runs
  (`session-guard.ts:102` — `lastActivity !== null &&`). A vault created and abandoned stays
  unlocked indefinitely. Record activity at init.
- **S8 — `SessionGuard` records activity before the command runs**, so a command that then
  fails still refreshes the timer. Plan D-6 says "any **successful** command refreshes". Two
  words apart; worth reconciling code and spec either way.
- **S9 — `src/shared/infra/upgrade-wal.test.ts` is a test with no co-located subject** at a
  layer root, against plan §2's "Tests are co-located (`foo.ts` + `foo.test.ts`)". It was
  planned at that path so it is approved, but `src/shared/infra/migrations/003-lineage.test.ts`
  is the more consistent home for it.

### Explicitly not a problem

- Fork detection running only at `unlock`, not at every session open, is what plan Slice 5
  specifies and what refined §7 B3 tests for. A fork that lands while the vault is already
  unlocked goes unreported until the next unlock — accepted scope.
- Dropping WAL costs read/write concurrency. better-sqlite3's default 5 s busy timeout
  covers valija's short single-connection sessions, and refined §5 D-A weighs and accepts
  this trade-off explicitly.
- `docs/sync.md`, `docs/SPEC.md` §10b and the two `upgrade-wal.test.ts` docblocks are
  candid about the residual risks rather than papering over them. That is the right
  posture and should not be edited into vagueness while fixing the above.

---

## 8. What would flip this to PASS

1. **Add `src/vault/infra/file-vault-folder.test.ts`** covering all three `inspect()`
   fields, including `conflictedCopies` against the real vendor filenames listed in C1 and
   `looksLikeCloud` against a Dropbox-shaped and a non-cloud path. (Closes the hard gate,
   C3, and acceptance row E1.)
2. **Fix `CONFLICTED_COPY_PATTERNS`** so a genuine Dropbox conflicted copy matches. (C1)
3. **Make `lockCommand`'s "single file (vault.db)" claim conditional** on an empty
   `sidecars` list. (C2, acceptance row D1)
4. **Surface the last-writer id** in `status` (and, for symmetry, `lock`/`doctor`) — or
   record Oscar's explicit relaxation of that clause in refined §7 D2. (W2, acceptance row D2)
5. **Either add a hot-`-wal` upgrade test** (child process, `SIGKILL` mid-write) **or record
   Oscar's explicit waiver** of plan step 40's "leave a live `-wal`" requirement in
   `advances/M3/plan.md`. This is the one item on this list I would accept a documented
   waiver for; the others need code. (W3, acceptance rows A3/G1)

W1 and W5–W8 are real and I would want them fixed, but I am not gating on them: they are
either half-implemented guidance (W1), efficiency (W5, W6), or robustness hardening of a
non-secret file and an upgrade side effect (W7, W8). If they are deferred, they belong in
the backlog with a named owner, not dropped.
