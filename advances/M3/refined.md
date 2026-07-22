# M3 — Bring-your-own-cloud vault sync · Refined Spec

**Status:** Draft for Gate R (not approved) · **Milestone:** post-0.2.0 (targets 0.3.0)
**Legend:** each open decision lists options and a recommended **Default** with a reason.
Nothing here is settled; every `D-x` needs Oscar's confirmation at Gate R.

---

## 1. Goal

Let a user keep valija's encrypted vault in a folder that a sync client they already
trust (Dropbox, iCloud Drive, OneDrive, Google Drive, Syncthing, …) replicates, so they
can **lock the vault on device A, let the folder sync, and unlock it on device B to
continue where they left off**. valija itself still only ever talks to the local
filesystem — no backend, no accounts, no network, no telemetry. The whole advance is
about making a single SQLCipher vault file *survive* living inside a folder a third-party
sync client is also watching, and about giving the user a clear, honest ritual and a
fork-detection safety net so a careless multi-device edit cannot silently destroy data.

This is the **bring-your-own-cloud** shape Oscar chose. The rejected **valija-hosted sync
service** (a backend that stores/syncs the blob with device pairing/accounts) is out of
scope and must not be half-built toward (see §5 Out).

---

## User walkthrough — the workflow from the user's perspective

**Why:** today a vault is single-machine (`~/.valija`, or wherever `VALIJA_HOME` points).
A developer who works on a laptop and a desktop has no way to carry their saved context
across. BYO-cloud makes the vault folder portable through the user's own sync client,
with valija indifferent to which client that is.

**0. Setup (one-time).** The user points valija at a folder their sync client already
replicates, using the existing `VALIJA_HOME` mechanism, and inits (or moves an existing
vault) there:
```
export VALIJA_HOME="$HOME/Dropbox/valija"     # or ~/Library/Mobile Documents/... for iCloud, etc.
valija init                                    # passphrase x2, prints the recovery kit once
```
Nothing about the passphrase, key, or recovery kit changes: the salt + KDF params live in
the plaintext `vault.json`, which syncs alongside `vault.db`, so **the same passphrase
derives the same key on every device** (D-B keeps the header untouched).

**Safety-to-sync is not a step the user has to remember.** Because of D-A, valija leaves
the vault as a **single consistent `vault.db` (no `-wal`/`-shm`/`-journal` siblings) after
*every* command** — not only after an explicit `valija lock`. So the folder is always in a
sync-safe state the moment any valija command returns; the sync client can upload a
coherent file at any idle moment. This is a load-bearing property of the design, not a
nicety: `valija lock` (step 1) and idle auto-lock (D-I) add the security of dropping the
key and an explicit "you can switch now" confirmation, but they are **not** what makes the
file safe to copy — D-A already guarantees that continuously.

**1. Work on device A, then hand off.**
```
valija save_context / import / etc.            # normal use — each leaves a single, sync-safe file
valija lock
```
`valija lock` now does more than drop the keychain key: it confirms the vault is at rest as
a **single consistent file** (no `-wal`/`-shm`/`-journal` sidecars) and prints an explicit
handoff confirmation, e.g.:
```
Vault locked. On-disk state: single file (vault.db), generation 42, last written by this device.
Safe to let your sync client finish uploading before opening valija on another device.
```

**2. The sync client uploads.** Dropbox/iCloud/etc. sees `vault.db` (and the static
`vault.json`) change and replicates them. valija is not involved and does not watch this.

**3. Continue on device B.** The user waits for their sync client to show "up to date",
then:
```
export VALIJA_HOME="$HOME/Dropbox/valija"      # same synced folder on device B
valija unlock                                  # same passphrase (or --recovery-key)
valija status
```
On unlock, valija reads the vault's **lineage stamp** (generation + writer id, stored
inside the encrypted db). It sees the vault advanced cleanly from a generation this device
has never diverged from — a clean **fast-forward** — adopts it silently, and the user
picks up exactly where device A left off. `valija status`/`doctor` can show
`generation 42, last written by device-A` so the user can confirm their latest changes
arrived.

**4. The fork / warn path (the safety net).** If the user ignored the ritual and edited on
both devices before either synced, the sync client keeps only one copy (last-write-wins)
and usually drops a `vault (conflicted copy).db`-style file in the folder. On the next
`valija unlock`, valija detects that the vault is at a generation it also wrote, but with a
**different stamp** — provable divergence — and refuses to pretend nothing happened:
```
error [VAULT_FORK_DETECTED]: This vault was changed on another device from the same
starting point (generation 42). Your sync client may have kept only one copy; changes made
on the other device may be in a "conflicted copy" file in <folder>. valija has not deleted
anything. Run `valija doctor` to inspect, and see docs on resolving a sync fork.
```
valija never auto-merges and never auto-discards; the user resolves it (both encrypted
copies are openable with the same passphrase).

**5. Idle auto-lock (D-I).** If the user simply walks away, valija does not stay unlocked
forever. The next command (or session open) after the configured idle TTL (default 15 min)
finds the vault stale, treats it as locked (drops the keychain key), and asks for a fresh
`valija unlock`. There is no background process — the check is lazy, at the next command.
Because D-A already keeps the file sync-safe after every command, an auto-lock needs no
extra flush; it just removes the key.

**6. How the new data is used afterward — the load-bearing distinction.** The lineage
stamp, device identity, and last-activity timestamp are **internal sync-safety / session
metadata only**:

| Surface | Sees sync/lineage/session metadata? |
|---|---|
| `valija status` / `valija doctor` | yes — generation, last-writer id, at-rest single-file check, cloud-folder hints, idle/auto-lock state |
| `valija lock` output | yes — the "safe to switch" confirmation |
| `valija unlock` | yes — only to emit the fork warning / prompt after auto-lock |
| Context pack — MCP `get_context` / `valija export` | **no — never** |
| MCP tools (`search_context`, `save_context`, `list_projects`, …) | **no — the MCP surface is unchanged** |

Sync/session metadata is plumbing for humans and for safety, not content: no model ever
sees it, it never enters a context pack, and no new MCP tool or argument is added. This
keeps M3 from touching the product's AI-facing surface at all.

---

## 2. Context snapshot (load-bearing facts from the current codebase)

A planner must not contradict these.

- **Vault paths.** `resolveVaultPaths(override?)` (`src/shared/infra/vault-paths.ts`)
  returns `{ root, header: vault.json, db: vault.db }`; root precedence is explicit
  override → `VALIJA_HOME` → `~/.valija`. **Pointing the vault at a synced folder already
  works today** — no code change is needed just to *place* it there.
- **WAL is on, unconditionally.** `openVaultDb` (`src/shared/infra/sqlite.ts`) runs
  `PRAGMA journal_mode = WAL` on **every** open, so `vault.db-wal` and `vault.db-shm`
  sidecar files exist whenever the db is open, and committed data can live in `-wal`
  before a checkpoint. This is the crux of the sync hazard (§3).
- **Sessions are short and one-connection.** Every CLI command and every MCP call opens
  its own session (`SqliteVaultSessions.open` → `openVaultDb` → `migrate` → work →
  `db.close()`). valija barely uses WAL's concurrency benefit (concurrent readers + one
  writer); it opens a single connection, does a little work, and closes.
- **`valija lock` does not touch the db file.** `LockVault` (`src/vault/application/
  use-cases/lock-vault.use-case.ts`) only deletes the keychain key and returns
  `wasUnlocked`. It performs no checkpoint and makes no "safe to sync" guarantee today.
- **The plaintext header is effectively static.** `vault.json` carries `vaultId`,
  `schemaVersion` (`z.literal(1)`), KDF params, base64 `salt`, `createdAt`. It is written
  at init and only rewritten on a passphrase/KDF change (not currently a shipped command).
  The zod schema strips unknown keys, so a newer field would be silently ignored by an
  older reader — but the header is a *second* file the sync client must keep in step, so
  adding sync state to it reintroduces a multi-file-consistency problem (see D-B).
- **Migrations are gated by `meta.schema_version` inside the encrypted db** and run
  automatically on the next session open (`migrate(db, dbPath)` in
  `src/shared/infra/migrations.ts`) — **including a session an MCP server launched in the
  background**. `backupCiphertext` already does `wal_checkpoint(TRUNCATE)` before copying.
  Only migrations 001 and 002 exist.
- **Same passphrase → same key on any device.** Argon2id is deterministic for
  `passphrase + salt + params`; the salt/params are in `vault.json`. No key/keychain
  change is needed for multi-device: each device's OS keychain independently holds the
  session key after that device's `valija unlock`.
- **No auto-lock / TTL exists today.** `docs/SPEC.md` §12 open question 3 ("`valija unlock`
  TTL / auto-lock: M2+?") is still open; the key persists in the keychain until an explicit
  `valija lock`. M3 resolves this (D-I).
- **Module-first / hexagonal.** `shared ← everyone · vault → shared · context → shared,
  vault · importers → shared, context · delivery → all`. `context` reaches `vault` only
  through the `VaultSessions` bridge. `doctor` (`src/delivery/cli/doctor.ts`) already runs
  a list of `Check`s (node, sqlcipher, keychain, vault state, client configs).
- **Specs are contracts.** A behaviour change updates the matching `specs/*.md` in the
  same commit. M3 will touch `specs/shared.md`, `specs/vault.md`, `specs/delivery.md`, and
  `docs/SPEC.md` (roadmap + a new milestone section — see D-H).

---

## 3. The central hazard — multi-file & multi-writer consistency (must not be hand-waved)

A cloud sync client replicates *whichever files changed*, with **no awareness of SQLite's
multi-file consistency rules**. Three concrete failure modes:

1. **Sidecar skew (WAL).** In WAL mode the current database is `vault.db` **plus** its
   `-wal` (and `-shm`). If the sync client uploads `vault.db` without an up-to-date
   `-wal`, or uploads them out of order, or another device's stale `-wal` lands over a
   local db, the reconstructed vault is stale or corrupt. `vault.db` alone is *not* the
   current database until a checkpoint folds the WAL in.
2. **Last-write-wins clobber (multi-writer).** If two devices both wrote before either
   synced, the sync client keeps one file and discards the other (or writes a
   vendor-specific "conflicted copy"). valija operates on **one opaque encrypted blob it
   cannot merge**, so it cannot recover the discarded edits — it can only *detect* the
   fork after the fact and warn (D-B).
3. **Torn copy mid-write.** If the sync client copies `vault.db` while valija holds a
   write transaction open, the uploaded bytes can be a partial write. valija's sessions
   are short, which shrinks the window, but it cannot control the vendor's copy atomicity.

Two more BYO-cloud realities to acknowledge (residual, see §5/§7):

- **Placeholder / dataless files.** iCloud Drive "Optimize Storage" and OneDrive
  Files-On-Demand can leave `vault.db` as a not-yet-downloaded placeholder; opening it may
  fail or force a download. valija should surface this rather than crash cryptically.
- **The header is a second file.** `vault.json` must sync too, but it is effectively
  static after init, so in steady-state use only `vault.db` changes — which is why keeping
  sync state *out* of the header (D-B) preserves the single-changing-file property.

The design's job is to (a) make the **at-rest on-disk footprint a single self-consistent
file** so modes 1 and 3 are minimized, (b) give the user an explicit, correct **handoff
ritual** so mode 2 does not arise in the supported sequential flow, and (c) **detect** mode
2 and warn without ever clobbering when the ritual is ignored.

---

## 4. Scope

### In
1. Change the vault's on-disk journaling so that **at rest it is a single consistent
   file** with no `-wal`/`-shm`/`-journal` siblings — true after **every** command, not
   only after `lock` (D-A).
2. A **lineage stamp** (generation + writer identity + a per-write random stamp) stored
   **inside the encrypted db**, bumped on every write, enabling clean fast-forward
   adoption and provable **fork detection** (D-B, D-C).
3. A **device identity** provider (a stable, device-local, non-synced id) (D-C).
4. `valija lock` extended into the explicit **"safe to switch devices" signal**: confirm
   the vault is at rest as a single file, assert no sidecars remain, print the handoff
   confirmation (D-D).
5. `valija unlock` / session open extended to **read the stamp**, silently adopt a clean
   fast-forward, and emit `VAULT_FORK_DETECTED` (never auto-clobber) on divergence (D-B).
6. **Idle auto-lock (D-I):** a device-local last-activity timestamp, checked lazily at the
   next session open / command; past the configured TTL (default 15 min, configurable) the
   vault is treated as locked (keychain key dropped) and a fresh `valija unlock` is
   required. No background process. This resolves `docs/SPEC.md` §12 open question 3.
7. `valija status` / `valija doctor` extended with sync-safety + session checks: current
   generation + last-writer, at-rest single-file assertion, cloud-folder path hint, a loud
   warning if vendor "conflicted copy" files are present, and idle/auto-lock state (D-E).
8. A safe **upgrade path** for existing WAL vaults: fold any `-wal` into the main file,
   switch journaling, and initialize the lineage rows on populated encrypted data (D-G).
9. Docs + specs: `docs/SPEC.md` roadmap + new milestone section and §12 Q3 resolved (D-H),
   `specs/shared.md`, `specs/vault.md`, `specs/delivery.md`, and a user-facing "sync your
   vault with your own cloud folder (and how to resolve a fork)" doc.
10. Per-layer tests, including a multi-device simulation (two `VALIJA_HOME`s + a copy step
   standing in for the sync client) covering clean fast-forward and fork detection, an
   idle-auto-lock test (TTL elapsed → next command requires unlock), and an
   upgrade-on-populated-WAL-vault test.

### Out (explicit non-goals — name them so the planner does not drift toward the rejected shape)
- **No valija-hosted sync service / backend / accounts / device pairing.** valija never
  makes a network call. All transport is the user's own sync client.
- **No automatic conflict merge.** valija cannot 3-way-merge an opaque encrypted blob;
  fork handling is detect-and-warn, plus (optionally) a read-only inspection helper — never
  an automatic resolver.
- **No telemetry / phone-home / sync-state polling.** valija does not know whether the
  cloud client is "up to date"; the user relies on their client's own indicator.
- **No concurrent *simultaneous* multi-device unlock.** No distributed lock, no real-time
  collaboration. The supported model is strictly **sequential** ("used on A, then B").
- **No auto-upload/watcher inside valija**, no GUI, no mobile client. In particular,
  **no always-running background daemon** — including one that hooks OS shutdown/sleep
  events to auto-lock. Idle auto-lock (D-I) is deliberately the *lazy, no-process* design;
  the daemon approach is rejected and is not a future step.
- **No "is this file mid-sync?" heuristic on unlock** (peeking at file size/mtime
  stability to guess whether a sync is in flight). Explicitly rejected: it is unreliable
  across clients and would add fragile guesswork. The user relies on their sync client's
  own "up to date" indicator; valija relies on the deterministic fork-detection stamp
  (D-B), not on inferring sync state.
- **No cross-device passphrase-change coordination.** Rotating the passphrase rewrites the
  header *and* re-encrypts the db; doing that while other devices hold stale copies is a
  hazard we only warn about, not solve, in M3.
- **No automatic resolution of vendor "conflicted copy" files.** Detect and guide only.

---

## 5. Decisions to confirm (options + recommended defaults)

### D-A. At-rest consistency: journal mode (answers Q1)
The single biggest technical lever. What is on disk *at rest* must be one self-consistent
file, **after every command** (not just after an explicit lock).

- **Option 1 — switch to a rollback journal (`DELETE`, default; `TRUNCATE` variant).**
  Drop WAL; `openVaultDb` sets a rollback journal mode. At rest there is only `vault.db`
  (in `DELETE` mode the `-journal` is removed at commit; in `TRUNCATE` it is zero-length).
  Crucially, in rollback mode **`vault.db` alone is always the complete current database** —
  the journal only ever exists to *undo* an incomplete transaction. This removes sidecar
  skew (hazard 1) entirely at rest and matches valija's single-connection, short-session,
  low-write pattern, where WAL's concurrency wins are unused.
  *Trade-off:* rollback journaling gives less read/write concurrency and is marginally
  slower under heavy concurrent writes — negligible for valija. `DELETE` touches directory
  metadata on each commit; `TRUNCATE` avoids that but leaves a 0-byte `-journal` a sync
  client will also replicate. **Recommend `DELETE`** for a truly single file at rest.
- **Option 2 — keep WAL, but `wal_checkpoint(TRUNCATE)` on every session close and on
  lock.** Preserves WAL locally; guarantees a single file only *after* a clean close/lock.
  *Trade-off:* between sessions while unlocked-but-idle, or after a crash, `-wal`/`-shm`
  can still exist and be uploaded independently → the sidecar-skew hazard survives in the
  windows that matter for continuous sync. More moving parts, weaker guarantee.
- **Option 3 — conditional mode:** WAL for a plain local vault, rollback for a detected
  cloud folder. *Trade-off:* adds a detection dependency and two code paths for a benefit
  valija does not need (WAL buys it little). Over-engineered.
- **Default: Option 1 (`DELETE`).** Simplest, and it is the only option under which the
  main file at rest is *unconditionally* the current, self-consistent database after every
  command. Keep `PRAGMA synchronous` at its safe default (do **not** downgrade to `OFF`)
  so rollback journaling stays crash-safe. Oscar confirmed he specifically values that
  safety-to-sync is a byproduct of this, not dependent on the user running `lock`.

### D-B. Fork detection & the lineage stamp (answers Q2)
Goal: silently adopt a clean handoff; **provably detect** divergence and refuse to clobber.

- **What to store.** A **lineage stamp** committed atomically with each write:
  `writerDeviceId`, a monotonically increasing `generation` counter, and a random
  per-write `stamp` (ULID). Optionally `lastWrittenAt` for display.
- **Where to store it.**
  - **Option 1 — inside the encrypted db (`meta` table).** Travels atomically with the
    data (single-file consistency preserved), leaks nothing in plaintext. Readable only
    after unlock — which is exactly when the user is on the new device anyway.
  - **Option 2 — in the plaintext `vault.json` header.** Would allow a pre-unlock warning,
    but (a) leaks device ids / write counts / activity times in plaintext to the cloud
    vendor, and (b) makes the header a *second changing file* the sync client must keep in
    step, reintroducing multi-file skew. Rejected.
  - **Default: Option 1** — the stamp lives in the encrypted `meta` table; the header stays
    exactly as it is today (`schemaVersion` literal `1`, no new plaintext).
- **Detection logic (linear counter + random stamp).** Each device remembers, in
  device-local state (D-C), the `(generation, stamp)` it last saw/wrote for this vault.
  On session open the db's current `(generation, stamp)` is compared:
  - db `stamp` == my last-seen `stamp` → in sync, proceed, bump on write.
  - db `generation` > my last-seen, `stamp` unknown to me, and I have **no** unsynced local
    writes → **clean fast-forward**: another device advanced the vault and it synced down
    cleanly. Adopt silently, update last-seen. (The good sequential path.)
  - db `generation` == a generation I also wrote but `stamp` != mine, **or** db
    `generation` < my last-written generation → **`VAULT_FORK_DETECTED`**: same start point,
    two different writes, i.e. the sync client kept only one copy. Warn, point at the
    vendor conflicted-copy file, do **not** discard anything.
- **Why not a full vector clock?** A per-device vector clock would let valija classify more
  divergence cases, but it is heavier, still cannot *merge* an opaque blob, and the linear
  counter + random per-write stamp already catches the case that matters (same generation,
  different stamp = provable fork). **Recommend the counter+stamp scheme**; note the vector
  clock as a deferred over-engineering option.
- **Honest limitation to document:** valija can only *detect and warn*; it cannot *prevent*
  the cloud client's last-write-wins from destroying the losing edit, because by the time
  valija runs, the filesystem already holds the winning blob. The real prevention is the
  lock-before-switch ritual (D-D), which is advisory.

### D-C. Device identity: source & storage (part of Q2)
The `writerDeviceId`, the "last-seen (generation, stamp)" record, and the D-I
last-activity timestamp must be **device-local and never synced** (if they lived in the
vault folder, every device would read the same values and both detection and auto-lock
would break).

- **Option 1 — a device-local state file outside `VALIJA_HOME`** (an OS user-config
  location, e.g. an app-config dir), holding a random device id (ULID) + a per-vault
  last-seen record keyed by `vaultId` + the per-vault last-activity timestamp (D-I).
  Simple, inspectable, not a secret.
- **Option 2 — the OS keychain.** Reuses `@napi-rs/keyring`, but the keychain is for
  secrets and a device id / timestamp is not one; also awkward for the per-vault maps.
- **Option 3 — derive from hostname / OS machine id.** No storage, but hostnames are not
  reliably unique or stable and can collide.
- **Default: Option 1** — a device-local, non-synced state file holding a generated device
  id, the per-vault last-seen map, and the per-vault last-activity timestamp. Expose it
  through a `DeviceIdentity` port with a file-backed adapter (naming per conventions, e.g.
  `FileDeviceIdentity`).

### D-D. The "safe to switch" signal: extend `lock`, or add `valija sync`? (answers Q3)
- **Option 1 — fold it into `valija lock`.** Lock already means "I'm done here." Extend it
  to (i) confirm the vault is at rest as a single consistent file (given D-A, this is a
  verify, not new machinery), (ii) assert no `-wal`/`-shm`/`-journal` remain, (iii) drop
  the keychain key (unchanged), (iv) print the explicit handoff line.
  No new command; matches the existing mental model.
- **Option 2 — a dedicated `valija sync` command** that flushes and reports independently
  of locking. More discoverable as a "sync" verb, but adds surface and blurs
  responsibility with `lock`; the user still has to lock for security anyway.
- **Default: Option 1.** Extend `lock`; add the single-file-at-rest report to `status`
  for anytime checking. Note that with D-A every command already leaves a single file at
  rest, so `lock`'s added value is the explicit, verified confirmation + key removal.

### D-E. Configuration & discoverability (answers Q4)
- **Option 1 — rely on `VALIJA_HOME` as-is, plus doctor guidance.** No new config; the
  vault is placed in a synced folder by pointing `VALIJA_HOME` there. `doctor` gains:
  report journal mode + at-rest single-file check; warn if sidecar files are present at
  rest (crash or wrong mode); a **path heuristic** that recognizes common cloud folders
  (name contains `Dropbox`/`OneDrive`/`Google Drive`, iCloud `Mobile Documents`, or a
  vendor marker file) and, if so, reminds the lock-before-switch ritual; a **loud warning**
  if a `*(conflicted copy)*` / `*.sync-conflict-*` file is found in the vault folder;
  report current generation + last-writer; report the auto-lock TTL and current idle state.
- **Option 2 — add `valija init --cloud <path>` and/or persist an `isCloud` flag.** Better
  discoverability and lets valija tune behaviour per-vault. *Trade-off:* given D-A makes
  journaling unconditional, there is little behaviour left to tune, and persisting a flag
  means either a header field (rejected, see D-B) or a new config file to keep in step.
- **Default: Option 1**, with `--cloud <path>` as an *optional* thin convenience that just
  sets the path and prints the cloud guidance (no behavioural branch). Keep configuration
  minimal; do not add a synced config file.

### D-F. Clean-architecture placement (DDD / hexagonal)
Where the new concepts live, so the planner keeps modules honest. Options to weigh:

- **Journaling (D-A):** unambiguously an infra detail in `src/shared/infra/sqlite.ts`
  (the shared persistence kernel). No domain change.
- **Lineage stamp + fork policy (D-B):** two placements to choose between —
  - *Option A — own the policy in `vault`.* `vault` owns unlock/lock/lifecycle, so a
    `VaultLineage` / `SyncGuard` domain service + value objects (`DeviceId`,
    `Generation`, `WriteStamp`) and a `DeviceIdentity` port live in `vault`; `UnlockVault`
    and `LockVault` consult it. The write-time bump is applied on the write path.
    Cleanest ownership, but the *bump on write* happens in a `context` session, so a small
    seam is needed for context's writes to advance the stamp.
  - *Option B — a shared `meta`-backed lineage adapter.* Since the stamp lives in the
    shared physical `meta` table, a thin repository/port in `shared` reads/writes it, and
    both `vault` (detect on open, flush/report on lock) and the write path (bump on
    commit) use it. Less conceptual purity, fewer seams.
  - **Recommend Option A for the policy** (fork classification and the user-facing
    decision belong to the security subdomain, `vault`) **with the stamp read/write
    exposed as a narrow port** so the write path can bump it without importing SQLite.
    Keep it out of `domain/` I/O rules: values + a domain service in `vault/domain`, ports
    in `vault/application`, adapters in `vault/infra` and/or `shared/infra`.
- **Device identity + idle auto-lock (D-C, D-I):** a `DeviceIdentity` port (application) +
  file-backed adapter (infra) for the device id / last-seen / last-activity state; the
  auto-lock TTL check is an application-level policy in `vault` (it gates unlock/session
  open and reuses `LockVault`'s key removal). Composed in `src/delivery/container.ts` like
  every other adapter.
- **`lock`/`unlock`/`status`/`doctor` wiring:** delivery-layer only; no new bounded
  context. Follow the existing `Check` pattern in `doctor.ts`.

This is a set of options, not a mandate: the planner should pick the seam that keeps
`context → vault` one-directional (via the session bridge) and avoids leaking
`better-sqlite3` types across ports.

### D-G. Upgrade path for existing WAL vaults (highest-risk surface after D-A)
Existing 0.2.x vaults are in WAL mode and have no lineage rows. The switch must be safe on
**populated, encrypted, real data**, and runs on the next session open — possibly one an
MCP server launched.

- Required care: on first open after upgrade, **checkpoint any existing `-wal` into
  `vault.db` before switching journal mode** (so no committed data is stranded), then
  switch to the rollback journal, then **initialize the lineage `meta` rows** (generation
  0/1, this device as first writer, a fresh stamp).
- **Option 1 — do it as migration 003** (schema_version 2 → 3), inside the existing
  transactional migration runner, guarded by `schema_version`. Consistent with the ritual;
  note that `journal_mode` is a pragma (persistent once switched) and cannot be toggled
  inside the same transaction that other statements run in, so the journaling switch and
  the checkpoint likely happen at open time (in `openVaultDb`) while the lineage-row
  initialization is the actual migration 003 data step. The planner must sequence these
  precisely.
- **Option 2 — lazy bootstrap at open** (no schema bump): checkpoint + switch on open,
  upsert missing lineage rows on first write. Lighter, but scatters the upgrade logic and
  is harder to test as a unit.
- **Default: Option 1** (migration 003 for the data rows; the checkpoint + journal switch
  handled at open), with a **ciphertext backup before touching a populated vault**
  (mirroring M2's migration-002 precedent), deleted after a verified successful open.

### D-H. Roadmap / milestone renaming in `docs/SPEC.md` (answers "M3 may reshuffle")
`docs/SPEC.md` §2 currently lists **M3 = GUI + encrypted backup/restore** and
**M6 = multi-device sync, mobile**. This advance makes **M3 = BYO-cloud vault sync**.

- **Default:** redefine M3 to BYO-cloud sync; push GUI and encrypted backup/restore to a
  later milestone; note that BYO-cloud is the first, lower-risk slice of what §2 called
  "multi-device sync (M6)", with a valija-hosted service still explicitly rejected. Add a
  new **§10b — M3 — BYO-cloud vault sync** section mirroring §10a (M2), update the §2
  roadmap list, and **resolve §12 open question 3** (auto-lock TTL) as delivered by D-I —
  all in the same commit as the code. This renaming is a decision for Oscar to confirm at
  Gate R, not a settled fact.

### D-I. Idle auto-lock after a TTL (resolves `docs/SPEC.md` §12 Q3)
Oscar wants the vault to auto-lock after inactivity rather than relying purely on the user
remembering `valija lock`. The mechanism must be lightweight — **no background daemon, no
continuously-running process, no OS shutdown/sleep hooks** (all rejected, see §5 Out).

- **Mechanism (recommended).** Store a device-local **last-activity timestamp** per vault
  (alongside the D-C device-identity/last-seen state, **not** synced). On every session
  open / command, before doing work, compare `now − lastActivity` to the configured TTL:
  - within TTL → refresh the timestamp and proceed.
  - past TTL → treat the vault as locked: proactively drop the keychain key (reuse
    `LockVault`'s behaviour) and return the standard `VAULT_LOCKED` result, so the command
    fails cleanly and the user must `valija unlock` again. No flush is needed because D-A
    already leaves the file sync-safe after the previous command.
- **What counts as "activity".** Options: (a) any command (read or write) refreshes the
  timestamp; (b) only writes refresh it, so a vault used read-only still times out. Default:
  **(a) any successful command refreshes**, matching a typical "session" mental model; note
  (b) as a stricter alternative.
- **Enforcement point.** Options: (1) proactively delete the keychain key when the TTL has
  elapsed (the vault genuinely locks, other tools see it locked too); (2) merely refuse the
  current command without deleting the key (softer, but the key lingers in the keychain).
  Default: **(1) proactively drop the key** — it is the honest "locked" state and keeps the
  keychain from holding a key past the intended session, which is the security point.
- **Default TTL and configuration.** Default **15 minutes**. Must be configurable; options
  for where: (a) an env var (e.g. `VALIJA_AUTOLOCK_MINUTES`, `0`/`off` to disable),
  consistent with `VALIJA_HOME` and the D-E "no synced config file" stance; (b) a CLI flag
  on `unlock` (e.g. `valija unlock --ttl 30`) recorded in the device-local state; (c) a
  config file. Default: **(a) env var, with `0`/`off` to disable**, plus surfacing the
  effective TTL in `valija status`/`doctor`. On is the default (TTL applies unless
  explicitly disabled).
- **Interaction with MCP.** The MCP server reads the keychain per call; once the key is
  dropped by auto-lock, MCP tools already return the standard "Vault is locked…" error —
  **no MCP surface change**. Auto-lock simply makes that path fire after inactivity.
- **Trade-off.** A purely lazy check means the vault does not *actually* lock at the moment
  the TTL expires — the key sits in the keychain until the *next* command notices and drops
  it. This is the accepted cost of "no daemon": there is no process to lock at the exact
  instant. Document this honestly; it still bounds practical exposure (the key is removed
  the next time valija runs) and avoids a background process entirely. A stricter,
  time-accurate lock would require the rejected daemon.

---

## 6. Security surfaces (must not weaken)

1. **Crypto unchanged.** Same SQLCipher whole-db encryption, same Argon2id derivation,
   same OS keychain per device. BYO-cloud does not touch key derivation or the key format;
   the cloud vendor only ever sees ciphertext `vault.db` plus the plaintext `vault.json`
   (vault id, KDF params, salt, created-at) — the **same exposure a third-party backup
   already has** per SPEC §9, not a new one.
2. **No new plaintext at rest.** The lineage stamp and device-writer id live **inside the
   encrypted db** (D-B Option 1); the plaintext header gains **nothing**. Do not add device
   ids, write counters, or activity timestamps to `vault.json` — that would leak metadata
   in plaintext and reintroduce multi-file skew. The D-I last-activity timestamp is
   device-local (D-C), never in the vault folder.
3. **Rollback journaling stays crash-safe.** D-A must keep `PRAGMA synchronous` at its safe
   default; never `synchronous=OFF`. A rollback journal exists precisely to survive a crash
   mid-write, so at-rest integrity is preserved, not weakened.
4. **No silent data loss.** Fork detection must **never** auto-delete, auto-overwrite, or
   auto-merge. On divergence it warns and leaves every copy intact; both copies remain
   openable with the same passphrase. Data safety is favored over convenience.
5. **Lock still means locked; auto-lock strengthens it.** Extending `lock` must not skip
   removing the keychain key, and the "safe to switch" report must only print after the
   verify actually succeeded. Idle auto-lock (D-I) **removes** the key after the TTL — it
   only ever tightens the unlocked window, never widens it; on by default. A locked vault
   on any device still refuses sessions with `VAULT_LOCKED`.
6. **MCP surface untouched.** No new tool, no new argument; sync/lineage/session metadata
   is never exposed to a model and never enters a context pack. Auto-lock reuses the
   existing "Vault is locked" path. Verified in acceptance.
7. **Device-local state is not a secret but must not sync.** The device id / last-seen /
   last-activity file holds no key material; it must live outside `VALIJA_HOME` so it does
   not replicate.
8. **Upgrade integrity.** D-G runs on real encrypted data: transactional data step,
   ciphertext-only backup, checkpoint-before-switch so no committed data is stranded, and
   a green upgrade-on-populated-WAL-vault test gate before release.
9. **Residual, accepted risks (document, do not pretend to solve):** (a) the cloud client
   copying `vault.db` mid-write can produce a torn upload — mitigated by short sessions and
   the lock-before-switch ritual; (b) placeholder/dataless files (iCloud/OneDrive) may not
   be fully materialized when valija opens them — surface a clear error/doctor hint rather
   than crash; (c) a passphrase change while other devices hold stale copies is unsupported
   and warned against; (d) idle auto-lock is lazy, so the key persists in the keychain
   until the next command after the TTL elapses (no daemon by design).

---

## 7. Acceptance criteria (reviewer checklist)

**At-rest single-file consistency (D-A)**
- [ ] After **any** completed command and after `valija lock`, the vault folder contains a
      single `vault.db` with **no** `-wal` / `-shm` / `-journal` sibling at rest — the
      sync-safe state does not depend on the user running `lock`.
- [ ] `vault.db` opened in isolation (no sidecars present) is the complete, current
      database — a copy of just `vault.db` between operations loses no committed data.
- [ ] `PRAGMA synchronous` is not weakened to `OFF`; a simulated crash mid-write leaves a
      recoverable, non-corrupt vault.

**Fork detection & lineage (D-B / D-C)**
- [ ] Each write bumps the generation and writes a fresh random stamp inside the encrypted
      `meta`; the plaintext `vault.json` is unchanged (still `schemaVersion` literal `1`,
      no device/generation fields).
- [ ] Two-device simulation (two `VALIJA_HOME`s + a copy step for the sync client): a clean
      A→B handoff fast-forwards silently on B and continues; the reverse B→A also adopts.
- [ ] Divergence simulation (both write from the same generation, then a copy overwrites):
      the next unlock reports `VAULT_FORK_DETECTED`, deletes/overwrites nothing, and both
      encrypted copies remain openable with the same passphrase.
- [ ] The device id / last-seen / last-activity record lives outside `VALIJA_HOME` and is
      not written into the synced folder.

**Handoff ritual (D-D)**
- [ ] `valija lock` verifies the single-file-at-rest state, removes the keychain key, and
      prints an explicit "safe to switch devices" confirmation including the current
      generation.
- [ ] `valija status` reports the at-rest single-file state, current generation,
      last-writer id, and auto-lock TTL / idle state; none of this appears in `get_context`
      / `export` output.

**Idle auto-lock (D-I)**
- [ ] With the vault unlocked and the TTL elapsed (injectable clock), the next command /
      session open drops the keychain key and returns `VAULT_LOCKED`; a fresh `valija
      unlock` is required to continue.
- [ ] Within the TTL, activity refreshes the last-activity timestamp and the vault stays
      unlocked; the timestamp lives in device-local state, not the synced folder.
- [ ] The TTL is configurable (default 15 minutes) and can be disabled (`0`/`off`); the
      effective TTL is visible in `status`/`doctor`. When the key has been dropped by
      auto-lock, MCP tools return the existing "Vault is locked" error with no surface
      change.

**Config & doctor (D-E)**
- [ ] `valija doctor` reports journal mode + the single-file check, warns on stray sidecar
      files at rest, recognizes a common cloud-sync folder by path/marker and prints the
      ritual reminder, warns loudly if a vendor "conflicted copy" file exists in the
      folder, and reports the auto-lock TTL / idle state.
- [ ] Placing the vault via `VALIJA_HOME` in a synced folder needs no code change; the
      optional `--cloud <path>` (if adopted) only sets the path and prints guidance, with
      no behavioural branch.

**Upgrade (D-G)**
- [ ] A populated **WAL** vault from 0.2.x upgrades on next open: any WAL data is folded in,
      journaling switches, lineage rows initialize, row count + content are identical
      before/after, and FTS search still returns every original item.
- [ ] The upgrade takes a ciphertext backup before touching populated data and removes it
      only after a verified successful open; a forced mid-upgrade failure leaves the prior
      state fully intact.

**Security & surface**
- [ ] No network call is added anywhere; no telemetry; no background process/daemon and no
      OS shutdown/sleep hooks (auto-lock is lazy at command time only).
- [ ] The MCP surface (tools, arguments, prompts) is byte-for-byte unchanged; a test
      asserts no sync/lineage/session data reaches any tool response or context pack.
- [ ] Crypto path unchanged: imported/saved rows remain unreadable in `vault.db` without
      the key; the same passphrase opens the vault on a second device.

**Docs & specs (D-H)**
- [ ] `docs/SPEC.md` §2 roadmap updated, a new §10b (M3 — BYO-cloud sync) added, and §12
      open question 3 (auto-lock TTL) marked resolved by D-I; `specs/shared.md` (journal
      mode), `specs/vault.md` (lineage/device identity/lock flush/fork/auto-lock), and
      `specs/delivery.md` (`lock`/`unlock`/`status`/`doctor` changes, TTL config, optional
      `--cloud`) updated in the same commit.
- [ ] A user-facing doc explains: place the vault in a synced folder, the lock → sync →
      unlock ritual, idle auto-lock + how to configure/disable the TTL, and how to resolve
      a `VAULT_FORK_DETECTED` (find the conflicted copy, compare, choose).

---

## 8. Deliverables summary (for the planner, not a plan)

A journal-mode change in `src/shared/infra/sqlite.ts` (WAL → rollback, D-A); a lineage
concept in `vault` (device id + generation + write-stamp values, a fork-detection domain
service, ports for reading/writing the stamp in the encrypted `meta` and for device
identity, with adapters), wired so the `context` write path bumps the stamp without
importing SQLite; a device-local, non-synced `DeviceIdentity` adapter holding the device
id, per-vault last-seen map, and last-activity timestamp; idle auto-lock (D-I) as a
device-local TTL policy checked lazily at session open, reusing `LockVault`'s key removal
and configurable via env var (default 15 min); extended `LockVault` (verify + report),
`UnlockVault`/session-open (fast-forward vs fork, plus the TTL check), `status`, and
`doctor` (journal mode, sidecar check, cloud-folder hint, conflicted-copy warning,
generation + auto-lock/idle report); migration 003 + open-time checkpoint/switch for the
WAL→rollback upgrade with a ciphertext backup (D-G); `docs/SPEC.md` roadmap + new §10b +
§12 Q3 resolved; three touched `specs/*.md`; a user-facing sync doc; per-layer tests
including the two-device fast-forward/fork simulation, the idle-auto-lock test, and the
upgrade-on-populated-WAL test.

---

## 9. Biggest risk

**valija cannot *prevent* a cloud client's last-write-wins from silently destroying one
device's edits — it can only detect the fork afterward and warn.** The feature's real
safety rests on an *advisory* ritual (lock on A, wait for sync, unlock on B); nothing
enforces that the user actually locks or waits. Idle auto-lock (D-I) helps by dropping the
key after inactivity, but it is lazy (no daemon), so it does not force a lock at the exact
TTL and cannot make a user wait for sync to settle. A user who edits on two devices before
syncing loses data, and detection is only *best-effort* (the counter+stamp scheme catches
same-generation forks, but a badly-timed vendor reconciliation could still land a stale
blob that looks self-consistent). The mitigations — single-file-at-rest journaling after
every command, a loud lock-time handoff confirmation, fork detection that never clobbers,
doctor warnings on conflicted-copy files, and clear docs — reduce but do not eliminate
this. The secondary risk is the WAL→rollback upgrade running automatically against
populated encrypted vaults (possibly first triggered by a background MCP session), which
must be transactional, checkpoint-before-switch, and backed up, exactly like M2's
migration 002.
