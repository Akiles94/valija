# Spec: shared — the kernel every module depends on

`src/shared/` depends on nothing internal. It is the floor of the dependency graph.

## domain/result.ts

- `Result<T, E>` — every fallible operation returns `{ ok: true, value }` or `{ ok: false, error }`. **No exceptions cross layer boundaries.**
- `DomainError` — carries a machine-readable `code: string` and a human message. Each context narrows the codes via its own constructor (`vaultErr`, `contextErr`).

## application/ports/clock.ts

- `Clock.now()` and `IdGenerator.next()` — the two ambient dependencies both contexts inject, so time and ids are deterministic in tests.

## infra/sqlite.ts

- `openVaultDb(path, keyHex)` opens the SQLCipher database with a raw 32-byte hex key (`PRAGMA key = "x'…'"`), never a passphrase. Malformed key hex is rejected before touching disk.
- Key is verified on open by touching `sqlite_master`; a wrong key throws `SQLITE_NOTADB`, and the file handle is **closed before rethrowing** (avoids a Windows file lock).
- **Rollback journal (`DELETE`), not WAL** (M3, D-A): on every open, `wal_checkpoint(TRUNCATE)` folds any pre-existing WAL (from a pre-0.3.0 vault) and then `journal_mode = DELETE` switches modes. This runs *after* the key is verified, so a wrong key never mutates the file. The point: at rest, between commands, `vault.db` is always the single, complete, self-consistent database — no `-wal`/`-shm` sidecar a BYO-cloud sync client could upload out of step with it. `PRAGMA synchronous` stays at its safe default (never `OFF`); a rollback journal exists to survive a crash mid-write, so at-rest integrity is kept, not weakened. Foreign keys ON. `isWrongKeyError(e)` classifies the wrong-key failure.

## infra/migrations.ts + migrations/001-init.ts, 002-imported-type.ts, 003-lineage.ts

- Ordered migrations applied in a transaction, gated by `meta.schema_version`. Idempotent. Backup-flagged migrations take a ciphertext backup of a populated vault first (checkpoint, then copy), removed only after the transaction commits.
- **Schema v1**: `projects`, `context_items` (type CHECK constraint), `context_items_fts` (FTS5 external-content) kept in sync by insert/update/delete triggers, `meta`.
- **Schema v2** (M2): widens the `context_items.type` CHECK to accept `imported` (table rebuild + FTS reindex).
- **Schema v3** (M3, D-G): static SQL seeding `meta.lineage_generation = '0'` (`INSERT OR IGNORE`, `backup: true`). Deliberately does NOT seed a device id or write stamp — those are written by the first real write, via `SqliteLineageStore.bump` (see [vault.md](vault.md)) — keeping this migration free of any runtime device identity. The journal fold/switch (D-A above) already happened when the db was opened, before migration 003 runs.
- The schema is the shared *physical* kernel: it names context tables, but imports no context code — `shared` stays dependency-free.

## infra/vault-paths.ts

- `resolveVaultPaths(override?)` → `{ root, header, db }`. Root precedence: explicit override → `VALIJA_HOME` env → `~/.valija`. This is the folder a user points at a synced cloud folder for BYO-cloud sync (M3) — no code change is needed to place a vault there.

## infra/state-paths.ts (M3)

- `resolveStatePaths(override?)` → `{ root, state }`. Root precedence: explicit override → `VALIJA_STATE_HOME` env → `~/.valija-state`. Deliberately **independent** of `vault-paths.ts` / `VALIJA_HOME`, so device-local state (device id, per-vault last-seen lineage, last-activity timestamp — see [vault.md](vault.md)) never lands inside a folder a sync client watches.

Proof: `src/shared/infra/sqlite.test.ts`, `src/shared/infra/migrations.test.ts`, `src/shared/infra/migrations/003-lineage.test.ts`, `src/shared/infra/upgrade-wal.test.ts` (a populated pre-M3 WAL vault upgrades without data/search loss).
