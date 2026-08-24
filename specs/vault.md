# Spec: vault — the encrypted vault bounded context

Security subdomain. Ubiquitous language: **vault, passphrase, key, salt, recovery kit, lock/unlock, keychain, lineage, generation, write stamp, device identity, fork, fast-forward, auto-lock**. Depends only on `shared`.

## domain/errors.ts

`VAULT_NOT_FOUND · VAULT_ALREADY_EXISTS · VAULT_LOCKED · WRONG_PASSPHRASE · WEAK_PASSPHRASE · KEYCHAIN_ERROR · STORAGE_ERROR · INVALID_DEVICE_ID · INVALID_GENERATION · INVALID_WRITE_STAMP · VAULT_FORK_DETECTED · VAULT_UPGRADE_REQUIRED · RELOCATION_DESTINATION_OCCUPIED · RELOCATION_DESTINATION_UNUSABLE · RELOCATION_DESTINATION_NESTED · RELOCATION_SOURCE_UNSETTLED · RELOCATION_COPY_FAILED · RELOCATION_VERIFY_FAILED · RELOCATION_ROLLBACK_FAILED · VAULT_MUST_BE_LOCKED`

`VAULT_UPGRADE_REQUIRED` (GUI advance, D-J(b)): the vault's schema is behind `LATEST_SCHEMA_VERSION` and `UnlockInput.upgradeConfirmed` was not `true`. Nothing is migrated when this is returned.

The eight `RELOCATION_*`/`VAULT_MUST_BE_LOCKED` codes (GUI advance, D-R(c)) are `RelocateVault`'s full refusal vocabulary — see **Relocation** below.

`LOCKED_MESSAGE` also lives here (M3): the one literal both `SqliteVaultSessions` (context/infra) and `SessionGuard` return for a locked vault, so the two paths — "no key present" and "auto-lock dropped the key" — are indistinguishable to a caller.

## domain/values (M3: lineage)

- `device-id.ts` / `generation.ts` / `write-stamp.ts` — branded values. Ids are **opaque**, like every other id this codebase's `IdGenerator` produces (`Project`/`ContextItem` ids are unchecked too) — `parseDeviceId`/`parseWriteStamp` only require a non-empty string, not a specific shape. `Generation` is a non-negative integer counter (`GENERATION_ZERO`, `nextGeneration`).
- `auto-lock-ttl.ts` — `parseAutoLockTtl(raw?)`: unset/empty → 15 (minutes); `"0"`/`"off"` (case-insensitive) → `null` (disabled); a positive integer → itself; anything else → 15 (auto-lock is a safety net, never a reason to fail startup). `isIdleExpired(lastActivity, now, ttlMinutes)`.

## domain/services/vault-lineage.ts (M3, D-B)

Pure, no I/O. `LineageStamp = { generation, writeStamp, writer, writtenAt }` (the vault's current stamp) and `LineageSeen = { generation, writeStamp }` (what a device last saw). `classifyLineage(current, lastSeen): "in-sync" | "fast-forward" | "fork"`:
- `lastSeen === null` → `fast-forward` (never seen this vault before — the good sequential path on a fresh device).
- `current.writeStamp === lastSeen.writeStamp` → `in-sync`.
- `current.generation > lastSeen.generation` → `fast-forward` (another device advanced the vault cleanly and it synced down).
- otherwise (same-or-lower generation, different stamp) → `fork` — **provable divergence**: two devices wrote independently from the same starting point. Never auto-resolved.

## domain/services/vault-relocation.ts (GUI advance, D-R(c))

Pure, no I/O. `refuseUnsafeRelocation(request, platform?): DomainError | null` — every §4.7 step 30 refusal, checked in this fixed order against a `RelocationRequest { sourceRoot, destinationRoot, destinationInspection: VaultRootInspection, sourceInspection: VaultFolderInspection }` the caller already computed:

1. `destinationInspection.hasHeader || hasDb` → `RELOCATION_DESTINATION_OCCUPIED` (never merge).
2. `!exists || !writable` → `RELOCATION_DESTINATION_UNUSABLE`.
3. the destination is the source folder itself, or nested inside it (path containment after `resolve()`, case-insensitive on win32/darwin, case-sensitive on linux) → `RELOCATION_DESTINATION_NESTED`.
4. an unresolved conflicted copy or leftover `.pre-NNN.bak` in the source → `RELOCATION_SOURCE_UNSETTLED`.
5. a sidecar present in the source (not at rest) → `RELOCATION_SOURCE_UNSETTLED` (same code as 4 — both mean "the source folder isn't in a safe state to move from").

Returns `null` when none apply — nothing has been written either way; the caller (`RelocateVault`, or a preflight preview that never calls it) decides what happens next.

## application/ports (this module owns its technical ports)

- `crypto.ts` — `VaultCrypto`: Argon2id derivation to a 32-byte key + salt generation. Default KDF: 64 MiB, t=3, p=1.
- `keychain.ts` — `KeychainPort`: set/get/delete the session key by vault id.
- `vault-store.ts` — `VaultStore` + `VaultHeaderData`: header read/write/exists, DB init, key verification, db path, and (M3) `readLineage(keyHex)` — opens, verifies the key (`WRONG_PASSPHRASE` on mismatch), migrates, reads the lineage stamp, closes. `null` means the vault has never been written to yet. (GUI advance, D-J(b)) `readSchemaVersion(keyHex)` — opens, reads `schemaVersion(db)`, closes; **never calls `migrate`** — the one read that must not have a migration side effect, so `UnlockVault` can gate on it before `readLineage` runs.
- `lineage-store.ts` (M3) — `LineageStore`: `read()` (the stamp, or `null`) and `bump(writer)` (advance the generation, mint a fresh stamp, persist, return it). Deliberately narrow — no SQLite types — so the write path can bump it without importing the storage engine.
- `device-identity.ts` (M3) — `DeviceIdentity`: `deviceId()` (stable, lazily created), `lastSeen`/`recordSeen` (per-vault lineage), `lastActivityAt`/`recordActivity` (per-vault idle timer, D-I). All device-local, never synced.
- `vault-folder.ts` (M3) — `VaultFolder`: `inspect()` → `{ sidecars, conflictedCopies, staleBackups, looksLikeCloud }`, a filesystem-only read of the vault root (never opens the database). `sidecars`, `conflictedCopies` and `staleBackups` are all **absolute paths**, so callers render them consistently.
- `vault-mover.ts` (GUI advance, D-R(c)) — `VaultMover`: `inspect(root) → VaultRootInspection { exists, writable, hasHeader, hasDb }` · `copy(from, to)` · `matches(from, to)` (byte-for-byte digest) · `discard(paths)` (best-effort partial-file cleanup, never throws) · `remove(paths)`. Five methods, each trivially fakeable — `RelocateVault`'s tests drive every failure stage without a real filesystem.

## application/policies/session-guard.ts (M3, D-I)

`SessionGuard` — a small application policy, not a `UseCase` (it gates sessions, it is never invoked directly by the CLI/MCP). Lives in its own `policies/` subfolder rather than bare next to `ports/`/`use-cases/`, per the repo's "no bare files at a layer's root" convention. `guard(vaultId)`: TTL `null` → refresh activity, `ok`. Past the TTL → `keychain.deleteKey(vaultId)` and the exact `VAULT_LOCKED` result — a genuine lock, not just a refusal, and indistinguishable from any other locked-vault path. Within the TTL → refresh activity, `ok`. No daemon: consulted lazily by `SqliteVaultSessions.open()` (context/infra) on every session open, right after the keychain-key check.

## application use cases

**CreateVault(passphrase)** — header exists → `VAULT_ALREADY_EXISTS`; under 8 chars → `WEAK_PASSPHRASE` (enforced by the `Passphrase` value object, never trimmed); else generate ULID vault id + 16-byte salt, derive key, write header, create+migrate the DB, **store the key in the keychain (a new vault starts unlocked)**, and **start the idle-activity clock** (D-I) — otherwise a vault created and then abandoned would have no activity timestamp and never auto-lock until its first session open. Returns `{ vaultId, keyHex, createdAt }` — the caller renders the recovery kit; the key is never persisted outside the keychain.

**UnlockVault({ passphrase | recoveryKeyHex, upgradeConfirmed? })** — recovery key must be 64 hex chars (lowercased); passphrase path derives with the header's stored salt + params (both resolved by the shared `resolveUnlockKey` service, also used by `CheckVaultUpgrade`). **(GUI advance, D-J(b)) Gated before `readLineage`**, which migrates as a side effect: if the schema is behind `LATEST_SCHEMA_VERSION` and `upgradeConfirmed` is not `true`, returns `VAULT_UPGRADE_REQUIRED` and touches nothing else. The CLI's `unlockCommand` always passes `upgradeConfirmed: true`, so its own behaviour — migrate silently — is unchanged. Past the gate: `readLineage` both verifies the key (`WRONG_PASSPHRASE` on mismatch) and reads the stamp in one open — no separate `verifyKey` call. On success: sets the keychain key, resets the idle-activity timer (M3), and classifies the lineage against this device's last-seen record. A `null` lineage or `fast-forward`/`in-sync` unlocks silently and records last-seen. A **`fork`** still unlocks (for inspection) but leaves last-seen untouched and returns `{ vaultId, fork: { generation, writer, notice } }` — `notice` is a `VAULT_FORK_DETECTED` `DomainError` the CLI renders, without failing the unlock outright (so the user isn't stranded from the tool — `doctor` — that helps resolve it).

**CheckVaultUpgrade({ passphrase | recoveryKeyHex })** (GUI advance, D-J(b)) — called only after `UnlockVault` has refused with `VAULT_UPGRADE_REQUIRED`, to describe the pending upgrade for a confirmation screen. Resolves the key the same way `UnlockVault` does, reads the schema version, and reports `{ required, from, to, backsUpCiphertext }` against `pendingMigrations` (shared/infra/migrations.ts) — `backsUpCiphertext` is true if any pending migration takes a ciphertext backup. Derives the key a second time on top of `UnlockVault`'s own attempt; an accepted cost on the rare upgrade path, not paid by the ordinary unlock.

**LockVault()** — reads the current lineage (best-effort, before dropping the key: a stale key or an unwritten vault just omits `generation`/`writer`/`writerIsThisDevice`, it never blocks the lock), deletes the key, inspects the vault folder for stray sidecars. Returns `{ wasUnlocked, generation?, writer?, writerIsThisDevice?, sidecars }`. Missing header → `VAULT_NOT_FOUND`. This is the "safe to switch devices" signal (D-D): with journaling always `DELETE` (shared/infra), `sidecars` empty means the vault genuinely is a single file at rest, not just "probably fine."

**VaultStatus()** — no header → `{ initialized: false, unlocked: false }`; otherwise `unlocked` is true only if a keychain key exists **and** actually opens the DB (a stale key reports locked). A single `readLineage` both verifies the key and reads the stamp — no separate `verifyKey`, so status opens the db once, not twice. Always reports `journalMode: "DELETE"`, `sidecars`, and `autoLock: { ttlMinutes, idleForMinutes?, expired? }` — purely informational; `VaultStatus` never itself drops the key, only `SessionGuard` does that, on an actual session open. When unlocked and the vault has been written to: `generation`, `lastWriter`, `lastWriterIsThisDevice`. Never touches context items, never feeds a context pack.

**RelocateVault(destinationRoot)** (GUI advance, D-R(c)) — moves the vault's two files to `destinationRoot`; re-pointing already-connected AI clients is deliberately not this use case's job (D-R(a)'s "no use case calls another" — the desktop's own `relocation-handlers.ts` orchestrates that, strictly after this returns `ok`). No `keyHex` anywhere in this use case: it reads the header, then refuses `VAULT_MUST_BE_LOCKED` if the keychain still holds the key (belt-and-braces on D-R(d) — a caller is expected to lock first), so relocation never has, and never needs, the raw key. The ordering guarantee, top to bottom, each line an action, **never any other order, never "delete then copy"** (§8.12):

```
read the header                       → VAULT_NOT_FOUND if absent
refuse if the keychain still holds the key   → VAULT_MUST_BE_LOCKED
refuseUnsafeRelocation(...)           → the typed refusal, having written nothing
mover.copy(source, destination)       → on throw: mover.discard(destination); RELOCATION_COPY_FAILED
mover.matches(source, destination)    → false: discard; RELOCATION_VERIFY_FAILED
readVaultHeader(destination.header)   → not ok: discard; RELOCATION_VERIFY_FAILED
mover.remove(source)                  → on throw: see the rollback rule below
ok({ root, vaultId })
```

**The source is removed only after the destination is verified complete and correct.** `RelocateVaultOutput` carries no `generation` — an encrypted vault's lineage cannot be read without the key this use case is proven not to have; "same lineage generation after the move" is proven by re-reading it once re-unlocked, not returned here.

**The rollback rule** (the one genuinely awkward failure): if the copy verifies but removing the source then fails, the app would be left with two openable copies of the same vault id — the exact fork scenario M3 exists to prevent. The destination copy is discarded and the source stays the one vault, returning `RELOCATION_COPY_FAILED` naming the source folder. If that discard *also* fails, `RELOCATION_ROLLBACK_FAILED` names **both** folders and says to delete one by hand — the only outcome in this design where the user must act, stated plainly rather than silently tolerated.

What relocation never touches, asserted by tests, not by intention: nothing under `VALIJA_STATE_HOME` is moved, copied or created inside the destination; the preferences file is device state and never lands inside the vault folder or the destination; the keychain entry is keyed by vault id, which does not change, so no entry is created, duplicated or orphaned — the only keychain effect is the deliberate lock before the move starts.

## infra

- `argon2.ts` — `Argon2VaultCrypto` (reference C impl): deterministic for same passphrase+salt+params; 32-byte keys, 16-byte salts.
- `vault-header.ts` — `vault.json` (plaintext): vaultId, schemaVersion 1, KDF params, base64 salt, createdAt. zod-validated on read; malformed → `STORAGE_ERROR`, missing → `VAULT_NOT_FOUND`. **Unchanged by M3** — no lineage/device/session field is ever added here (that would leak metadata in plaintext to a cloud vendor and reintroduce a second file the sync client must keep in step); lineage lives only inside the encrypted db.
- `recovery-kit.ts` — one-page text (raw key hex + vault id + instructions), shown once at init, **never stored by valija**.
- `keyring.ts` — `OsKeychain` via `@napi-rs/keyring`, service `valija`, account = vault id. Missing reads null; deleting a missing entry returns false; no throws.
- `file-vault-store.ts` — `FileVaultStore` implements `VaultStore` over the shared SQLite engine; takes an injected `IdGenerator`/`Clock` (M3) to build its `SqliteLineageStore` for `readLineage`.
- `sqlite-lineage-store.ts` (M3) — `SqliteLineageStore` implements `LineageStore` as four rows (`lineage_generation`, `lineage_stamp`, `lineage_writer`, `lineage_written_at`) in the shared `meta` table. `read()` returns `null` until all four exist (i.e. until the first real write bump — migration 003 seeds only the generation baseline, see [shared.md](shared.md)). `bump()` does not itself wrap a transaction — the write-time caller (context/infra) runs it inside its own.
- `file-device-identity.ts` (M3) — `FileDeviceIdentity` implements `DeviceIdentity` as JSON under `StatePaths` (shared/infra), outside `VALIJA_HOME` by construction. Lazily generates and persists the device id on first read; tolerates a missing/corrupt file by starting fresh — this is session bookkeeping, never a secret, so it never throws.
- `file-vault-folder.ts` (M3) — `FileVaultFolder` implements `VaultFolder`: sidecars = which of `vault.db-wal|-shm|-journal` exist; conflicted copies = folder entries whose name contains the phrase `conflicted copy` (so a **real** Dropbox `<name> (<user>'s conflicted copy <date>).<ext>` matches — the `(` is followed by the username, not the marker) or `.sync-conflict-` (Syncthing); staleBackups = leftover `*.pre-NNN.bak` migration backups (a lingering one means a failed upgrade). Cloud hint = the vault root's path containing (case-insensitively) `dropbox`/`onedrive`/`google drive`/iCloud's `mobile documents`, **or** a vendor marker file/dir (`.dropbox`, `.dropbox.cache`, `.stfolder`, `.stversions`) sitting in the root. OneDrive's conflict form is a bare `<name>-<hostname>.<ext>` rename with no reliable marker and is intentionally **not** matched (see [../docs/sync.md](../docs/sync.md)).
- `file-vault-mover.ts` (GUI advance, D-R(c)) — `FileVaultMover` implements `VaultMover` over `copyFileSync` + `mkdirSync` — deliberately never a rename (D-R(b)): a sync-app folder on another volume is the normal case, and a rename call fails across filesystems with `EXDEV`. Digests via `node:crypto` (SHA-256) for `matches()`.

Proof: `src/vault/domain/values/{key-hex,passphrase,device-id,generation,write-stamp,auto-lock-ttl}.test.ts`, `src/vault/domain/services/{vault-lineage,vault-relocation}.test.ts`, `src/vault/application/policies/session-guard.test.ts`, `src/vault/infra/{argon2,vault-header,recovery-kit,sqlite-lineage-store,file-device-identity,file-vault-folder,file-vault-mover}.test.ts` (real Argon2id), and one `*.use-case.test.ts` per use case under `src/vault/application/use-cases/`. `unlock-vault.upgrade-gate.test.ts` (GUI advance) covers the D-J(b) gate and `CheckVaultUpgrade` against a vault whose `meta.schema_version` marker is rolled back after a full migration (not a reconstructed legacy database — see the file's own comment for why that's sufficient). `relocate-vault.use-case.test.ts` (GUI advance) drives every refusal and every failure stage (copy/verify/source-removal, including the rollback rule) against a fake `VaultMover`, plus one real end-to-end move against the golden vault fixture (`FileVaultStore` + `FileVaultMover`, no fakes) proving the moved vault re-opens with the same passphrase, vault id, and lineage generation. Cross-cutting: `src/delivery/multi-device-sync.test.ts` (two-device fast-forward and fork simulation, idle-TTL, device-state location), `src/delivery/cli/vault-commands.test.ts` (the CLI's `unlockCommand` still migrates silently).
