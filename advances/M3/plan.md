# M3 — Bring-your-own-cloud vault sync · Implementation Plan

**Spec:** `advances/M3/refined.md` (Approved at Gate R — Oscar 2026-07-23; D-A..D-E, D-G..D-I
as recommended defaults, **D-F Option A**).
**Branch (implementer creates after approval):** `feat/sync-M3`

> Implementation must NOT begin until Oscar has reviewed this file and recorded an
> `Approved:` line at its top. The `.claude/hooks/guard-implementation.sh` gate enforces
> that no `src/**`, `package.json`, or build-config edits land before that marker exists.

---

## 1. Summary

M3 makes a single SQLCipher vault file survive inside a folder a third-party sync client
watches, and adds a fork-detection safety net plus idle auto-lock. No backend, no network,
no new MCP surface. The work is nine slices:

1. **D-A journaling** — `openVaultDb` switches WAL → rollback (`DELETE`) so the vault is a
   single self-consistent `vault.db` at rest after *every* command. (shared/infra)
2. **Lineage values + policy** — `DeviceId`, `Generation`, `WriteStamp` value objects and a
   pure `VaultLineage` classifier (`in-sync` / `fast-forward` / `fork`) in `vault/domain`.
3. **Lineage & device-identity ports + adapters** — a narrow `LineageStore` port (read/bump
   the stamp in the encrypted `meta`) and a non-synced `DeviceIdentity` port, each with a
   tech-named adapter. (vault/application + vault/infra + shared/infra state path)
4. **Write-time bump seam** — the context write path advances the stamp atomically with each
   write, via the existing `VaultSessions` bridge, without importing SQLite in use cases.
5. **Unlock = detect** — `UnlockVault` reads the stamp, silently adopts a clean
   fast-forward, and surfaces `VAULT_FORK_DETECTED` on provable divergence (never clobbers).
6. **Idle auto-lock (D-I)** — a device-local last-activity timestamp checked lazily at every
   session open; past the TTL the key is dropped and `VAULT_LOCKED` returned. Env-configured.
7. **Lock = safe-to-switch (D-D)** — `LockVault` verifies single-file-at-rest, drops the key,
   prints the handoff line (generation + writer).
8. **Status/doctor (D-E)** — sync-safety + session reporting; cloud-folder + conflicted-copy
   hints.
9. **Upgrade (D-G) + docs/specs** — migration 003 (+ ciphertext backup) initialises lineage
   on populated WAL vaults; `docs/SPEC.md`, three `specs/*.md`, and a user sync doc.

The MCP tool/prompt surface is byte-for-byte unchanged; sync/lineage/session metadata never
enters a context pack.

---

## 2. Ordered steps

Each step is independently checkable. Run `npm run typecheck && npm run lint && npm run test`
after every slice. Tests are co-located (`foo.ts` + `foo.test.ts`).

### Slice 1 — D-A: single-file-at-rest journaling (shared/infra)

1. **Edit `src/shared/infra/sqlite.ts`** — in `openVaultDb`, replace
   `db.pragma("journal_mode = WAL")` with a fold-then-switch sequence, keeping
   `foreign_keys = ON` and leaving `PRAGMA synchronous` at its safe default (never `OFF`):
   ```
   db.pragma("wal_checkpoint(TRUNCATE)"); // fold any pre-existing WAL into vault.db (no-op if none)
   db.pragma("journal_mode = DELETE");    // rollback journal: vault.db alone is the DB at rest
   db.pragma("foreign_keys = ON");
   ```
   This runs on every open (create, verify, session), so the first open of a 0.2.x WAL vault
   folds and switches. Add a short comment explaining the sync-safety rationale.
2. **Edit `src/shared/infra/sqlite.test.ts`** — add cases: after `openVaultDb` + write +
   `close`, assert `journal_mode` is `delete` and that no `vault.db-wal` / `-shm` / `-journal`
   siblings exist on disk; reopen and assert the written row is present (a bare-`vault.db`
   copy loses nothing).

### Slice 2 — lineage value objects + `VaultLineage` classifier (vault/domain)

Follow the `parseX` / `createX` + branded-type convention (`project-name.ts`, `passphrase.ts`).

3. **New `src/vault/domain/values/device-id.ts`** — `type DeviceId` (branded ULID string);
   `parseDeviceId(raw): Result<DeviceId>` (ULID shape) and `createDeviceId(idGen): DeviceId`.
4. **New `src/vault/domain/values/generation.ts`** — `type Generation` (branded non-negative
   int); `GENERATION_ZERO`, `parseGeneration(raw): Result<Generation>`, `nextGeneration(g)`.
5. **New `src/vault/domain/values/write-stamp.ts`** — `type WriteStamp` (branded ULID);
   `parseWriteStamp`, `createWriteStamp(idGen)`. The per-write random token.
6. **New `src/vault/domain/services/vault-lineage.ts`** — the `VaultLineage` domain service
   (pure functions, no I/O, mirroring `context/domain/services/context-pack.ts` style):
   - types `LineageStamp = { generation: Generation; writeStamp: WriteStamp; writer: DeviceId; writtenAt: string }`
     and `LineageSeen = { generation: Generation; writeStamp: WriteStamp }`.
   - `classifyLineage(current: LineageStamp, lastSeen: LineageSeen | null): "in-sync" | "fast-forward" | "fork"`:
     `lastSeen === null` → `fast-forward`; `current.writeStamp === lastSeen.writeStamp` →
     `in-sync`; `current.generation > lastSeen.generation` → `fast-forward`; otherwise →
     `fork` (same or lower generation with a different stamp = provable divergence).
7. **New tests** for each value object (`*.test.ts`) and
   `vault-lineage.test.ts` (in-sync, clean fast-forward, same-generation fork,
   behind-my-last-write fork, first-seen adopt).

### Slice 3 — lineage + device-identity ports & adapters

8. **New `src/vault/application/ports/lineage-store.ts`** — the narrow port (no SQLite in its
   signature): `read(): LineageStamp | null` and `bump(writer: DeviceId): LineageStamp`
   (increment generation, mint a fresh stamp, write the `meta` rows, return the new stamp).
9. **New `src/vault/application/ports/device-identity.ts`** — `DeviceIdentity`:
   `deviceId(): DeviceId` (stable, created on first use); `lastSeen(vaultId): LineageSeen | null`
   / `recordSeen(vaultId, seen): void`; `lastActivityAt(vaultId): Date | null` /
   `recordActivity(vaultId, at): void` (D-I state).
10. **New `src/shared/infra/state-paths.ts`** — `resolveStatePaths()` →
    `{ root, state }` where `root = process.env.VALIJA_STATE_HOME ?? join(homedir(), ".valija-state")`
    and `state = join(root, "state.json")`. Mirrors `vault-paths.ts`; deliberately independent
    of `VALIJA_HOME` so device state never lands in the synced folder. (dependency-free, shared)
11. **New `src/vault/infra/sqlite-lineage-store.ts`** — `SqliteLineageStore` implements
    `LineageStore` over a `Database` (+ injected `IdGenerator`, `Clock`). Stores four `meta`
    key/value rows: `lineage_generation`, `lineage_stamp`, `lineage_writer`,
    `lineage_written_at`. `read` returns `null` when `lineage_generation` is absent
    (un-upgraded); `bump` upserts atomically (the caller runs it inside the write transaction).
12. **New `src/vault/infra/file-device-identity.ts`** — `FileDeviceIdentity` implements
    `DeviceIdentity` over `resolveStatePaths()` JSON: `{ deviceId, vaults: { <vaultId>: { lastSeenGeneration, lastSeenStamp, lastActivityAt } } }`.
    Lazily generates the device id (via injected `IdGenerator`) and persists it on first read;
    reads tolerate a missing/corrupt file (start fresh), never throw.
13. **New tests** `sqlite-lineage-store.test.ts` (read `null` before init, bump increments +
    changes stamp, round-trips) and `file-device-identity.test.ts` (device id stable across
    instances, per-vault last-seen/activity isolation, file lives under the state root, not
    `VALIJA_HOME`).

### Slice 4 — write-time bump seam (context write path via the bridge)

14. **Edit `src/context/application/ports/vault-session.ts`** — add one method to
    `VaultSession`: `write<T>(mutate: () => Result<T, DomainError>): Result<T, DomainError>`.
    Document it as the seam that stamps a mutation atomically on commit. Read use cases keep
    calling the repositories directly and never call `write`.
15. **Edit `src/context/infra/vault-sessions.ts`** — extend `SqliteVaultSessions`
    constructor to `(paths, keychain, deviceIdentity, guard, idGen, clock)`:
    - in `open()`, after `requireKey` succeeds, call `guard.guard(vaultId)` (the auto-lock
      check, Slice 6); propagate its `VAULT_LOCKED` result if it fires.
    - in `openRepositories`, build `new SqliteLineageStore(db, idGen, clock)` and capture the
      writer `deviceIdentity.deviceId()`; provide `write` via a private `commitWrite` helper
      that runs `mutate` inside `db.transaction(...)`, bumps the lineage on success, rolls back
      on a non-`ok` Result (throw-a-sentinel-and-catch), then `recordSeen(vaultId, ...)` after a
      committed bump.
    - `runWithSession` and the locked-vault mapping are unchanged.
16. **Edit `src/context/application/use-cases/save-context.use-case.ts`** — wrap the mutation
    (find-or-create project + save item) in `session.write(() => ...)`. No other change.
17. **Edit `src/context/application/use-cases/import-items.use-case.ts`** — wrap the batch
    (find-or-create project + the save loop) in a single `session.write(() => ...)`, so one
    import bumps the generation once.
18. **Edit `src/context/infra/vault-sessions.test.ts`** — add a test proving a `session.write`
    bumps the generation and mints a new stamp atomically, and that a read-only session does
    not bump. (Uses the real Sqlite session over `makeUnlockedVault`.)

### Slice 5 — unlock detects fast-forward vs fork (vault/application)

19. **Edit `src/vault/domain/errors.ts`** — add `VAULT_FORK_DETECTED` to `VaultErrorCode`.
20. **Edit `src/vault/application/ports/vault-store.ts`** — add
    `readLineage(keyHex): Result<LineageStamp | null, DomainError>` (opens, verifies the key —
    wrong key → `WRONG_PASSPHRASE` — migrates so lineage rows exist, reads, closes).
21. **Edit `src/vault/infra/file-vault-store.ts`** — implement `readLineage` using
    `openVaultDb` + `migrate(db, dbPath)` + `SqliteLineageStore(db, idGen, clock).read()` +
    `db.close()`, mapping `isWrongKeyError` → `WRONG_PASSPHRASE` exactly like `verifyKey`.
    (Store gains injected `idGen` + `clock` for the adapter; wire in the container.)
22. **Edit `src/vault/application/use-cases/unlock-vault.use-case.ts`** — inject
    `DeviceIdentity` + `Clock`. After deriving/verifying the key via `readLineage`:
    - `classifyLineage(lineage, deviceIdentity.lastSeen(vaultId))`.
    - `keychain.setKey(...)` and `deviceIdentity.recordActivity(vaultId, now)` (unlock resets
      the idle timer).
    - `fast-forward`/`in-sync` → `deviceIdentity.recordSeen(vaultId, lineage.seen)`; return
      `ok({ vaultId })`.
    - `fork` → do **not** update last-seen (the warning persists until resolved); return
      `ok({ vaultId, fork: { generation, writer } })` so the vault is unlocked for inspection
      while the CLI surfaces the loud `VAULT_FORK_DETECTED` notice (see Decisions D-1).
    A `null` lineage (fresh/never-written vault) classifies as `fast-forward` (no false fork).
23. **Edit `src/vault/application/use-cases/unlock-vault.use-case.test.ts`** — add: clean
    fast-forward adopts and records last-seen; same-generation different-stamp yields the
    `fork` result and leaves last-seen untouched; wrong passphrase still `WRONG_PASSPHRASE`.

### Slice 6 — idle auto-lock (D-I)

24. **New `src/vault/domain/values/auto-lock-ttl.ts`** — `parseAutoLockTtl(raw?: string): number | null`
    (`undefined`/empty → 15; `"0"`/`"off"` case-insensitive → `null` = disabled; positive int →
    that; otherwise fall back to 15) and `isIdleExpired(lastActivity: Date, now: Date, ttlMinutes: number): boolean`.
25. **New `src/vault/application/policies/session-guard.ts`** — `SessionGuard` (a small
    application policy service, not a `UseCase`) gets its own `policies/` subfolder rather
    than sitting bare next to `ports/`/`use-cases/`, so the folder alone tells you what kind
    of thing it is. Constructor `(deviceIdentity, keychain, clock, ttlMinutes: number | null)`.
    `guard(vaultId): Result<void, DomainError>`:
    - TTL `null` → refresh activity, `ok`.
    - `lastActivityAt` non-null and `isIdleExpired(...)` → `keychain.deleteKey(vaultId)` and
      return `vaultErr("VAULT_LOCKED", LOCKED_MESSAGE)` using the **exact** existing locked
      message (so the MCP surface is unchanged).
    - otherwise → `recordActivity(vaultId, now)`, `ok`.
    Export the shared `LOCKED_MESSAGE` (move it to a small shared spot or re-export from the
    session module) so both `SqliteVaultSessions` and `SessionGuard` use one literal.
26. **New tests** `auto-lock-ttl.test.ts` (parse table + expiry boundary) and
    `session-guard.test.ts` (TTL elapsed drops the key + `VAULT_LOCKED`; within TTL refreshes
    and passes; disabled TTL never locks).

### Slice 7 — lock = the safe-to-switch signal (D-D)

27. **New `src/vault/application/ports/vault-folder.ts`** — `VaultFolder` port:
    `inspect(): { sidecars: string[]; conflictedCopies: string[]; looksLikeCloud: boolean }`.
28. **New `src/vault/infra/file-vault-folder.ts`** — `FileVaultFolder` implements `VaultFolder`
    over `VaultPaths` + `node:fs`: `sidecars` = which of `vault.db-wal|-shm|-journal` exist;
    `conflictedCopies` = folder entries matching `*(conflicted copy)*` / `*.sync-conflict-*` /
    `* (conflicted)*`; `looksLikeCloud` = root path contains `Dropbox`/`OneDrive`/`Google Drive`/
    iCloud `Mobile Documents`, or a vendor marker file is present.
29. **Edit `src/vault/application/use-cases/lock-vault.use-case.ts`** — inject `keychain`
    (already), `store` (already), `VaultFolder`. Read the current generation/writer via
    `store.readLineage(key)` when a key is present (before dropping it); assert
    single-file-at-rest via `folder.inspect().sidecars`; drop the key; return
    `{ wasUnlocked, generation?, writer?, sidecars: string[] }`. The "safe to switch" text is
    rendered in delivery (Slice 8).
30. **Edit `src/vault/application/use-cases/lock-vault.use-case.test.ts`** — assert the key is
    dropped, `wasUnlocked` toggles, and the returned generation matches the last write; add a
    stray-sidecar case that reports a non-empty `sidecars` list.

### Slice 8 — status, doctor, and CLI wiring (D-E, delivery)

31. **Edit `src/vault/application/use-cases/vault-status.use-case.ts`** — inject
    `DeviceIdentity`, `VaultFolder`, `Clock`, `ttlMinutes`. Extend `VaultStatusOutput` with
    `journalMode: "DELETE"`, `sidecars: string[]` (single-file check), `autoLock: { ttlMinutes: number | null; idleFor?: number; expired?: boolean }`,
    and — only when unlocked — `generation?: number` and `lastWriter?: string`
    (via `store.readLineage(key)`, marking whether the writer is this device). Never touches
    context items; never feeds a context pack.
32. **Edit `src/vault/application/use-cases/vault-status.use-case.test.ts`** — cover the new
    fields for a locked vault (no generation) and an unlocked vault (generation + writer), and
    the idle/TTL fields.
33. **Edit `src/delivery/cli/vault-commands.ts`** —
    - `lockCommand`: on success print the handoff line, e.g.
      `Vault locked. On-disk state: single file (vault.db), generation N, last written by <this device|another device>. Safe to let your sync client finish before opening valija elsewhere.`
      If `sidecars` is non-empty, add a warning line (crash/wrong-mode).
    - `statusCommand`: print journal/single-file, generation + last-writer (when unlocked),
      and the auto-lock TTL + idle state, in addition to the existing lines.
    - `unlockCommand`: on a `fork` result, print the `error [VAULT_FORK_DETECTED]: …` notice
      (folder path + conflicted-copy guidance + "run valija doctor") without exiting non-zero,
      since the vault is unlocked for inspection (Decisions D-1).
34. **Edit `src/delivery/cli/doctor.ts`** — add `Check`s following the existing pattern:
    journal mode + single-file (from `VaultStatus` / `FileVaultFolder(c.paths)`); a warning
    when stray sidecars exist at rest; cloud-folder recognition → ritual reminder; a loud
    warning when a conflicted-copy file is present; generation + last-writer (when unlocked);
    auto-lock TTL + idle state. No fatal exits added for these advisory checks.
35. **Edit `src/delivery/container.ts`** — construct `resolveStatePaths()`,
    `FileDeviceIdentity`, `parseAutoLockTtl(process.env.VALIJA_AUTOLOCK_MINUTES)`,
    `SessionGuard`, `FileVaultFolder`; thread `idGen`/`clock` into `FileVaultStore`; pass the
    new deps into `SqliteVaultSessions`, `UnlockVault`, `LockVault`, `VaultStatus`. Keep the
    single-composition-root shape.
36. **Edit `src/testing/test-vault.ts`** — add `FakeDeviceIdentity` (in-memory) and construct
    `makeUnlockedVault` with a `SessionGuard` (using `FixedClock` + a default TTL) and the fake
    device identity, so the changed `SqliteVaultSessions`/`FileVaultStore` signatures resolve.
    Keep the returned `TestVault` shape backward compatible (add `deviceIdentity`).

### Slice 9 — upgrade path (D-G), docs, specs, cross-cutting tests

37. **New `src/shared/infra/migrations/003-lineage.ts`** — static SQL seeding a deterministic
    baseline: `INSERT OR IGNORE INTO meta (key, value) VALUES ('lineage_generation', '0')`.
    The device id + first real stamp are written by the first write bump (Slice 4); the journal
    fold/switch already happened at open (Slice 1). Header note explains the split (see D-2).
38. **Edit `src/shared/infra/migrations.ts`** — register `{ version: 3, sql: MIGRATION_003, backup: true }`
    so populated vaults get a ciphertext backup before the row is written (mirrors 002).
39. **New `src/shared/infra/migrations/003-lineage.test.ts`** — fresh init reaches schema 3
    with `lineage_generation = '0'`; a populated pre-3 vault upgrades, keeps its rows/FTS, and
    the `.pre-003.bak` is created then removed on success.
40. **New `src/shared/infra/upgrade-wal.test.ts`** — build a populated **WAL** vault directly
    (raw `better-sqlite3-multiple-ciphers`, `journal_mode = WAL`, insert rows, leave a live
    `-wal`), then `openVaultDb` + `migrate`: assert the WAL is folded, journal mode is `delete`,
    no sidecars remain, lineage seeded, row count + content identical, and FTS search returns
    every original item. Simulate a forced mid-upgrade failure and assert the prior state is
    intact and the backup remains.
41. **New `src/delivery/multi-device-sync.test.ts`** — end-to-end simulation with two
    `VALIJA_HOME` roots + a file-copy step standing in for the sync client and two
    `FakeDeviceIdentity` devices:
    - clean A→B handoff fast-forwards silently and continues; reverse B→A also adopts;
    - both write from the same generation, a copy overwrites → next unlock reports
      `VAULT_FORK_DETECTED`, deletes/overwrites nothing, and both encrypted copies open with
      the same key;
    - idle TTL elapsed (injected clock) → next session open drops the key and returns
      `VAULT_LOCKED`; a fresh unlock continues;
    - assert the device-state file is under the state root, never in either vault folder.
42. **Edit `src/delivery/mcp/server.test.ts`** — add an assertion that no tool response or
    context pack contains lineage/generation/device/activity data, and that the tool/prompt
    list is unchanged.
43. **Docs & specs (same commit):**
    - `docs/SPEC.md`: update §2 roadmap (M3 = BYO-cloud vault sync; GUI + encrypted
      backup/restore pushed later), add **§10b — M3 — BYO-cloud vault sync** mirroring §10a,
      and mark §12 open question 3 (auto-lock TTL) resolved by D-I.
    - `specs/shared.md`: journal mode now `DELETE` (single-file at rest); add `state-paths.ts`
      and migration 003.
    - `specs/vault.md`: add `VAULT_FORK_DETECTED`; the `VaultLineage` service +
      `DeviceId`/`Generation`/`WriteStamp` values; `LineageStore`/`DeviceIdentity`/`VaultFolder`
      ports + adapters; `SessionGuard` (in `application/policies/`); extended
      `LockVault`/`UnlockVault`/`VaultStatus`;
      `readLineage` on `VaultStore`.
    - `specs/delivery.md`: `lock`/`unlock`/`status`/`doctor` changes, `VALIJA_AUTOLOCK_MINUTES`,
      `VALIJA_STATE_HOME`, and the (deferred/optional) `--cloud` note.
    - **New `docs/sync.md`**: place the vault in a synced folder; the lock → sync → unlock
      ritual; idle auto-lock + configuring/disabling the TTL; resolving a `VAULT_FORK_DETECTED`
      (find the conflicted copy, both open with the passphrase, compare, choose).

---

## 3. Security-sensitive order of operations

- **Key before DB, every time.** Every DB open still derives/verifies the key first
  (`openVaultDb` verifies via `sqlite_master` before any pragma); the journal fold/switch
  runs *after* the key is proven, so a wrong key never mutates the file.
- **Crash safety preserved.** `PRAGMA synchronous` stays at its safe default; only WAL →
  `DELETE` changes. A hot rollback journal is replayed on the next open — at-rest integrity is
  kept, not weakened. No `synchronous=OFF` anywhere.
- **Bump is atomic with the write.** The generation/stamp bump runs inside the same
  `db.transaction` as the item write and rolls back with it; last-seen is updated only *after*
  a committed bump. This prevents a silent "adopt-your-own-unstamped-write" data loss.
- **Fork never clobbers.** On divergence the code returns/prints a warning and updates nothing
  on disk; both encrypted copies remain openable with the same passphrase. No auto-merge, no
  auto-delete, no auto-overwrite.
- **Auto-lock only tightens.** `SessionGuard` can only *drop* the key after the TTL; it never
  sets or lengthens an unlocked window. The dropped-key path returns the exact existing
  `VAULT_LOCKED` message, so MCP behaviour is unchanged.
- **No new plaintext at rest.** Lineage lives in the encrypted `meta`; `vault.json` gains
  nothing (still `schemaVersion` literal `1`). Device id / last-seen / last-activity live only
  in the non-synced state file. No secret is ever logged (stamps/ids are non-secret; the key
  never appears in status/lock/doctor output).
- **Upgrade is backed up first.** Migration 003 is `backup: true`, so a populated vault is
  copied (ciphertext) before the row is written and the backup is removed only after a
  verified successful transaction — the M2/002 precedent.
- **MCP surface reviewed.** No tool/argument/prompt is added or changed; a test asserts no
  sync metadata reaches any tool response or context pack.

---

## 4. Test plan → acceptance criteria

| Acceptance area (refined §7) | Test(s) |
|---|---|
| At-rest single file after any command / lock; bare `vault.db` loses nothing | `sqlite.test.ts` (Slice 1); `lock-vault.use-case.test.ts` sidecar case |
| `synchronous` not `OFF`; crash leaves recoverable vault | `upgrade-wal.test.ts` forced-failure case; code review of Slice 1 |
| Each write bumps generation + fresh stamp; header unchanged | `vault-sessions.test.ts` (Slice 4); `sqlite-lineage-store.test.ts` |
| Two-device clean A→B and B→A fast-forward | `multi-device-sync.test.ts` |
| Divergence → `VAULT_FORK_DETECTED`, nothing deleted, both copies open | `multi-device-sync.test.ts`; `unlock-vault.use-case.test.ts` |
| Device/last-seen/activity outside `VALIJA_HOME` | `file-device-identity.test.ts`; `multi-device-sync.test.ts` |
| Lock verifies single file, drops key, prints generation | `lock-vault.use-case.test.ts`; manual CLI wording review |
| Status shows single-file, generation, writer, TTL/idle; not in pack | `vault-status.use-case.test.ts`; `mcp/server.test.ts` |
| TTL elapsed → key dropped + `VAULT_LOCKED`; fresh unlock continues | `session-guard.test.ts`; `multi-device-sync.test.ts` |
| Within TTL activity refreshes; timestamp device-local | `session-guard.test.ts`; `file-device-identity.test.ts` |
| TTL configurable (default 15) + disable; visible in status | `auto-lock-ttl.test.ts`; `vault-status.use-case.test.ts` |
| Doctor: journal/single-file, sidecar warn, cloud hint, conflicted-copy warn, TTL | `file-vault-folder.test.ts` + doctor smoke; manual review |
| Populated WAL vault upgrades; content + FTS identical; backup taken/removed | `upgrade-wal.test.ts`; `003-lineage.test.ts` |
| No network/telemetry/daemon; MCP surface byte-identical | `mcp/server.test.ts`; whole-diff review |
| Crypto path unchanged; second device opens with same passphrase | existing vault/infra tests; `multi-device-sync.test.ts` |

---

## 5. Assumptions (each a place the plan could be wrong)

1. **`journal_mode = DELETE` folds a WAL on switch.** SQLCipher/SQLite checkpoints and folds
   an existing `-wal` when leaving WAL mode; the explicit `wal_checkpoint(TRUNCATE)` first is
   belt-and-suspenders. If the native build behaved differently, the upgrade test would catch
   it. `better-sqlite3-multiple-ciphers` honours these pragmas post-`key`.
2. **Sessions stay single-connection and short**, so a rollback journal never contends and the
   torn-copy window stays small (residual risk, documented, not solved).
3. **A meaningful random stamp written by the first *write* (not the migration) is sufficient**
   for fork detection, including two devices that independently upgrade the same vault and then
   diverge (their first divergent writes carry different stamps). See D-2.
4. **The device-state file at `~/.valija-state` (or `VALIJA_STATE_HOME`) is genuinely
   non-synced** in normal setups (users point `VALIJA_HOME`, not their whole home, at the cloud
   folder). Documented as a requirement.
5. **`ulid` shape is a stable id** for `DeviceId`/`WriteStamp`; reusing the existing dependency,
   no new packages.
6. **One generation bump per write *operation*** (Option A seam) is acceptable; the absolute
   count is opaque to users — only monotonicity + stamp equality matter.
7. **Fork on unlock leaves the vault unlocked** for inspection (Decisions D-1) — the reviewer
   reads the fork surface as a loud notice, not a hard command failure.
8. **Doctor's cloud-folder heuristic is best-effort** (name/marker match); false negatives just
   mean no reminder, never a behavioural branch (D-E keeps journaling unconditional).

---

## 6. Decisions to confirm (recommended defaults + trade-offs)

- **D-1 — Fork surface on `valija unlock`.** *Recommend:* unlock still sets the key (vault
  unlocked) and the CLI prints the `error [VAULT_FORK_DETECTED]: …` notice, exiting **0** so the
  user can immediately `valija doctor` and inspect; last-seen is left unchanged so the warning
  persists until resolved. *Trade-off:* an "error"-prefixed line with a zero exit code is
  slightly unusual. *Alternative:* fail unlock (exit 1, key not set) and require an explicit
  inspect path — stricter, but strands the user from the very tool that resolves it. The refined
  spec renders the message as an error but also tells the user to run doctor; the recommended
  default reconciles both.

- **D-2 — Where the first real stamp is written (D-G literal reading).** *Recommend:* migration
  003 (static SQL, `backup: true`) seeds only `lineage_generation = '0'`; the device id + first
  random stamp are written by the first write bump via `LineageStore`. This keeps `shared`
  dependency-free and the migration runner pure/static, still takes the ciphertext backup, and
  preserves the fork property. *Trade-off:* a literal reading of D-G ("initialize the lineage
  rows … this device as first writer, a fresh stamp" *in the migration*) is only partially met
  by 003 alone. *Alternative:* extend the runner to support a function-migration seeded with an
  injected device id + stamp — more faithful, but threads device identity through `migrate()`
  and couples the shared runner to runtime values.

- **D-3 — Write-bump seam placement (D-F Option A realisation).** *Recommend:* a
  `session.write(mutate)` method on the `VaultSession` bridge (implemented in
  `context/infra/vault-sessions.ts`), giving one atomic bump per write operation and keeping the
  repositories pure — so `context/infra/item-repo.ts` is unchanged. This honours D-F's intent
  (bump on the context write path, via the bridge, without importing SQLite in use cases).
  *Trade-off:* the Gate-R note names `item-repo.ts` specifically; the recommended seam relocates
  the bump to `vault-sessions.ts` (still context/infra, still the bridge object). *Alternative:*
  inject `LineageStore` + writer into `SqliteContextItemRepository`/`SqliteProjectRepository` and
  bump inside each `save`/`archive` — literally matches the note, but per-row bumps and a vault
  port injected into two repositories.

- **D-4 — Device-state location.** *Recommend:* `VALIJA_STATE_HOME` env → else
  `~/.valija-state/state.json`. Simple, cross-platform, clearly separate from `~/.valija` and any
  `VALIJA_HOME`. *Trade-off:* not the OS-standard config dir. *Alternative:* XDG/`%APPDATA%`
  (`~/.config/valija`, `~/Library/Application Support/valija`, `%APPDATA%\valija`) — more
  idiomatic but adds platform branching.

- **D-5 — `valija init --cloud <path>` (D-E optional).** *Recommend:* **defer** the flag; ship
  the doctor cloud-detection + ritual guidance and `VALIJA_HOME` placement, which fully satisfy
  the acceptance criteria. *Trade-off:* slightly less discoverable at init time. *Alternative:*
  add `--cloud <path>` that sets the root for that init and prints `export VALIJA_HOME=…`
  guidance (no behavioural branch) — needs per-command path override wiring in the container.

- **D-6 — Auto-lock activity definition.** *Recommend:* any successful command refreshes the
  timestamp (session-style). *Trade-off:* a read-only-but-active vault never times out.
  *Alternative:* only writes refresh — stricter, times out a read-only session, but surprising.

---

## 7. Naming / ubiquitous-language / DDD check

- Value objects `DeviceId`, `Generation`, `WriteStamp` and the composite `LineageStamp` follow
  the branded-type + `parseX`/`createX` convention (`project-name.ts`, `passphrase.ts`,
  `key-hex.ts`). The security-subdomain vocabulary (vault, lock/unlock, keychain) is extended
  with **lineage, generation, write-stamp, device identity, fork, fast-forward, auto-lock** —
  all in `vault`, the security bounded context that already owns lifecycle.
- Adapters are tech-named per convention: `SqliteLineageStore`, `FileDeviceIdentity`,
  `FileVaultFolder` (cf. `SqliteContextItemRepository`, `FileVaultStore`, `OsKeychain`).
- `VaultLineage` is a pure domain service (functions), mirroring `context-pack.ts`; ports
  (`LineageStore`, `DeviceIdentity`, `VaultFolder`) live in `vault/application/ports`, adapters
  in `vault/infra`, keeping `better-sqlite3` types out of the ports. `SessionGuard` is an
  application policy, not a `UseCase` (it gates sessions, mirroring the refined D-F guidance);
  it lives in a new `vault/application/policies/` subfolder rather than bare at the
  `application/` root, so — like every other layer folder in this repo — opening the folder
  tells you what kind of thing is inside without reading the file. No other new or changed
  file in this plan is in the same situation (all others slot into an existing typed
  subfolder, an established single-file convention, or a tech-named `infra/` adapter).
- The error constructor `vaultErr` gains `VAULT_FORK_DETECTED`, staying inside the vault code
  vocabulary. The dependency rule holds: `shared` gains only `state-paths.ts` (no internal
  imports); `context` reaches `vault` only through the `VaultSessions` bridge (the `write`
  seam is on that same bridge); no new `context → vault` path is introduced.
- No naming inconsistencies found that need renaming beyond the additions above.

---

## 8. Estimated line count & risks

- **Estimated production lines:** ~800 (new + changed `src/**`, excluding tests and docs).
  With tests (~650) and docs/specs (~250 markdown), total change ~1700 lines.
- **Risks (in executing this plan):**
  1. **WAL→rollback upgrade on populated encrypted vaults** (the spec's secondary risk) runs
     automatically on next open, possibly first via a background MCP session. Mitigated by the
     fold-before-switch at open, the transactional `backup: true` migration 003, and the
     dedicated `upgrade-wal.test.ts` gate — but it is the highest-risk surface. Do this slice
     carefully and run the full suite twice.
  2. **Constructor-signature churn** — `SqliteVaultSessions` and `FileVaultStore` grow
     dependencies; three construction sites (`container.ts`, `testing/test-vault.ts`,
     `vault-sessions.test.ts`) must update together or typecheck breaks. Land Slice 3/4 and the
     test-helper edit as a unit.
  3. **Atomicity of the bump** — if the bump is not truly inside the write transaction, a
     crash between write and bump can cause silent adoption of an unstamped write. The
     `commitWrite` transaction + rollback-on-error is load-bearing; the `vault-sessions.test.ts`
     bump test must assert atomicity.
  4. **Design deviations** — D-1, D-2, D-3 each interpret the refined spec; if Oscar reads any
     differently, the affected slice changes shape. Surfaced above for a Gate-P call.
  5. **Residual, accepted (documented, not solved):** torn mid-write copy, iCloud/OneDrive
     placeholder files, cross-device passphrase change, and lazy-auto-lock latency — reduced by
     the design, called out in `docs/sync.md` and doctor hints.

---

## 9. Repo structure after execution

```
src/
├── shared/
│   ├── application/ports/clock.ts
│   ├── domain/result.ts
│   └── infra/
│       ├── sqlite.ts                         (changed: WAL → DELETE fold-and-switch)
│       ├── sqlite.test.ts                    (changed: single-file-at-rest asserts)
│       ├── vault-paths.ts
│       ├── state-paths.ts                    (new: non-synced device-state path)
│       ├── migrations.ts                     (changed: register migration 003)
│       ├── migrations.test.ts
│       ├── upgrade-wal.test.ts               (new: populated WAL → rollback upgrade)
│       └── migrations/
│           ├── 001-init.ts
│           ├── 002-imported-type.ts
│           ├── 003-lineage.ts                (new: seed lineage_generation baseline)
│           └── 003-lineage.test.ts           (new)
├── vault/
│   ├── domain/
│   │   ├── errors.ts                         (changed: + VAULT_FORK_DETECTED)
│   │   ├── values/
│   │   │   ├── key-hex.ts | passphrase.ts    (unchanged)
│   │   │   ├── device-id.ts                  (new) + device-id.test.ts
│   │   │   ├── generation.ts                 (new) + generation.test.ts
│   │   │   ├── write-stamp.ts                (new) + write-stamp.test.ts
│   │   │   └── auto-lock-ttl.ts              (new) + auto-lock-ttl.test.ts
│   │   └── services/
│   │       ├── vault-lineage.ts              (new: classifyLineage) + vault-lineage.test.ts
│   ├── application/
│   │   ├── policies/
│   │   │   └── session-guard.ts              (new: idle auto-lock) + session-guard.test.ts
│   │   ├── ports/
│   │   │   ├── crypto.ts | keychain.ts        (unchanged)
│   │   │   ├── vault-store.ts                (changed: + readLineage)
│   │   │   ├── lineage-store.ts              (new)
│   │   │   ├── device-identity.ts            (new)
│   │   │   └── vault-folder.ts               (new)
│   │   └── use-cases/
│   │       ├── create-vault.use-case.ts       (unchanged)
│   │       ├── unlock-vault.use-case.ts      (changed: detect fast-forward/fork + activity)
│   │       ├── lock-vault.use-case.ts        (changed: verify single file + report)
│   │       ├── vault-status.use-case.ts      (changed: sync/session fields)
│   │       └── *.use-case.test.ts            (changed: unlock/lock/status)
│   └── infra/
│       ├── argon2.ts | vault-header.ts | recovery-kit.ts | keyring.ts   (unchanged)
│       ├── file-vault-store.ts               (changed: implement readLineage)
│       ├── sqlite-lineage-store.ts           (new) + sqlite-lineage-store.test.ts
│       ├── file-device-identity.ts           (new) + file-device-identity.test.ts
│       └── file-vault-folder.ts              (new) + file-vault-folder.test.ts
├── context/
│   ├── application/
│   │   ├── ports/vault-session.ts            (changed: + write() seam)
│   │   └── use-cases/
│   │       ├── save-context.use-case.ts      (changed: wrap in session.write)
│   │       └── import-items.use-case.ts      (changed: wrap in session.write)
│   └── infra/
│       ├── item-repo.ts | project-repo.ts     (unchanged under recommended D-3)
│       ├── vault-sessions.ts                 (changed: guard + lineage bump seam)
│       └── vault-sessions.test.ts            (changed: bump atomicity)
├── importers/                                 (unchanged)
├── delivery/
│   ├── container.ts                          (changed: wire new ports/adapters/TTL)
│   ├── multi-device-sync.test.ts             (new: two-device fast-forward/fork/auto-lock)
│   ├── cli/
│   │   ├── vault-commands.ts                 (changed: lock/status/unlock output)
│   │   ├── doctor.ts                         (changed: sync/session checks)
│   │   └── program.ts                        (unchanged under D-5 "defer --cloud")
│   └── mcp/server.test.ts                    (changed: assert surface unchanged)
└── testing/test-vault.ts                     (changed: FakeDeviceIdentity + guard wiring)

specs/
├── shared.md      (changed: DELETE journal, state-paths, migration 003)
├── vault.md       (changed: lineage, device identity, auto-lock, lock/unlock/status, fork)
└── delivery.md    (changed: lock/unlock/status/doctor, TTL env, state env, --cloud note)

docs/
├── SPEC.md        (changed: §2 roadmap, new §10b, §12 Q3 resolved)
└── sync.md        (new: BYO-cloud ritual + fork resolution guide)
```

---

**Plan path:** `advances/M3/plan.md`. Implementation must not begin until Oscar reviews this
plan and records an `Approved:` line at its top; the orchestrator halts for that approval at
Gate P.
