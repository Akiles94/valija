# Spec: vault — the encrypted vault bounded context

Security subdomain. Ubiquitous language: **vault, passphrase, key, salt, recovery kit, lock/unlock, keychain, lineage, generation, write stamp, device identity, fork, fast-forward, auto-lock**. Depends only on `shared`.

## domain/errors.ts

`VAULT_NOT_FOUND · VAULT_ALREADY_EXISTS · VAULT_LOCKED · WRONG_PASSPHRASE · WEAK_PASSPHRASE · KEYCHAIN_ERROR · STORAGE_ERROR · INVALID_DEVICE_ID · INVALID_GENERATION · INVALID_WRITE_STAMP · VAULT_FORK_DETECTED`

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

## application/ports (this module owns its technical ports)

- `crypto.ts` — `VaultCrypto`: Argon2id derivation to a 32-byte key + salt generation. Default KDF: 64 MiB, t=3, p=1.
- `keychain.ts` — `KeychainPort`: set/get/delete the session key by vault id.
- `vault-store.ts` — `VaultStore` + `VaultHeaderData`: header read/write/exists, DB init, key verification, db path, and (M3) `readLineage(keyHex)` — opens, verifies the key (`WRONG_PASSPHRASE` on mismatch), migrates, reads the lineage stamp, closes. `null` means the vault has never been written to yet.
- `lineage-store.ts` (M3) — `LineageStore`: `read()` (the stamp, or `null`) and `bump(writer)` (advance the generation, mint a fresh stamp, persist, return it). Deliberately narrow — no SQLite types — so the write path can bump it without importing the storage engine.
- `device-identity.ts` (M3) — `DeviceIdentity`: `deviceId()` (stable, lazily created), `lastSeen`/`recordSeen` (per-vault lineage), `lastActivityAt`/`recordActivity` (per-vault idle timer, D-I). All device-local, never synced.
- `vault-folder.ts` (M3) — `VaultFolder`: `inspect()` → `{ sidecars, conflictedCopies, looksLikeCloud }`, a filesystem-only read of the vault root (never opens the database).

## application/policies/session-guard.ts (M3, D-I)

`SessionGuard` — a small application policy, not a `UseCase` (it gates sessions, it is never invoked directly by the CLI/MCP). Lives in its own `policies/` subfolder rather than bare next to `ports/`/`use-cases/`, per the repo's "no bare files at a layer's root" convention. `guard(vaultId)`: TTL `null` → refresh activity, `ok`. Past the TTL → `keychain.deleteKey(vaultId)` and the exact `VAULT_LOCKED` result — a genuine lock, not just a refusal, and indistinguishable from any other locked-vault path. Within the TTL → refresh activity, `ok`. No daemon: consulted lazily by `SqliteVaultSessions.open()` (context/infra) on every session open, right after the keychain-key check.

## application use cases

**CreateVault(passphrase)** — header exists → `VAULT_ALREADY_EXISTS`; under 8 chars → `WEAK_PASSPHRASE` (enforced by the `Passphrase` value object, never trimmed); else generate ULID vault id + 16-byte salt, derive key, write header, create+migrate the DB, and **store the key in the keychain (a new vault starts unlocked)**. Returns `{ vaultId, keyHex, createdAt }` — the caller renders the recovery kit; the key is never persisted outside the keychain.

**UnlockVault({ passphrase | recoveryKeyHex })** — recovery key must be 64 hex chars (lowercased); passphrase path derives with the header's stored salt + params. `readLineage` both verifies the key (`WRONG_PASSPHRASE` on mismatch) and reads the stamp in one open — no separate `verifyKey` call. On success: sets the keychain key, resets the idle-activity timer (M3), and classifies the lineage against this device's last-seen record. A `null` lineage or `fast-forward`/`in-sync` unlocks silently and records last-seen. A **`fork`** still unlocks (for inspection) but leaves last-seen untouched and returns `{ vaultId, fork: { generation, writer, notice } }` — `notice` is a `VAULT_FORK_DETECTED` `DomainError` the CLI renders, without failing the unlock outright (so the user isn't stranded from the tool — `doctor` — that helps resolve it).

**LockVault()** — reads the current lineage (best-effort, before dropping the key: a stale key or an unwritten vault just omits `generation`/`writer`/`writerIsThisDevice`, it never blocks the lock), deletes the key, inspects the vault folder for stray sidecars. Returns `{ wasUnlocked, generation?, writer?, writerIsThisDevice?, sidecars }`. Missing header → `VAULT_NOT_FOUND`. This is the "safe to switch devices" signal (D-D): with journaling always `DELETE` (shared/infra), `sidecars` empty means the vault genuinely is a single file at rest, not just "probably fine."

**VaultStatus()** — no header → `{ initialized: false, unlocked: false }`; otherwise `unlocked` is true only if a keychain key exists **and** actually opens the DB (a stale key reports locked). Always reports `journalMode: "DELETE"`, `sidecars`, and `autoLock: { ttlMinutes, idleForMinutes?, expired? }` — purely informational; `VaultStatus` never itself drops the key, only `SessionGuard` does that, on an actual session open. When unlocked and the vault has been written to: `generation`, `lastWriter`, `lastWriterIsThisDevice`. Never touches context items, never feeds a context pack.

## infra

- `argon2.ts` — `Argon2VaultCrypto` (reference C impl): deterministic for same passphrase+salt+params; 32-byte keys, 16-byte salts.
- `vault-header.ts` — `vault.json` (plaintext): vaultId, schemaVersion 1, KDF params, base64 salt, createdAt. zod-validated on read; malformed → `STORAGE_ERROR`, missing → `VAULT_NOT_FOUND`. **Unchanged by M3** — no lineage/device/session field is ever added here (that would leak metadata in plaintext to a cloud vendor and reintroduce a second file the sync client must keep in step); lineage lives only inside the encrypted db.
- `recovery-kit.ts` — one-page text (raw key hex + vault id + instructions), shown once at init, **never stored by valija**.
- `keyring.ts` — `OsKeychain` via `@napi-rs/keyring`, service `valija`, account = vault id. Missing reads null; deleting a missing entry returns false; no throws.
- `file-vault-store.ts` — `FileVaultStore` implements `VaultStore` over the shared SQLite engine; takes an injected `IdGenerator`/`Clock` (M3) to build its `SqliteLineageStore` for `readLineage`.
- `sqlite-lineage-store.ts` (M3) — `SqliteLineageStore` implements `LineageStore` as four rows (`lineage_generation`, `lineage_stamp`, `lineage_writer`, `lineage_written_at`) in the shared `meta` table. `read()` returns `null` until all four exist (i.e. until the first real write bump — migration 003 seeds only the generation baseline, see [shared.md](shared.md)). `bump()` does not itself wrap a transaction — the write-time caller (context/infra) runs it inside its own.
- `file-device-identity.ts` (M3) — `FileDeviceIdentity` implements `DeviceIdentity` as JSON under `StatePaths` (shared/infra), outside `VALIJA_HOME` by construction. Lazily generates and persists the device id on first read; tolerates a missing/corrupt file by starting fresh — this is session bookkeeping, never a secret, so it never throws.
- `file-vault-folder.ts` (M3) — `FileVaultFolder` implements `VaultFolder`: sidecars = which of `vault.db-wal|-shm|-journal` exist; conflicted copies = folder entries matching common vendor patterns (`*(conflicted copy)*`, `*.sync-conflict-*`, `*(conflicted)*`); cloud hint = the vault root's path containing `Dropbox`/`OneDrive`/`Google Drive`/iCloud's `Mobile Documents`.

Proof: `src/vault/domain/values/{key-hex,passphrase,device-id,generation,write-stamp,auto-lock-ttl}.test.ts`, `src/vault/domain/services/vault-lineage.test.ts`, `src/vault/application/policies/session-guard.test.ts`, `src/vault/infra/{argon2,vault-header,recovery-kit,sqlite-lineage-store,file-device-identity}.test.ts` (real Argon2id), and one `*.use-case.test.ts` per use case under `src/vault/application/use-cases/`. Cross-cutting: `src/delivery/multi-device-sync.test.ts` (two-device fast-forward and fork simulation, idle-TTL, device-state location).
