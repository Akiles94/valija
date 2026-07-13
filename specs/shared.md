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
- WAL journal mode, foreign keys ON. `isWrongKeyError(e)` classifies the wrong-key failure.

## infra/migrations.ts + migrations/001-init.ts

- Ordered migrations applied in a transaction, gated by `meta.schema_version`. Idempotent.
- **Schema v1**: `projects`, `context_items` (type CHECK constraint), `context_items_fts` (FTS5 external-content) kept in sync by insert/update/delete triggers, `meta`.
- The schema is the shared *physical* kernel: it names context tables, but imports no context code — `shared` stays dependency-free.

## infra/vault-paths.ts

- `resolveVaultPaths(override?)` → `{ root, header, db }`. Root precedence: explicit override → `VALIJA_HOME` env → `~/.valija`.

Proof: `src/shared/infra/db.test.ts`.
