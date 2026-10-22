Approved: Oscar 2026-10-21 — P-1 … P-17, P-19 … P-23 at their recommended defaults (a); P-18 = (b), dedicated "Update Valija" desktop screen

# SDK — Valija as an embeddable library (`valija/sdk`) · Implementation Plan

**Spec:** `advances/SDK/refined.md`. Oscar approved it at Gate R on 2026-10-21, and all 22 decisions
(D-A … D-V) are resolved there. This plan follows those resolutions and does not reopen them. The
ones that shape most of the plan:
- **D-A, option 3:** two unlock modes. Mode K reuses the OS-keychain session. Mode P keeps a
  passphrase- or recovery-key-derived key in process, through an in-memory `KeychainPort`.
- **D-D, option 2:** `createVault` exists. It uses the same format as `valija init` and leaves the
  new vault open in Mode P.
- **D-J, option 1:** only the five MCP operations plus `openVault` / `createVault` / `lock` /
  `close`. **D-K, option 2:** no pinning.
- **D-E / D-F / D-G:** a newer-schema guard on **every** surface (CLI, desktop, MCP, SDK). It is
  refused with `VAULT_SCHEMA_TOO_NEW` and is inert.

**Gate P outcome (Oscar, relayed by the orchestrator):**
- P-1 … P-17, P-19 and P-20 are resolved at option **(a)**.
- **P-18 is resolved at (b):** the desktop app gets a dedicated **"Update Valija" terminal screen**.
  It is reached from status (`schemaTooNew`) or from any call refused with `VAULT_SCHEMA_TOO_NEW`.
  It never offers to modify the vault: it explains, shows the vault's and the supported schema
  versions, and offers **Lock** and **Quit** only.
- That choice adds **Slice 5** (the desktop screen) and three new sub-decisions, **P-21 … P-23**,
  which still need Oscar's call (§6).

The four refiner calls marked ⚑ (D-A.1, D-A.2, D-A.3, D-D.1) are restated as **P-1 … P-4**.

**Branch:** `feat/sdk-SDK`, following `{feature}/{ADVANCE}`. The orchestrator reports that it already
exists and is stacked on `feat/secret-warning-SECRET-WARN`, which is stacked on
`feat/project-detect-PROJECT-DETECT`, which is stacked on `feat/curation-CURATION`. None of them is
merged. The working tree already holds every CURATION, PROJECT-DETECT and SECRET-WARN change. The
planner has not created or switched any branch. If a parent merges to `main` first, rebase onto
`main` before shipping.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** `.claude/hooks/guard-implementation.sh` enforces this mechanically for
> `src/**`, `desktop/**`, `package.json` and build config. The planner never writes that line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Every claim in `refined.md` §3 was re-checked against the working tree, and all of them hold:
- `buildContainer({ vaultRoot? })` resolution, and the env reads at build time
- `OsKeychain` always wired
- the session open order (header → key → guard → open → `migrate`)
- `UnlockVault`'s `< LATEST` gate
- `migrate` skipping unknown versions
- `openVaultDb`'s journal pragmas, which `readSchemaVersion` also runs
- `CreateVault`'s outputs and `renderRecoveryKit`
- the five use cases behind MCP
- `valija@0.3.0` with no `exports`
- TypeScript `^7.0.2`
- schema v4

The facts below are **not in the spec**. Each one changes how a slice is written.

- **F1. TypeScript 7 has no classic JS compiler API, so tsup's `dts` cannot work as installed.**
  - `node_modules/typescript/package.json` (7.0.2) maps `"."` to `./lib/version.cjs`, which exports
    only `{ version, versionMajorMinor }`. The compiler API sits under `typescript/unstable/*`.
  - `node_modules/tsup/dist/rollup.js` (8.5.1, its `dts` path) does `require('typescript')` and
    calls `ts.parseJsonConfigFileContent`, `ts.sys` and `ts.ScriptTarget`. All three are
    `undefined` here.
  - This was verified by **reading** the installed packages, not by running a build. Slice 0 runs
    it to confirm. The plan's primary route is therefore the spec's fallback: `tsc
    --emitDeclarationOnly` (P-5).
- **F2. tsup already externalizes every `dependencies` entry.** So `commander` and
  `@modelcontextprotocol/sdk` stay bare imports inside `program.js`. A second entry that never
  imports `delivery/cli` or `delivery/mcp` will not pull them in. The module-graph test (Slice 9)
  proves this from source; the pack smoke test (Slice 10) proves it from `dist/`.
- **F3. The current session-open order records activity before the database is opened**
  (`SqliteVaultSessions.open`: header → `requireKey` → `guard.guard` → `openRepositories`).
  `SessionGuard.guard` writes `recordActivity` when it passes, and calls `keychain.deleteKey` when
  the session has expired. A schema refusal placed after the guard would therefore break §6. Slice 3
  moves the database open, and its refusal, **before** the guard (P-7).
- **F4. `openVaultDb` runs `wal_checkpoint(TRUNCATE)` and `journal_mode = DELETE` straight after
  key verification**, for every caller. The only place a refusal can avoid those pragmas on a
  read-write path is **between** the verifying `SELECT` and the pragmas (Slice 1, P-7).
- **F5. `migrate` writes before it reads.** It runs `CREATE TABLE IF NOT EXISTS meta` and only
  then reads the version. The backstop (D-E) must read and refuse **first**.
- **F6. `schemaVersion(db)` throws `no such table: meta` on a database that was never migrated.**
  The pre-pragma refusal runs before any migration, including on `initializeDb`'s new file. So
  `schemaVersion` becomes table-aware and returns `0` when `meta` is absent.
- **F7. A busy vault throws raw, not `STORAGE_ERROR`.** `SqliteVaultSessions.commitWrite` rethrows
  any non-sentinel error, so a write still contended after 5 s surfaces `SqliteError: database is
  locked`: a stack trace on the CLI and an uncaught rejection in MCP. D-S needs `STORAGE_ERROR`
  "vault busy" (P-8).
- **F8. `LockVault` already tolerates a failing `readLineage`.** Once `readLineage` returns
  `VAULT_SCHEMA_TOO_NEW` (Slice 2), D-G's "lock still drops the key; lineage is omitted" holds with
  **zero** code change. A test pins it, and the desktop screen's **Lock** button relies on it.
- **F9. `VaultStatus` treats any `readLineage` failure as `unlocked: false`.** Slice 2 adds an
  explicit too-new branch with a compatibility field (P-19).
- **F10. `container.ts` imports `OsKeychain` statically**, and `keyring.ts` imports
  `@napi-rs/keyring` at module top. §11.1 is about *calls and construction*, which a recording fake
  can assert (P-15).
- **F11. `Container` exposes neither the TTL nor the device identity.** Slice 6 adds
  `autoLockMinutes` and `deviceIdentity`. One typed literal breaks:
  `src/delivery/mcp/server.test.ts:45`. Slice 6 fixes it.
- **F12. `diagnostics.test.ts` already `vi.mock`s `../vault/infra/keyring.js`**, so tests never
  touch the real keychain. Every SDK test does the same. The §11.1 test uses a **recording** variant.
- **F13. `KEYCHAIN_ERROR` is never produced today.** It stays in the public `ValijaErrorCode`
  union, as §7 lists it (A6).
- **F14. `SaveContextInput` has `pinned?`.** D-K is upheld only if the SDK **never** forwards it.
  The handle maps fields one by one, and a test proves that a stray `pinned` is dropped.
- **F15. `GetContextPack` accepts any budget, including `Infinity`.** `SearchContext` clamps
  `limit` but would pass `2.5` to SQL. MCP is protected by zod. The SDK validates the same shapes
  (P-10).
- **F16. `better-sqlite3` is synchronous.** D-P's `Promise` API does not make SDK calls
  non-blocking: a call can block for up to 5 s on a busy vault. Only Argon2 is truly asynchronous.
  `docs/sdk.md` must say so (R5).
- **F17. The desktop error-copy test reads `src/` directly** (`error-copy.test.ts` regex-scans
  `src/vault/domain/errors.ts`). So `VAULT_SCHEMA_TOO_NEW`'s `en`/`es` copy lands in **Slice 1**.
- **F18. The desktop routes session states from one place.**
  - `app.tsx`'s `Router` switches on `SessionState.phase` (`session-state.ts`).
  - Pre-unlock screens (No vault, Create, Locked, Migration confirm) render inside `EntryShell`.
  - `withLockDetection` (`lock-aware-bridge.ts`) wraps **every** bridge call and routes
    `VAULT_LOCKED` to the locked phase. No screen knows about it.
  - The new terminal phase follows the same pattern: a `schema-too-new` phase, an `EntryShell`
    case in `Router`, and detection in the same bridge wrapper (Slice 5).
- **F19. IPC errors carry only the code.** `toIpcResult` (`desktop/src/main/ipc/to-ipc-result.ts`)
  returns `{ ok: false, error: { code } }`. On the most common path — a locked vault that the user
  tries to unlock — the screen could therefore not show the two schema numbers. A refused unlock
  sets no key, so status cannot report them either. Slice 5 adds an optional, numbers-only
  `schema` field to that error, filled from a typed domain error (P-21).
- **F20. There is no "quit" IPC channel, and main registers no `window-all-closed` handler.** By
  Electron's default, closing the last window quits the app. The screen's **Quit** button calls
  `window.close()`, so **no new IPC channel** is needed (spec §1 "no new IPC channel", P-22, A15).
- **F21. Settings already hides vault actions unless unlocked.** `settings.tsx` shows Diagnostics
  and Move vault only when `unlocked` is true, and the `Router` passes
  `unlocked={state.phase === "unlocked"}`. So the terminal screen can keep the settings gear for
  language and theme, without exposing any vault action (P-23).
- **F22. Use-case classes have no `UseCase` suffix.** This advance adds **no** use case.
- **F23. The application layer already imports `LATEST_SCHEMA_VERSION` from `shared/infra`.** This
  is an existing exception. The new comparison helper lives in `shared/domain/services/`.
- **F24. `vault.json`'s `schemaVersion: 1` is the header format version**, not the database schema.

**Spec wrinkles (none blocking):**

- **W1. D-F's "a hot journal must still produce a clear error".** A truly read-only probe cannot
  roll back a hot journal. Read literally, every surface would be unopenable after a crash. The
  probe stays read-only. When it hits a hot journal, it falls back to the normal read-write open,
  whose pre-pragma refusal still guards a newer schema (P-6, verified in Slice 0).
- **W2. §7's "existing codes plus the new one" vs. §5's "validation error".** The plan adds one
  SDK-only code, `INVALID_INPUT` (P-9).
- **W3. §2.1 writes `const vault = p.value`.** So `openVault` returns the handle itself, while
  `createVault` returns `{ vault, vaultId, recoveryKit }` (P-11).

---

## 1. Summary

The plan has twelve slices (0–11):

0. **Spike.** Confirm F1, prove the `tsc --emitDeclarationOnly` fallback, and record the hot-journal
   error code (W1). Writes only `advances/SDK/spike.md`.
1. **Shared guard foundation.** `compareSchema`, the backstops, the read-only probe,
   `VAULT_SCHEMA_TOO_NEW` with a typed `VaultSchemaTooNewError`, and the desktop error copy (F17).
2. **Vault use cases and store.** Refusals in `UnlockVault`, `CheckVaultUpgrade` and `VaultStatus`
   (`schemaTooNew` field). `LockVault` pinned (F8).
3. **Sessions.** Refuse before the idle guard, the no-auto-migrate mode, and the busy mapping.
4. **Guard on CLI and MCP.** The `status` line, the `doctor` row, and tests on every command and
   tool.
5. **Desktop "Update Valija" terminal screen (P-18 (b)).** IPC `schema` numbers, the
   `schema-too-new` phase, bridge-wrapper routing, the screen, `en`/`es` copy, token-only styles,
   DOM tests, and `docs/gui.md`.
6. **In-process adapters and container options.**
7. **SDK contracts:** public DTOs, the closed code list, error mapping, and zod schemas.
8. **SDK facade:** `openVault`, `createVault`, the five operations, `lock`/`close`, the idle timer,
   `docs/sdk.md` and the CLAUDE.md line.
9. **Integration:** round-trips, the concurrency suite, guard inertness, and import inertness.
10. **Packaging:** the second entry, declarations, `exports`, the smoke script, and the remaining
    docs.
11. **Final gate.**

**Production lines: about 1,000 in total** (≈ 810 in `src/`, ≈ 165 in `desktop/src/`, ≈ 25 in build
config). There is also a ≈ 90-line smoke script. Tests add about 1,750 lines, test support about
120, and docs about 450. There are zero migrations, zero new dependencies, zero new MCP tools or
arguments, zero new CLI commands, and zero new IPC channels.

---

## 2. Ordered slices

**Every slice ends green on both workspaces** (exact commands in §4.4):
`npm run typecheck && npm run lint && npm run test` at the repo root, **and**
`cd desktop && npm run typecheck && npm run lint && npm run test`.

**Every SDK and container test mocks `../vault/infra/keyring.js`** (F12).

Each slice lists the docs that ship in the same commit.

---

### Slice 0 — Spike: packaging toolchain and the hot-journal probe (no production code kept)

**Rationale.** Spec §15 names the TS 7 / tsup `.d.ts` toolchain as a risk. This slice runs what F1
inferred, before any SDK code depends on it. It also answers W1 empirically, because Slice 1's probe
design depends on the answer.

**Steps** (on a throwaway working copy; only `spike.md` is committed):

1. **tsup `dts`.** Add a scratch `src/delivery/sdk/index.ts` (`export const probe = 1; export
   interface Probe { a: string }`). Set `entry: { program, sdk }` plus
   `dts: { entry: { sdk: … } }`, then run `npm run build`. **Expected:** it fails, because
   `ts.parseJsonConfigFileContent` is undefined. Record the exact error.
2. **The fallback.** Write a scratch `tsconfig.sdk.json`:
   - `extends: "./tsconfig.json"`
   - `compilerOptions`: `noEmit: false`, `declaration`, `emitDeclarationOnly`, `rootDir: "src"`,
     `outDir: "dist/types"`
   - `files: ["src/delivery/sdk/index.ts"]`, `include: []`

   Run `npx tsc -p tsconfig.sdk.json`. Confirm that `dist/types/delivery/sdk/index.d.ts` exists and
   keeps its `.js` specifiers.
3. **Consumer resolution.** In a scratch dir outside the repo:
   - `"type": "module"`, and `nodenext` + `strict` + `skipLibCheck: false`
   - `node_modules/valija` symlinked to the repo, with a scratch `exports` map
   - `import { type Probe, probe } from "valija/sdk"`

   Run `<repo>/node_modules/.bin/tsc --noEmit`, then `node -e "import('valija/sdk')"`. Both must
   pass.
4. **Read-only open with a hot journal (W1).**
   - Open with `openVaultDb`, set `PRAGMA cache_size = 1`, then `BEGIN` and insert a few hundred
     4 KB rows.
   - Copy `vault.db` and `vault.db-journal` while the transaction is open, then close the original.
   - Open the copy `{ readonly: true, fileMustExist: true }` with the `cipher`/`key` pragmas, run
     `SELECT count(*) FROM sqlite_master`, and record `error.code` (expected
     `SQLITE_READONLY_ROLLBACK`).
   - Re-open the copy with `openVaultDb`. The journal must be rolled back and the rows absent.
   - Record the recipe.

**Deliverable:** `advances/SDK/spike.md` holds the exact errors, the `tsc` version, the hot-journal
code and the recipe.

**Decision point:**
- If step 1 unexpectedly succeeds, the implementer reports it before Slice 10 (P-5 (b)).
- If step 4 gives a different code, Slice 1 uses the recorded one.
- If no hot journal can be produced, Slice 1 injects the error instead (A9).

**Done when:** `spike.md` answers all four steps, and `git status` shows only `spike.md`.

---

### Slice 1 — Shared guard foundation (+ desktop error copy)

**Rationale.** D-E wants one comparison helper and a fail-closed backstop. D-F wants a read-only
probe. A refusal inside `openVaultDb`, between key verification and the journal pragmas, makes
**every** read-write open fail closed without running a pragma or a migration (F4).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/shared/domain/services/schema-compatibility.ts` | new: `SchemaCompatibility`, `compareSchema` | ~15 |
| `src/shared/infra/migrations.ts` | + `SchemaTooNewError`, `refuseNewerSchema`; backstop first in `migrate`; table-aware `schemaVersion` | +25 |
| `src/shared/infra/sqlite.ts` | `openVaultDb` = `applyKey` → `refuseNewerSchema` → `settleJournal`; + `probeSchemaVersion`, `isBusyError` | +40 |
| `src/vault/domain/errors.ts` | + `"VAULT_SCHEMA_TOO_NEW"`, `schemaTooNewMessage`, `VaultSchemaTooNewError`, `schemaTooNewErr` | +16 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + `errors.VAULT_SCHEMA_TOO_NEW` each | +2 |
| `src/shared/domain/services/schema-compatibility.test.ts` | new | ~25 (test) |
| `src/shared/infra/migrations.test.ts` | + backstop cases | +40 (test) |
| `src/shared/infra/sqlite.test.ts` | + pre-pragma refusal, probe, hot journal | +90 (test) |
| `src/vault/domain/errors.test.ts` | new: the typed error carries code, numbers and message | ~20 (test) |
| `src/testing/schema-skew.ts` | new test support: `setStoredSchemaVersion`, `snapshotVaultFiles` | ~40 (test support) |

**1.1 `shared/domain/services/schema-compatibility.ts`**

```ts
/** How a vault's schema relates to the one this build understands — the one comparison every guard reads (D-E). */
export type SchemaCompatibility = "behind" | "current" | "newer";

export function compareSchema(vaultVersion: number, supportedVersion: number): SchemaCompatibility {
  if (vaultVersion > supportedVersion) return "newer";
  return vaultVersion < supportedVersion ? "behind" : "current";
}
```

**1.2 `migrations.ts`**

```ts
/** A vault written by a newer valija. Thrown before any write, pragma or migration (D-E, D-F). */
export class SchemaTooNewError extends Error {
  constructor(readonly vaultVersion: number, readonly supportedVersion: number) {
    super(`Vault schema ${vaultVersion} is newer than the supported ${supportedVersion}.`);
    this.name = "SchemaTooNewError";
  }
}

/** Fail closed: refuse a schema this build does not know. Reads only. */
export function refuseNewerSchema(db: Database): void {
  const current = schemaVersion(db);
  if (compareSchema(current, LATEST_SCHEMA_VERSION) === "newer") {
    throw new SchemaTooNewError(current, LATEST_SCHEMA_VERSION);
  }
}
```

- `migrate` starts with `refuseNewerSchema(db)`. Only then does it run `CREATE TABLE IF NOT EXISTS
  meta` and the existing loop (F5).
- `schemaVersion(db)` returns `0` when `sqlite_master` has no `meta` table (F6).

**1.3 `sqlite.ts`.** `openVaultDb` keeps its signature and its behaviour for current and behind
vaults:

```ts
export function openVaultDb(dbPath: string, keyHex: string): Database {
  assertKeyHex(keyHex);
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new SqliteDatabase(dbPath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
  try {
    applyKey(db, keyHex);      // cipher + key + the verifying SELECT (SQLITE_NOTADB on a wrong key)
    refuseNewerSchema(db);     // D-F: before the journal pragmas below — a newer vault is never settled
    settleJournal(db);         // wal_checkpoint(TRUNCATE), journal_mode = DELETE, foreign_keys = ON
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * D-F: the read-only schema probe. No mkdir, no journal pragma, no write. On a hot journal a read-only
 * connection cannot recover, so the probe falls back to the read-write open — SQLite rolls the
 * journal back, and the refusal above still guards a newer schema (W1, P-6).
 */
export function probeSchemaVersion(dbPath: string, keyHex: string): number

export const isBusyError = (error: unknown): boolean => sqliteCode(error) === "SQLITE_BUSY";
```

- `probeSchemaVersion` opens `{ readonly: true, fileMustExist: true, timeout }`, then runs
  `applyKey` and `schemaVersion`, and closes in `finally`.
- On the Slice 0 hot-journal code, it calls `openVaultDb` instead. It catches `SchemaTooNewError`
  and returns `error.vaultVersion`: the probe reports the number and never refuses.
- `isWrongKeyError` is rewritten on top of the shared `sqliteCode` helper.

**1.4 `vault/domain/errors.ts`**

```ts
| "VAULT_SCHEMA_TOO_NEW"

/** One wording for CLI, MCP, desktop logs and the SDK (§6): both numbers, and what to do. */
export const schemaTooNewMessage = (vaultVersion: number, supportedVersion: number): string =>
  `This vault was upgraded by a newer version of valija (schema ${vaultVersion}); this version ` +
  `supports up to schema ${supportedVersion}. Update valija to open it — if you are an AI tool, ask the user to update valija.`;

/** VAULT_SCHEMA_TOO_NEW that also carries both numbers, so a surface can show them without parsing the message (P-21). */
export class VaultSchemaTooNewError extends DomainError {
  constructor(readonly vaultVersion: number, readonly supportedVersion: number) {
    super("VAULT_SCHEMA_TOO_NEW", schemaTooNewMessage(vaultVersion, supportedVersion));
  }
}

/** The only way any layer builds this refusal (Slice 11 grep). */
export const schemaTooNewErr = (vaultVersion: number, supportedVersion: number): Result<never, DomainError> =>
  err(new VaultSchemaTooNewError(vaultVersion, supportedVersion));
```

The model-directed clause follows `LOCKED_MESSAGE` ("Ask the user to run…"), so MCP needs **no**
code change.

**1.5 Desktop copy (F17).** `errors.VAULT_SCHEMA_TOO_NEW`, the spec's text verbatim (§7). Slice 5
keeps it as the fallback and the Diagnostics-row copy.

| en | es |
|---|---|
| This vault was upgraded by a newer version of Valija. Update this app to open it. | Esta bóveda fue actualizada con una versión más reciente de Valija. Actualiza esta aplicación para abrirla. |

**1.6 `src/testing/schema-skew.ts`**

```ts
/** Patch only the `meta.schema_version` marker, through a raw connection (openVaultDb would refuse past LATEST). */
export function setStoredSchemaVersion(dbPath: string, keyHex: string, version: number): void
/** sha256 of vault.json and vault.db plus the sorted folder listing — "the vault is untouched" in one equality. */
export function snapshotVaultFiles(paths: VaultPaths): { header: string; db: string; entries: string[] }
```

**1.7 Tests**

- `schema-compatibility.test.ts`: `(3,4)` is behind, `(4,4)` is current, `(5,4)` is newer.
- `migrations.test.ts`:
  1. `LATEST + 1` → `migrate` throws `SchemaTooNewError` with both numbers;
  2. the snapshot is unchanged and there is no `.pre-*.bak`;
  3. a brand-new database (no `meta`) → `schemaVersion` is `0` and `migrate` reaches `LATEST`;
  4. the existing cases are unmodified.
- `sqlite.test.ts`:
  1. `openVaultDb` on `LATEST + 1` throws, and the bytes are unchanged;
  2. a raw `PRAGMA journal_mode` read shows `settleJournal` never ran;
  3. `probeSchemaVersion` returns `LATEST + 1` and `LATEST` without changing any bytes, and throws
     `SQLITE_NOTADB` on a wrong key;
  4. **hot journal** (the Slice 0 recipe): the probe returns the version, the journal is gone, and
     the uncommitted rows are absent;
  5. `isBusyError`.
- `errors.test.ts`: `new VaultSchemaTooNewError(5, 4)` is a `DomainError` with code
  `VAULT_SCHEMA_TOO_NEW`, `vaultVersion` 5, `supportedVersion` 4, and a message containing both
  numbers.

**Docs in this commit:**
- `specs/shared.md`: `schema-compatibility.ts`, the `openVaultDb` refusal, `probeSchemaVersion`,
  and the `migrate` backstop.
- `specs/vault.md` §errors: `VAULT_SCHEMA_TOO_NEW`, `VaultSchemaTooNewError`, `schemaTooNewErr`.

**Done when:** both loops are green, `error-copy.test.ts` and `catalogs.test.ts` pass, and every
existing migration and upgrade test is unmodified.

---

### Slice 2 — Vault store and use cases: refuse, report, keep locking

**Rationale.** These are the explicit refusals D-E asks for, on the paths that need the schema
**number**. Everything else rides on the Slice 1 throw.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/infra/file-vault-store.ts` | `readSchemaVersion` → `probeSchemaVersion`; one private `toStoreError` | +12 / −15 |
| `src/vault/application/ports/vault-store.ts` | doc: `readSchemaVersion` is read-only (D-F) | +2 |
| `src/vault/application/use-cases/unlock-vault.use-case.ts` | `compareSchema` → `schemaTooNewErr` before `readLineage` | +6 |
| `src/vault/application/use-cases/check-vault-upgrade.use-case.ts` | same refusal | +6 |
| `src/vault/application/use-cases/vault-status.use-case.ts` | `schemaTooNew?` field and branch | +20 |
| `src/vault/application/use-cases/unlock-vault.schema-guard.test.ts` | new | ~110 (test) |
| `src/vault/application/use-cases/vault-status.use-case.test.ts` | + newer-vault case | +35 (test) |
| `src/vault/application/use-cases/lock-vault.use-case.test.ts` | + newer-vault case (F8) | +25 (test) |
| `src/vault/infra/file-vault-store.test.ts` | new: error mapping | ~50 (test) |

**2.1 `FileVaultStore`**

```ts
readSchemaVersion(keyHex: string): Result<number, DomainError> {
  try {
    return ok(probeSchemaVersion(this.paths.db, keyHex));
  } catch (error) {
    return this.toStoreError(error);
  }
}

/** One mapping for every open: wrong key, newer schema, or anything else. */
private toStoreError(error: unknown): Result<never, DomainError> {
  if (isWrongKeyError(error)) return vaultErr("WRONG_PASSPHRASE", WRONG_KEY_MESSAGE);
  if (error instanceof SchemaTooNewError) return schemaTooNewErr(error.vaultVersion, error.supportedVersion);
  return vaultErr("STORAGE_ERROR", `Could not open vault db: ${(error as Error).message}`);
}
```

`verifyKey`, `readLineage` and `initializeDb` reuse it. The existing messages are unchanged,
including `initializeDb`'s "Could not create vault db".

**2.2 `UnlockVault`.** This replaces the `<` check, before `readLineage`:

```ts
const schema = this.store.readSchemaVersion(keyHex.value);
if (!schema.ok) return schema;
const compatibility = compareSchema(schema.value, LATEST_SCHEMA_VERSION);
if (compatibility === "newer") return schemaTooNewErr(schema.value, LATEST_SCHEMA_VERSION);
if (compatibility === "behind" && input.upgradeConfirmed !== true) {
  return vaultErr("VAULT_UPGRADE_REQUIRED", /* existing message, unchanged */);
}
```

The refusal therefore happens before `readLineage`, `setKey`, `recordActivity` and `recordSeen`.

**2.3 `CheckVaultUpgrade`.** The same `newer` refusal goes right after `readSchemaVersion`.

**2.4 `VaultStatus` (D-G, F9)**

```ts
/** Present only when the vault's schema is newer than this build — reported, not fatal (D-G). */
schemaTooNew?: { vaultVersion: number; supportedVersion: number };
```

- If `readLineage` returns `VAULT_SCHEMA_TOO_NEW`, `tooNewStatus` reads the numbers from the
  `VaultSchemaTooNewError` itself (no second open). It returns `unlocked: true` and `schemaTooNew`.
- Any other `readLineage` failure keeps today's `unlocked: false`.

**2.5 Tests** (real SQLCipher, low KDF parameters, marker at `LATEST + 1`):

- `unlock-vault.schema-guard.test.ts`:
  1. passphrase and recovery-key unlock → `VAULT_SCHEMA_TOO_NEW`; the error is an
     `instanceof VaultSchemaTooNewError` with both numbers;
  2. **inert:** the snapshot is equal, there is no key, no activity and no last-seen, and no
     `.pre-*.bak`;
  3. a wrong passphrase → `WRONG_PASSPHRASE`;
  4. `upgradeConfirmed: true` does not bypass it;
  5. `CheckVaultUpgrade` → `VAULT_SCHEMA_TOO_NEW`, with the files unchanged.
- `vault-status.use-case.test.ts`: the key is present and the vault is newer → `unlocked: true`,
  `schemaTooNew: { vaultVersion: LATEST + 1, supportedVersion: LATEST }`, and no `generation`. A
  current vault has no `schemaTooNew` key.
- `lock-vault.use-case.test.ts`: newer vault → `wasUnlocked: true`, the key is gone, there are no
  lineage fields, and the files are unchanged.
- `file-vault-store.test.ts`:
  - `readLineage` on a newer vault → `VAULT_SCHEMA_TOO_NEW`
  - `readSchemaVersion` → `ok(LATEST + 1)`
  - a wrong key → `WRONG_PASSPHRASE` on all three methods

**Docs in this commit:** `specs/vault.md`: the ports, the use-case refusals, `schemaTooNew`, and
`LockVault` on a newer vault.

**Done when:** both loops are green. `unlock-vault.upgrade-gate.test.ts` passes unmodified. The
desktop compiles unchanged: `(v): VaultStatusResponse => v` accepts the extra optional field.

---

### Slice 3 — Sessions: refuse before the guard, no-auto-migrate mode, busy mapping

**Rationale.** Every content operation on every surface opens through `SqliteVaultSessions`.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/infra/vault-sessions.ts` | reordered `open`; `autoMigrate` option; too-new and busy mapping | +40 / −12 |
| `src/context/infra/vault-sessions.test.ts` | + guard, order, mode and busy cases | +130 (test) |

**3.1 Constructor.** A 7th, optional parameter keeps every existing call compiling:

```ts
/** `autoMigrate: false` (SDK without allowUpgrade, D-H): a behind vault is refused, never migrated. */
private readonly options: { autoMigrate: boolean } = { autoMigrate: true },
```

**3.2 `open()`.** The refusals come **before** the idle guard (F3, P-7):

```ts
private open(): Result<VaultSession, DomainError> {
  const header = readVaultHeader(this.paths.header);
  if (!header.ok) return header;
  const vaultId = header.value.vaultId;

  const keyHex = this.requireKey(vaultId);
  if (!keyHex.ok) return keyHex;

  const db = this.openDb(vaultId, keyHex.value);      // newer schema refused here — key kept, nothing written
  if (!db.ok) return db;

  const ready = this.prepare(db.value, vaultId);      // upgrade gate → idle guard → migrate
  if (!ready.ok) {
    db.value.close();
    return ready;
  }
  return ok(this.sessionOver(db.value, vaultId));
}
```

- **`openDb`** maps what `openVaultDb` throws:
  - a wrong key → `deleteKey` + `VAULT_LOCKED` (unchanged)
  - `SchemaTooNewError` → `schemaTooNewErr(…)`, with the keychain **untouched**
  - `isBusyError` → `STORAGE_ERROR` with `BUSY_MESSAGE`
  - anything else → today's `STORAGE_ERROR`
- **`prepare`:**
  1. `!autoMigrate && compareSchema(schemaVersion(db), LATEST) === "behind"` →
     `VAULT_UPGRADE_REQUIRED` ("… Open it with allowUpgrade to upgrade it.")
  2. `guard.guard(vaultId)`
  3. `migrate(db, this.paths.db)`
- **`sessionOver`:** today's repository and `write` construction.

**3.3 Busy writes (P-8).** In `commitWrite`'s catch, before `throw error`:

```ts
if (isBusyError(error)) return vaultErr("STORAGE_ERROR", BUSY_MESSAGE);
```

`BUSY_MESSAGE` is: "The vault is busy: another valija process held it for more than 5 s. Nothing
was saved. Try again." The transaction has already rolled back, including the lineage bump.

**3.4 Tests**

1. **newer schema** → `VAULT_SCHEMA_TOO_NEW`; the snapshot is unchanged, the key is **still
   present**, and activity is unchanged;
2. **newer schema with the TTL expired** → still `VAULT_SCHEMA_TOO_NEW`, and the key is still
   present (P-7's price);
3. **current schema with the TTL expired** → `VAULT_LOCKED`, and the key is deleted (unchanged);
4. **`autoMigrate: false` on a behind vault** → `VAULT_UPGRADE_REQUIRED`; the marker is unchanged,
   no activity is recorded, and no `.pre-*.bak` is left;
5. **default on a behind vault** → it migrates (D-I);
6. **stale key** → `VAULT_LOCKED` (unchanged);
7. **busy:** a `Worker` (`node:worker_threads`) holds `BEGIN IMMEDIATE` for 6.5 s → a `write`
   returns `STORAGE_ERROR` "busy"; the count and generation are unchanged; there is no sidecar;
8. the existing cases are unmodified.

**Docs in this commit:** `specs/context.md` §infra `vault-sessions.ts`.

**Done when:** both loops are green, and the full root and desktop suites pass with no other test
modified.

---

### Slice 4 — The guard on CLI and MCP (reporting and tests)

**Rationale.** Slices 1–3 made the refusal true. This slice makes it visible on the CLI and MCP, and
pins every CLI and MCP path that §13 lists. The desktop gets its own slice (Slice 5).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/diagnostics.ts` | `checkVault` / `checkLineage` read `schemaTooNew` (D-G) | +15 |
| `src/delivery/cli/vault-commands.ts` | `statusCommand`: a `schema:` line when `schemaTooNew` | +5 |
| `src/delivery/cli/schema-guard.test.ts` | new | ~140 (test) |
| `src/delivery/mcp/server.schema-guard.test.ts` | new | ~70 (test) |
| `src/delivery/diagnostics.test.ts` | + newer-vault rows | +30 (test) |

**4.1 `diagnostics.ts`**
- When `schemaTooNew` is set, the vault row is `{ name: "vault", ok: false, errorCode:
  "VAULT_SCHEMA_TOO_NEW", detail: "schema v5 is newer than this valija (supports v4) — update
  valija" }`. It has **no** `fatal`.
- The lineage row's detail becomes "not read — the vault's schema is newer than this valija".

**4.2 `statusCommand`.** One `schema:` line is printed, only when the vault is too new (P-19).

**4.3 Tests**

- `cli/schema-guard.test.ts` (the `curation-commands.test.ts` harness). One `it.each` row per
  command: `unlock`, `unlock --recovery-key`, `show`, `search`, `projects`, `export`, `edit`,
  `archive`, `unarchive`, `pin`, `unpin`, `import`, `link`, `which`. Each row checks:
  - stderr is `error [VAULT_SCHEMA_TOO_NEW]: …` and the exit code is 1
  - the snapshot is unchanged

  Plus:
  - `lock` drops the key;
  - `status` prints the `schema:` line;
  - `doctor` shows the failing row and exits 0.
- `server.schema-guard.test.ts`: all 5 tools → `isError`, "update valija" and
  `[VAULT_SCHEMA_TOO_NEW]`, with the snapshot unchanged. `server.test.ts` is unmodified, apart from
  the F11 fix in Slice 6.
- `diagnostics.test.ts`: the vault row is `ok: false`, has the `errorCode` and is not fatal; the
  lineage row has the new detail; `EXPECTED_NAMES` is unchanged.

**Docs in this commit:**
- `docs/vault-format.md` §11: **writers** obey the same newer-schema refusal. No format change; the
  fixture is unchanged.
- `specs/delivery.md`: the diagnostics rows and the status line.
- `docs/SPEC.md` §8: one clause.
- `CHANGELOG.md` `Fixed`: an older valija no longer opens a vault upgraded by a newer one.

**Done when:** both loops are green. `git diff -- src/delivery/mcp/server.ts` is empty.

---

### Slice 5 — Desktop: the "Update Valija" terminal screen (P-18 (b))

**Rationale.** An outdated desktop must stop cleanly on a newer vault:
- one screen that explains what happened and shows both schema numbers
- **no** action that could change the vault
- **Lock** and **Quit** only

It follows the existing routing pattern exactly (F18):
- a session phase in `session-state.ts`
- an `EntryShell` case in `app.tsx`'s `Router`
- detection in the one bridge wrapper every call already passes through

No new IPC channel (F20).

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/shared/ipc/messages.ts` | + `SchemaVersionsMessage`; `IpcResult` error gains `schema?`; `VaultStatusResponse.schemaTooNew?` | +8 |
| `desktop/src/main/ipc/to-ipc-result.ts` | attach `schema` for a `VaultSchemaTooNewError` only (P-21) | +5 |
| `desktop/src/renderer/state/session-state.ts` | phase `schema-too-new` (with versions), `afterSchemaTooNew`, `afterStatusCheck` branch | +14 |
| `desktop/src/renderer/state/lock-aware-bridge.ts` | + `onSchemaTooNew` routing | +14 |
| `desktop/src/renderer/screens/schema-too-new.tsx` | new: `SchemaTooNewScreen` | ~65 |
| `desktop/src/renderer/app.tsx` | `Router` case; wrapper callback; `onQuit` | +16 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + `schemaTooNew.*` (10 keys each) | +26 |
| `desktop/src/renderer/styles/screens.css` | + `.screen.schema-too-new`, `.schema-versions` (tokens only) | +16 |
| `desktop/src/main/ipc/to-ipc-result.test.ts` | new | ~40 (test) |
| `desktop/src/renderer/state/session-state.test.ts` | + phase cases | +25 (test) |
| `desktop/src/renderer/state/lock-aware-bridge.test.ts` | + routing cases | +40 (test) |
| `desktop/src/renderer/state/unlock-outcome.test.ts` | + `VAULT_SCHEMA_TOO_NEW` stays `error`, never `upgrade-required` | +8 (test) |
| `desktop/src/renderer/screens/__dom-tests__/schema-too-new.dom.test.tsx` | new: copy, numbers, actions, themes | ~130 (test) |
| `desktop/src/renderer/app.shell.test.ts` | + structural: the `Router` renders the screen in `EntryShell` | +10 (test) |
| `desktop/src/renderer/app.theme.test.ts` | + the screen sets no `data-theme` and never imports `theme-context` | +6 (test) |
| `desktop/src/main/ipc/handlers/content-handlers.session-safety.test.ts` (or the nearest content-handler test) | + a content handler returns `{ code, schema }`, nothing else | +20 (test) |
| `desktop/src/main/ipc/handlers/diagnostics-handlers.test.ts` | + the vault row carries `errorCode` | +15 (test) |

**5.1 IPC: numbers only, no new channel (P-21)**

```ts
// messages.ts — stays free of root src/ imports (SECRET-WARN F7)
export interface SchemaVersionsMessage { vaultVersion: number; supportedVersion: number }
export type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; /** VAULT_SCHEMA_TOO_NEW only (P-21). */ schema?: SchemaVersionsMessage } };
// VaultStatusResponse gains: schemaTooNew?: SchemaVersionsMessage;
```

```ts
// to-ipc-result.ts
if (!result.ok) return { ok: false, error: errorFor(result.error) };

/** Only the code crosses — plus, for a newer-schema refusal, its two numbers. Never the message. */
const errorFor = (error: DomainError) =>
  error instanceof VaultSchemaTooNewError
    ? { code: error.code, schema: { vaultVersion: error.vaultVersion, supportedVersion: error.supportedVersion } }
    : { code: error.code };
```

**5.2 Session phase (`session-state.ts`)**

```ts
| { phase: "schema-too-new"; versions: SchemaVersionsMessage }

/** Terminal (P-18 (b)): the vault was upgraded by a newer Valija. Only quitting leaves this phase. */
export function afterSchemaTooNew(versions: SchemaVersionsMessage): SessionState {
  return { phase: "schema-too-new", versions };
}
```

- `afterStatusCheck(status)` checks `status.schemaTooNew` **first**: a newer vault with a valid key
  goes straight to the terminal phase, never to the dashboard.
- `canNavigateAwayFrom` stays `true`, so Settings can open for language and theme. Settings gets
  `unlocked={false}`, which hides Diagnostics and Move vault (F21, P-23).
- `autoTourOverlay` never fires there, because it requires `unlocked`.

**5.3 Routing every refusal (`lock-aware-bridge.ts`)**

```ts
/** `{ code: "VAULT_SCHEMA_TOO_NEW", schema }` anywhere routes to the terminal screen, like VAULT_LOCKED routes to Locked. */
export function withLockDetection(
  bridge: ValijaBridge,
  onLocked: () => void,
  onSchemaTooNew: (versions: SchemaVersionsMessage) => void = () => {},
): ValijaBridge
```

- `wrap` checks each result: `VAULT_LOCKED` → `onLocked()`; `VAULT_SCHEMA_TOO_NEW` **with**
  `schema` → `onSchemaTooNew(schema)`.
- A `VAULT_SCHEMA_TOO_NEW` without `schema` is not routed. The screen that made the call shows the
  inline `errors.VAULT_SCHEMA_TOO_NEW` copy instead (defensive; unreachable while every producer
  uses `schemaTooNewErr`, Slice 11 grep).
- This covers, with no change to any screen:
  - the **locked screen's unlock** (the `Router` already passes the wrapped bridge)
  - `upgradeCheck` on the confirm screen
  - every content and import call
- The optional third parameter keeps the existing tests and call sites unchanged. The name stays
  `withLockDetection` (naming note in §7).

**5.4 `app.tsx`**

```ts
const lockAwareBridge = useMemo(
  () => withLockDetection(bridge, () => setState(afterLock()), (versions) => {
    setWorkspaceView(resetWorkspaceView());
    setState(afterSchemaTooNew(versions));
  }),
  [],
);
```

```tsx
case "schema-too-new":
  return (
    <EntryShell>
      <SchemaTooNewScreen
        bridge={bridge}
        versions={state.versions}
        onOpenSettings={onOpenSettings}
        onQuit={() => window.close()}   // F20: the last window closing quits the app — no new IPC channel (P-22)
      />
    </EntryShell>
  );
```

**5.5 `screens/schema-too-new.tsx`**

```tsx
/**
 * Terminal (P-18 (b)): this vault was upgraded by a newer Valija, so this app will neither read nor
 * change it. Deliberately no unlock retry, no upgrade, no relocation, no delete — only Lock (drops
 * this device's session key; LockVault never migrates, F8) and Quit.
 */
export function SchemaTooNewScreen({ bridge, versions, onOpenSettings, onQuit }: {
  bridge: ValijaBridge;
  versions: SchemaVersionsMessage;
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [lockNote, setLockNote] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  async function lockVault() {
    setLocking(true);
    const result = await bridge.vault.lock();
    setLocking(false);
    if (!result.ok) return setLockNote(errorCopy(result.error.code));
    setLockNote(t(result.value.wasUnlocked ? "schemaTooNew.locked" : "schemaTooNew.alreadyLocked"));
  }

  return (
    <div className="screen schema-too-new">
      <button type="button" className="settings-gear" onClick={onOpenSettings}>{t("common.settings")}</button>
      <h1>{t("schemaTooNew.title")}</h1>
      <p>{t("schemaTooNew.body")}</p>
      <dl className="schema-versions">
        <dt>{t("schemaTooNew.vaultVersion")}</dt><dd>{versions.vaultVersion}</dd>
        <dt>{t("schemaTooNew.supportedVersion")}</dt><dd>{versions.supportedVersion}</dd>
      </dl>
      <p>{t("schemaTooNew.nothingChanged")}</p>
      <p>{t("schemaTooNew.howToFix")}</p>
      {lockNote !== null && <p role="status">{lockNote}</p>}
      <div className="actions">
        <button type="button" onClick={() => void lockVault()} disabled={locking}>{t("schemaTooNew.lock")}</button>
        <button type="button" onClick={onQuit}>{t("schemaTooNew.quit")}</button>
      </div>
    </div>
  );
}
```

- After **Lock**, the screen stays. The phase is terminal by design: only an updated app can open
  this vault (P-23).
- The screen calls exactly one bridge method, `vault.lock`.

**5.6 Copy (neutral Spanish, no voseo)**

| key | en | es |
|---|---|---|
| `schemaTooNew.title` | This vault needs a newer Valija | Esta bóveda necesita una versión más reciente de Valija |
| `schemaTooNew.body` | This vault was upgraded by a newer version of Valija. This app is older, so it will not read or change the vault. | Esta bóveda fue actualizada con una versión más reciente de Valija. Esta aplicación es más antigua, así que no leerá ni modificará la bóveda. |
| `schemaTooNew.vaultVersion` | Vault format (schema) | Formato de la bóveda (esquema) |
| `schemaTooNew.supportedVersion` | This app supports up to | Esta aplicación admite hasta |
| `schemaTooNew.nothingChanged` | Nothing in your vault was changed. | No se modificó nada en tu bóveda. |
| `schemaTooNew.howToFix` | Update Valija Desktop, then open it again. Your up-to-date Valija tools can keep using the vault. | Actualiza Valija Desktop y vuelve a abrirla. Tus herramientas de Valija actualizadas pueden seguir usando la bóveda. |
| `schemaTooNew.lock` | Lock vault | Bloquear bóveda |
| `schemaTooNew.locked` | Vault locked on this device. | Bóveda bloqueada en este dispositivo. |
| `schemaTooNew.alreadyLocked` | The vault was already locked. | La bóveda ya estaba bloqueada. |
| `schemaTooNew.quit` | Quit Valija | Salir de Valija |

**5.7 Styles (`screens.css`), tokens only**
- `.screen.schema-too-new` follows `.screen.relocate-vault`'s layout precedent.
- `.schema-versions` is a two-column `dl` grid.
- Every colour, border and background is `var(--…)` from `tokens.css`. There is no hex, `rgb()` or
  `hsl()`, so `[data-theme="light"]` and `[data-theme="dark"]` both apply with no new custom
  property.

**5.8 Tests**

- `to-ipc-result.test.ts`:
  - a `VaultSchemaTooNewError(5, 4)` crosses as exactly `{ code, schema: { vaultVersion: 5,
    supportedVersion: 4 } }`, and `JSON.stringify` holds no `message`
  - any other `DomainError` crosses as exactly `{ code }` (unchanged)
- `session-state.test.ts`:
  - `afterStatusCheck({ initialized: true, unlocked: true, schemaTooNew: {5,4} })` → the
    `schema-too-new` phase, not `unlocked`
  - `afterSchemaTooNew(v)` carries the versions
  - `canNavigateAwayFrom` is `true` for the new phase
- `lock-aware-bridge.test.ts`:
  - a nested call returning `{ code: "VAULT_SCHEMA_TOO_NEW", schema }` calls `onSchemaTooNew` once
    with the versions, and does **not** call `onLocked`
  - the same code without `schema` calls neither
  - `vault.unlock` and `vault.upgradeCheck` route too
  - existing cases are unmodified (the default third argument)
- `unlock-outcome.test.ts`: the code classifies as `error`, never `upgrade-required`, so no confirm
  screen.
- `schema-too-new.dom.test.tsx` (jsdom, fake bridge, like `recovery-kit.dom.test.tsx`):
  1. **en:** the title and both numbers (`5`, `4`) render next to their labels;
  2. **es:** the same, in Spanish;
  3. **actions are exactly** the settings gear, **Lock vault** and **Quit Valija**. No button text
     matches /unlock|upgrade|continue|move|delete|desbloquear|actualizar y|mover|eliminar/i;
  4. **Lock:**
     - `vault.lock` is called once;
     - `wasUnlocked: true` → "Vault locked on this device."; `false` → "already locked"; an error
       → the catalog copy;
     - the screen stays;
  5. **Quit** → `onQuit` is called once;
  6. **never modifies:** after every interaction, every fake except `vault.lock` (`unlock`,
     `upgradeCheck`, `init`, `relocation.*`, `content.*`, `import.*`, `bindings.*`) has 0 calls;
  7. **themes:**
     - rendered under a `data-theme="light"` wrapper and a `data-theme="dark"` wrapper, the text
       content is identical
     - a structural check reads `screens.css` and asserts that every declaration in the
       `.schema-too-new` and `.schema-versions` rules uses colour values only through `var(--`
       (no `#…`, `rgb(`, `hsl(`)
- `app.shell.test.ts`: `app.tsx` contains `case "schema-too-new"` rendering `SchemaTooNewScreen`
  inside `EntryShell`, and `onQuit={() => window.close()}`.
- `app.theme.test.ts`: `schema-too-new.tsx` contains no `data-theme` and never imports
  `theme-context`. It inherits the shell's theme, like every non-kit screen.
- `catalogs.test.ts` (en/es key parity) and `error-copy.test.ts` pass, unmodified.
- The content-handler and diagnostics-handler tests are as listed in the table.

**Docs in this commit:**
- `docs/gui.md`:
  - a new subsection under "Unlocking, and vault upgrades": "When this app is older than your
    vault". It explains the screen, both numbers, Lock and Quit, and "update the app".
  - one bullet under "What this app deliberately does not do": it never opens, downgrades or
    changes a vault made by a newer Valija.
- `specs/desktop.md`: the `IpcResult` `schema` field, `VaultStatusResponse.schemaTooNew`, the
  `schema-too-new` phase, the wrapper routing, and the screen (still the same channels).

**Done when:**
- both loops are green;
- `git diff -- desktop/src/shared/ipc/channels.ts desktop/src/preload` is empty;
- a manual run shows the screen in **light and dark** themes. The vault is patched with
  `setStoredSchemaVersion` and the app started twice: once locked (unlock → screen) and once
  unlocked (status → screen).

---

### Slice 6 — In-process adapters and container options

**Rationale.** Mode P is the same use cases composed with two different adapters. No use case
changes.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/vault/infra/in-memory-keychain.ts` | new: `InMemoryKeychain` | ~30 |
| `src/vault/infra/in-memory-activity-device-identity.ts` | new: `InMemoryActivityDeviceIdentity` | ~30 |
| `src/vault/infra/argon2.ts` | zero argon2's intermediate buffer (P-16) | +2 |
| `src/delivery/container.ts` | `ContainerOptions`; `deviceIdentity` and `autoLockMinutes` on `Container` | +20 |
| `src/delivery/mcp/server.test.ts` | the typed literal gains the two fields (F11) | +2 (test) |
| `src/vault/infra/in-memory-keychain.test.ts` | new | ~40 (test) |
| `src/vault/infra/in-memory-activity-device-identity.test.ts` | new | ~45 (test) |
| `src/delivery/container.test.ts` | new | ~70 (test) |
| `src/testing/recording-keychain.ts` | new test support: a `vi.mock` stand-in for `OsKeychain` that records calls and constructions, with a shared static store | ~35 (test support) |

**6.1 `InMemoryKeychain`**

```ts
/**
 * SDK Mode P and createVault (D-A): the derived key lives only in this object, in this process.
 * It never reaches the OS keychain, so unlocking a product never unlocks the user's AI tools (§11.1).
 * Best effort wiping (§11.3): owned bytes are zeroed on delete; strings handed out by getKey cannot be.
 */
export class InMemoryKeychain implements KeychainPort {
  private readonly keys = new Map<string, Buffer>();

  setKey(vaultId: string, keyHex: string): void {
    this.deleteKey(vaultId);
    this.keys.set(vaultId, Buffer.from(keyHex, "utf8"));
  }

  getKey(vaultId: string): string | null {
    return this.keys.get(vaultId)?.toString("utf8") ?? null;
  }

  deleteKey(vaultId: string): boolean {
    this.keys.get(vaultId)?.fill(0);
    return this.keys.delete(vaultId);
  }
}
```

**6.2 `InMemoryActivityDeviceIdentity`**

```ts
/**
 * SDK Mode P (⚑ D-A.3): the device id and lineage last-seen stay shared with the CLI (no false fork),
 * but idle activity is kept per handle in memory — a product never extends the OS session's idle clock.
 */
export class InMemoryActivityDeviceIdentity implements DeviceIdentity {
  private readonly activity = new Map<string, Date>();
  constructor(private readonly shared: DeviceIdentity) {}

  deviceId(): DeviceId { return this.shared.deviceId(); }
  lastSeen(vaultId: string): LineageSeen | null { return this.shared.lastSeen(vaultId); }
  recordSeen(vaultId: string, seen: LineageSeen): void { this.shared.recordSeen(vaultId, seen); }
  lastActivityAt(vaultId: string): Date | null { return this.activity.get(vaultId) ?? null; }
  recordActivity(vaultId: string, at: Date): void { this.activity.set(vaultId, at); }
}
```

**6.3 `container.ts`**

```ts
export interface ContainerOptions {
  vaultRoot?: string;
  /** SDK Mode P / createVault: an in-process key store. When given, OsKeychain is never constructed (§11.1). */
  keychain?: KeychainPort;
  /** SDK Mode P (⚑ D-A.3): idle activity stays in memory, never in the shared state.json. */
  keepActivityInMemory?: boolean;
  /** false: sessions refuse a behind-schema vault instead of migrating it (D-H). Default true. */
  autoMigrate?: boolean;
}
```

- `buildContainer(options = {})`:
  - `keychain = options.keychain ?? new OsKeychain()`
  - `sharedIdentity = new FileDeviceIdentity(resolveStatePaths(), ulidIds)`
  - `deviceIdentity` is the wrapper when `keepActivityInMemory`
  - `autoLockMinutes = parseAutoLockTtl(env)`
  - sessions get `{ autoMigrate: options.autoMigrate ?? true }`
- `Container` gains `deviceIdentity` and `autoLockMinutes`.
- Callers with no options (CLI, desktop main, relocation rebuild) are unchanged in behaviour.

**6.4 `argon2.ts`:** `const copy = new Uint8Array(key); key.fill(0); return copy;`

**6.5 Tests**
- **keychain:** round-trips; a second `setKey` replaces the first; a missing delete is `false`; the
  buffer is zeroed after delete.
- **activity wrapper:** activity stays in memory (the shared fake is untouched); the rest delegates;
  two wrappers are independent.
- **container** (`RecordingKeychain`, temp `VALIJA_HOME` and `VALIJA_STATE_HOME`):
  - default → one `OsKeychain` construction and a `FileDeviceIdentity`;
  - `{ keychain }` → 0 constructions;
  - the wrapper when `keepActivityInMemory`;
  - `autoLockMinutes` follows the env (`"0"` → `null`);
  - `autoMigrate: false` reaches the sessions.

**Docs in this commit:** `specs/vault.md` (the adapters) and `specs/delivery.md` (`ContainerOptions`;
"CLI, MCP and desktop pass no options").

**Done when:** both loops are green, and `server.test.ts` differs only by the F11 fields.

---

### Slice 7 — SDK contracts: public DTOs, closed error codes, input schemas

**Rationale.** D-O and D-Q make the public shapes a contract. This slice pins them before the facade
exists.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/sdk/dto/valija-error.ts` | new: `VALIJA_ERROR_CODES`, `ValijaErrorCode`, `ValijaError` | ~40 |
| `src/delivery/sdk/dto/requests.ts` | new: options and request types | ~70 |
| `src/delivery/sdk/dto/results.ts` | new: `ValijaVault`, result DTOs | ~70 |
| `src/delivery/sdk/mapping/to-valija-error.ts` | new: `toValijaError`, `unexpectedError`, `invalidInput` | ~35 |
| `src/delivery/sdk/validation/sdk-schemas.ts` | new: zod schemas plus `parseInput` | ~60 |
| `src/delivery/sdk/dto/valija-error.test.ts` | new: closure against the domain unions | ~40 (test) |
| `src/delivery/sdk/mapping/to-valija-error.test.ts` | new | ~45 (test) |
| `src/delivery/sdk/validation/sdk-schemas.test.ts` | new | ~80 (test) |

**7.1 `dto/valija-error.ts`**

```ts
/** Closed and documented (§7). Additive only within a minor version (D-T). */
export const VALIJA_ERROR_CODES = [
  // vault lifecycle
  "VAULT_NOT_FOUND", "VAULT_ALREADY_EXISTS", "VAULT_LOCKED", "WRONG_PASSPHRASE", "WEAK_PASSPHRASE",
  "KEYCHAIN_ERROR", "STORAGE_ERROR", "VAULT_UPGRADE_REQUIRED", "VAULT_SCHEMA_TOO_NEW",
  // save, handoff, pack, search
  "POSSIBLE_SECRET", "INVALID_PROJECT_NAME", "INVALID_ITEM_TYPE", "INVALID_TAG", "TOO_MANY_TAGS",
  "CONTENT_EMPTY", "CONTENT_TOO_LARGE", "INVALID_ITEM_ID", "ITEM_NOT_FOUND", "ITEM_ARCHIVED",
  "ITEM_PINNED", "ITEM_NOT_CURATABLE", "PROJECT_NOT_FOUND",
  // SDK input (W2, P-9)
  "INVALID_INPUT",
] as const;
export type ValijaErrorCode = (typeof VALIJA_ERROR_CODES)[number];

/** `message` is English for humans and not covered by semver. It never holds a key, a passphrase or refused content. */
export interface ValijaError { readonly code: ValijaErrorCode; readonly message: string }
```

Where each content code comes from:
- **`SaveContext.parseInput`:** the type, tag, content, secret and project codes, plus
  `INVALID_ITEM_ID`.
- **`supersedes`:** `ITEM_NOT_FOUND`, `ITEM_ARCHIVED`, `ITEM_PINNED`, `ITEM_NOT_CURATABLE`.
- **`GetContextPack` / `SearchContext`:** `PROJECT_NOT_FOUND`.

**7.2 `dto/requests.ts`**

```ts
interface VaultLocation {
  /** Required (D-U): a short slug, stamped as `source` on every save. Self-declared — attribution, not authentication. */
  client: string;
  /** Default: VALIJA_HOME, then ~/.valija — the same resolution as the CLI (D-C). */
  vaultRoot?: string;
}
/** Mode K — reuse the session the user unlocked with Valija. Recommended (§11.9). */
export interface KeychainSessionOptions extends VaultLocation { allowUpgrade?: boolean; passphrase?: never; recoveryKey?: never }
/** Mode P — the user typed their passphrase into this product. The derived key stays in this process. */
export interface PassphraseOptions extends VaultLocation { passphrase: string; recoveryKey?: never; allowUpgrade?: boolean }
/** Mode P — unlock with the 64-hex recovery key from the kit. */
export interface RecoveryKeyOptions extends VaultLocation { recoveryKey: string; passphrase?: never; allowUpgrade?: boolean }
export type OpenVaultOptions = KeychainSessionOptions | PassphraseOptions | RecoveryKeyOptions;
export interface CreateVaultOptions extends VaultLocation { passphrase: string }

export interface SaveRequest { project: string; content: string; type?: SaveableType; tags?: string[]; supersedes?: string }
export interface HandoffRequest { project: string; content: string }
export interface ContextPackRequest { project: string; budgetTokens?: number }
export interface SearchRequest { query: string; project?: string; limit?: number }
/** The five types a product may save. `imported` is never accepted (§5). */
export type SaveableType = "decision" | "progress" | "preference" | "fact" | "handoff";
```

A type test asserts that `SaveableType` equals `ItemType`.

**7.3 `dto/results.ts`**

```ts
export type VaultMode = "keychain-session" | "in-process";
export interface ForkNotice { readonly generation: number; readonly message: string }
export interface SavedItem { itemId: string; project: string; type: SaveableType; projectCreated: boolean; supersededItemId?: string }
export interface RenderedPack { project: string; markdown: string }                    // byte-identical to MCP get_context (P-13)
export interface SearchHit { id: string; project: string; type: SaveableType | "imported"; createdAt: string; content: string }  // P-12
export interface ProjectSummary { name: string; itemCount: number; lastActivityAt: string | null; description?: string }

/**
 * Show `recoveryKit` to the user ONCE, then discard it. Never store, log, sync or transmit it
 * (⚑ D-D.1, §11.4). It is the vault's permanent master secret — Valija has no re-key.
 */
export interface CreatedVault { vault: ValijaVault; vaultId: string; recoveryKit: string }

export interface ValijaVault {
  readonly vaultId: string;
  readonly mode: VaultMode;
  /** Mode P only: set when the open found a fork. Non-fatal; nothing was deleted or merged. */
  readonly forkNotice?: ForkNotice;
  save(request: SaveRequest): Promise<Result<SavedItem, ValijaError>>;
  saveHandoff(request: HandoffRequest): Promise<Result<SavedItem, ValijaError>>;
  getContextPack(request: ContextPackRequest): Promise<Result<RenderedPack, ValijaError>>;
  search(request: SearchRequest): Promise<Result<SearchHit[], ValijaError>>;
  listProjects(): Promise<Result<ProjectSummary[], ValijaError>>;
  /** Mode K: locks Valija on every surface, like `valija lock`. Mode P: forgets this handle's key only (⚑ D-A.1). */
  lock(): Promise<Result<void, ValijaError>>;
  /** Ends the handle. Mode P also forgets the key. Later calls give VAULT_LOCKED (P-14). */
  close(): Promise<Result<void, ValijaError>>;
}
```

`Result` is re-exported as a type from `shared/domain/result.ts`. Its declaration file has no
imports.

**7.4 `mapping/to-valija-error.ts`**

```ts
/** A use-case error crosses the SDK boundary only with a listed code; anything else is an unexpected STORAGE_ERROR (D-O). */
export function toValijaError(error: DomainError): ValijaError
/** A throw is never an expected condition: busy → the "vault busy" wording, anything else → a generic message (P-20). */
export function unexpectedError(thrown: unknown): ValijaError
export const invalidInput = (message: string): ValijaError => ({ code: "INVALID_INPUT", message });
```

It always returns a plain `{ code, message }`. It never returns a `DomainError` instance, so a
`VaultSchemaTooNewError`'s numbers do not cross into the SDK (P-21 keeps them desktop-only).

**7.5 `validation/sdk-schemas.ts` (P-10).** zod mirrors MCP's own schemas:

```ts
const clientLabel = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "client must be a short slug of [a-z0-9-]");
export const openVaultSchema = z.object({
  client: clientLabel, vaultRoot: z.string().min(1).optional(), allowUpgrade: z.boolean().optional(),
  passphrase: z.string().optional(), recoveryKey: z.string().optional(),
}).refine((o) => o.passphrase === undefined || o.recoveryKey === undefined,
          "pass a passphrase or a recovery key, not both");
export const createVaultSchema = z.object({ client: clientLabel, vaultRoot: z.string().min(1).optional(), passphrase: z.string() });
export const saveSchema = z.object({ project: z.string(), content: z.string(), type: z.enum(ITEM_TYPES).optional(),
  tags: z.array(z.string()).max(10).optional(), supersedes: z.string().max(64).optional() });
export const handoffSchema = z.object({ project: z.string(), content: z.string() });
export const contextPackSchema = z.object({ project: z.string(), budgetTokens: z.number().int().positive().optional() });
export const searchSchema = z.object({ query: z.string(), project: z.string().optional(), limit: z.number().int().positive().optional() });

/** Unknown keys are stripped (so a stray `pinned` never reaches SaveContext, F14). Messages name fields, never values. */
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): Result<T, ValijaError>
```

`limit` has no upper bound in the schema: `SearchContext` clamps it to 1–100 (§5 "same clamps").

**7.6 Tests**
- **closure:** every code except `INVALID_INPUT` is in `VaultErrorCode` ∪ `ContextErrorCode`
  (read with the same regex as `error-copy.test.ts`); no duplicates; no curation-only codes.
- **mapping:**
  - listed codes pass through
  - `VAULT_FORK_DETECTED` and `NOTHING_TO_EDIT` → `STORAGE_ERROR`
  - `SQLITE_BUSY` → "busy"
  - a thrown message is never copied
  - the keys are exactly `code` and `message`, also for a `VaultSchemaTooNewError`
- **schemas:**
  - the client slug rules
  - both credentials → `INVALID_INPUT`
  - `imported` is rejected
  - `Infinity`, `0`, `-1` and `2.5` budgets are rejected; `2.5` and `0` limits are rejected
  - `pinned` is stripped
  - messages never contain the rejected value

**Docs in this commit:** none yet. `docs/sdk.md` lands with the facade.

**Done when:** both loops are green.

---

### Slice 8 — SDK facade: `openVault`, `createVault`, the five operations, lock/close, idle timer

**Rationale.** This is the delivery adapter itself: validate, compose, call one use case, map.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/sdk/index.ts` | new: the public entry (re-exports only) | ~25 |
| `src/delivery/sdk/facade/vault-lifecycle.ts` | new: `openVault`, `createVault` | ~110 |
| `src/delivery/sdk/facade/vault-handle.ts` | new: `createVaultHandle` | ~130 |
| `src/delivery/sdk/facade/idle-lock-timer.ts` | new: `startIdleLockTimer` (⚑ D-A.2) | ~30 |
| `src/delivery/sdk/facade/vault-lifecycle.test.ts` | new | ~200 (test) |
| `src/delivery/sdk/facade/vault-handle.test.ts` | new | ~180 (test) |
| `src/delivery/sdk/facade/idle-lock-timer.test.ts` | new | ~60 (test) |
| `src/delivery/sdk/keychain-isolation.test.ts` | new: §11.1, §11.2 | ~110 (test) |
| `src/delivery/sdk/docs-example.test.ts` | new: runs the `docs/sdk.md` example (D-V) | ~45 (test) |
| `src/testing/passphrase-vault.ts` | new test support: a vault with a known passphrase, fast KDF parameters | ~40 (test support) |
| `CLAUDE.md` | + the approved *Surface parity* line (D-V) | +2 |

**8.1 `facade/vault-lifecycle.ts`**

```ts
/** Mode K (no secret) or Mode P (passphrase / recovery key). Never throws for an expected condition (D-O). */
export async function openVault(options: OpenVaultOptions): Promise<Result<ValijaVault, ValijaError>> {
  const parsed = parseInput(openVaultSchema, options);
  if (!parsed.ok) return parsed;
  return guarded(() => hasCredential(parsed.value) ? openInProcess(parsed.value) : openWithKeychainSession(parsed.value));
}

/** Same format and rules as `valija init`; the new vault is open in Mode P and nothing touches the OS keychain (D-D). */
export async function createVault(options: CreateVaultOptions): Promise<Result<CreatedVault, ValijaError>>
```

- **Mode K:**
  1. `buildContainer({ vaultRoot, autoMigrate: allowUpgrade === true })`
  2. `readVaultHeader` → `VAULT_NOT_FOUND` (no key read, no unlock)
  3. a `keychain-session` handle
- **Mode P:**
  1. `new InMemoryKeychain()`
  2. `buildContainer({ vaultRoot, keychain, keepActivityInMemory: true, autoMigrate })`
  3. `unlockVault.execute({ passphrase | recoveryKeyHex, upgradeConfirmed: allowUpgrade === true })`
  4. an `in-process` handle with `forkNotice = { generation, message: fork.notice.message }`
- **`createVault`:**
  1. validate
  2. an `InMemoryKeychain` and a container, as in Mode P
  3. `createVault.execute(passphrase)`
  4. `renderRecoveryKit(vaultId, keyHex, createdAt)`
  5. an `in-process` handle
  6. return `{ vault, vaultId, recoveryKit }`

  `keyHex` is never kept.
- **`guarded`:** one `try/catch` → `unexpectedError`.
- **Options are never retained** (§11.3).

**8.2 `facade/vault-handle.ts`**

```ts
interface HandleWiring {
  mode: VaultMode;
  container: Container;
  client: string;
  vaultId: string;
  keychain?: InMemoryKeychain;      // Mode P only
  forkNotice?: ForkNotice;
}
export function createVaultHandle(wiring: HandleWiring): ValijaVault
```

- **One runner:** a closed handle → `VAULT_LOCKED`; a use-case error → `toValijaError`; a throw →
  `unexpectedError`. Nothing is cached across calls (§8).
- **`save`:** `saveContext.execute({ project, content, type?, tags?, supersedes?, source: client })`,
  with fields passed explicitly. No `pinned` (D-K) and no override (D-L).
- **`saveHandoff`:** the same, with `type: "handoff"`.
- **`getContextPack`:** `{ project, markdown: renderContextPackMarkdown(pack) }`.
- **`search`:** `{ id, project, type, createdAt, content }`.
- **`listProjects`:** no marker, no detection; `envProject` is never read (D-M).
- **`lock()`:** Mode K → `container.lockVault.execute()` (D-B). Mode P → `forgetKey()` (⚑ D-A.1).
- **`close()`:** Mode P → `forgetKey()`. Both modes set `closed = true`, idempotently.
- **`forgetKey()`:** `timer.stop()`, then `keychain.deleteKey(vaultId)`.
- **Mode P timer:**
  `startIdleLockTimer(container.autoLockMinutes, () => container.deviceIdentity.lastActivityAt(vaultId), forgetKey)`.

**8.3 `facade/idle-lock-timer.ts` (⚑ D-A.2)**

```ts
/**
 * Proactive Mode P expiry: drops the key at the TTL even if the product never calls again.
 * Reads the same in-memory activity the lazy SessionGuard check uses. The timer is unref'd.
 */
export function startIdleLockTimer(
  ttlMinutes: number | null,
  lastActivityAt: () => Date | null,
  onExpire: () => void,
): { stop(): void }
```

- `check()` computes `remaining = ttlMs − (now − lastActivity)`.
- If `remaining <= 0`, it calls `onExpire()`; otherwise it calls
  `setTimeout(check, remaining).unref()`.
- `null` starts nothing.

**8.4 `index.ts`.** Re-exports only `openVault`, `createVault` and the `dto/` types (with
`Result`).

**8.5 CLAUDE.md (D-V).** Under *Surface parity*, after the MCP bullet:

```
- **The SDK (`valija/sdk`) is, like MCP, a deliberately narrower surface outside the CLI↔desktop parity rule.**
```

**8.6 Tests** (`RecordingKeychain`; temp `VALIJA_STATE_HOME`; `passphrase-vault.ts`):

- `vault-lifecycle.test.ts`:
  - **Mode K:** `VAULT_NOT_FOUND`; locked → `ok`, then `VAULT_LOCKED`; `source` stamped; `lock()`
    locks the CLI container (D-B); shared-TTL expiry deletes the fake key.
  - **Mode P:** passphrase and recovery key open; wrong or malformed credentials →
    `WRONG_PASSPHRASE`; both → `INVALID_INPUT`; two handles are independent; it never reads the OS
    fake even when that holds a key.
  - **fork:** `forkNotice.message` equals `UnlockVault`'s text, and nothing is deleted.
  - **D-H:** a behind vault → `VAULT_UPGRADE_REQUIRED` in both modes, with the marker unchanged;
    `allowUpgrade` → `LATEST` and no leftover `.bak`; the CLI still auto-migrates.
  - **`createVault`:**
    - only `vault.json` and `vault.db` are created
    - the kit equals `renderRecoveryKit`, and the header `kdf` equals `DEFAULT_KDF_PARAMS`
    - `VAULT_ALREADY_EXISTS` leaves the snapshot unchanged; `WEAK_PASSPHRASE` creates no folder
    - the mode is `in-process`
- `vault-handle.test.ts`:
  - **types:** each saveable type; `imported` → `INVALID_INPUT`.
  - **D-K / D-L:** a stray `pinned` is dropped; a planted secret → `POSSIBLE_SECRET`, nothing
    written, no echo.
  - **`supersedes`:** behaves as on MCP.
  - **`saveHandoff`.**
  - **pack:** equals `renderContextPackMarkdown`; `budgetTokens: 0` → `INVALID_INPUT`;
    `PROJECT_NOT_FOUND`.
  - **`search` and `listProjects`.**
  - **lock and expiry:**
    - Mode P `lock()` → `VAULT_LOCKED`, and the OS fake key is still present (⚑ D-A.1)
    - `close()` is idempotent
    - lazy expiry works
  - **serialization:** nothing holds the key hex, the passphrase or a planted secret, except
    `recoveryKit`.
  - **public type surface:** the handle's keys are exactly the ten listed.
- `idle-lock-timer.test.ts`: expiry; activity moves the deadline; `null` starts nothing; `stop()`
  cancels; `hasRef() === false`.
- `keychain-isolation.test.ts`:
  - **Mode P and `createVault`:** 0 constructions and 0 calls on the OS fake; afterwards the CLI
    `status` shows locked and MCP `get_context` returns `[VAULT_LOCKED]`.
  - **Mode K:** `setKey` is never called, and `deleteKey` only by `lock()`.
- `docs-example.test.ts`:
  - extracts the block between `<!-- sdk-example:start -->` and `<!-- sdk-example:end -->`
  - rewrites the specifier, writes a temp `.ts` file and imports it with temp `VALIJA_HOME` /
    `VALIJA_STATE_HOME`
  - the example's own assertions pass (A8)

**Docs in this commit:**
- `docs/sdk.md` (new), everything except Install and Electron:
  - the two modes (Mode K recommended), and `createVault` with the kit obligations
  - the five operations, the code table, and the version policy (schema **4**,
    `VAULT_SCHEMA_TOO_NEW`, `allowUpgrade` and the lock-out it causes)
  - concurrency (5 s wait, "busy", "close the product before switching devices") and "synchronous
    under the hood" (F16)
  - the honest limits (§11.3, §11.9)
  - stability `0.x`, and the example
- `specs/delivery.md`: a new `## sdk/` section.
- `CLAUDE.md`: the D-V line.

**Done when:** both loops are green. `console`, `process.exit` and `process.stdin` appear in
`src/delivery/sdk` only inside tests.

---

### Slice 9 — Integration: round-trips, concurrency, guard inertness, import inertness

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/sdk/sdk-round-trip.test.ts` | new | ~140 (test) |
| `src/delivery/sdk/sdk-concurrency.test.ts` | new: the four §8 tests | ~150 (test) |
| `src/delivery/sdk/sdk-schema-guard.test.ts` | new | ~90 (test) |
| `src/delivery/sdk/sdk-module-graph.test.ts` | new | ~60 (test) |
| `src/delivery/sdk/sdk-import-inert.test.ts` | new | ~70 (test) |

**9.1 Tests**

- **Round-trip:**
  1. SDK Mode K writes are visible in CLI `show` and MCP `get_context` / `search_context`, with
     `source` set;
  2. CLI and MCP writes are visible to the SDK; the pack is **byte-equal** to MCP's;
     `listProjects` matches MCP;
  3. `createVault` → CLI unlock works by passphrase and by the kit's recovery hex;
  4. resolution order; only `vault.json`, `vault.db` and `state.json` are created; no kit file
     anywhere.
- **Concurrency:**
  1. a worker holds the lock 1 s → the SDK `save` succeeds;
  2. past 5 s → `STORAGE_ERROR` "busy", count and generation unchanged;
  3. 30 interleaved writes (Mode K, Mode P, CLI) → no fork at the next unlock;
  4. a write is visible to the CLI immediately.
  - Afterwards there are no sidecars, and `DELETE` mode holds.
- **Schema guard:** at `LATEST + 1`, every Mode K operation and the Mode P open (both credentials)
  → `VAULT_SCHEMA_TOO_NEW`; the snapshot is unchanged; the Mode K key is still present; the Mode P
  in-memory key was never set.
- **Module graph:** walk the imports from `index.ts`. Nothing under `delivery/cli` or
  `delivery/mcp`, no `commander` or `@modelcontextprotocol/*`, no network or process API; the
  expected folder list is exact.
- **Import inert:** `vi.mock("node:fs")` recorder, a `process.env` `Proxy` attributed to `/src/`,
  and timer and console spies → all empty after `await import("./index.js")` (A10).

**Docs in this commit:** `docs/sdk.md` §Concurrency is cross-checked; `specs/delivery.md` §sdk lists
the tests.

**Done when:** both loops are green, and the concurrency file runs in under 15 s.

---

### Slice 10 — Packaging: second entry, declarations, `exports`, pack smoke test, remaining docs

**Files**

| File | Nature | Lines |
|---|---|---|
| `tsup.config.ts` | `entry: { program, sdk }`; comment on why there is no `dts` (F1) | +3 |
| `tsconfig.sdk.json` | new: declaration-only emit | ~14 |
| `package.json` | `exports`; `build` = tsup then `tsc -p tsconfig.sdk.json`; `smoke:sdk` | +8 |
| `scripts/sdk-pack-smoke.mjs` | new | ~90 (tooling) |
| `biome.json` | ignore `dist/types` if lint picks it up | +1 |

**10.1 `package.json`**

```json
"exports": {
  "./sdk": { "types": "./dist/types/delivery/sdk/index.d.ts", "import": "./dist/sdk.js" },
  "./package.json": "./package.json"
},
"scripts": {
  "build": "tsup && tsc -p tsconfig.sdk.json",
  "smoke:sdk": "node scripts/sdk-pack-smoke.mjs"
}
```

`bin`, `files`, `dependencies` and `devDependencies` are unchanged. There is no `"."` entry.

**10.2 `scripts/sdk-pack-smoke.mjs` (P-17).** Numbered steps, each exiting non-zero on failure:
1. build
2. pack
3. extract into a consumer dir
4. symlink the deps (offline, A11)
5. `nodenext` types check with `tsc --noEmit`
6. inert import: no output, exits within 2 s
7. `createVault` → `save` → `getContextPack` from the packed build
8. `program.js --version` prints `0.3.0`
9. no `commander` or MCP import in `sdk.js` or the chunks it loads

**Docs in this commit:**
- `docs/sdk.md` §Install and §Electron: `moduleResolution`, rebuilding
  `better-sqlite3-multiple-ciphers` (`argon2` and keyring are N-API), and "Mode P never **calls**
  the keychain".
- README: "Embed Valija in your product".
- SPEC §1, §3 and §10.
- CHANGELOG `Added`.
- `specs/delivery.md` §sdk packaging.

**Done when:** both loops, `npm run build` and `npm run smoke:sdk` pass.

---

### Slice 11 — Final gate (no file changes)

1. Run both full loops, then `npm run build && npm run smoke:sdk`.
2. `git diff --exit-code feat/secret-warning-SECRET-WARN...HEAD -- src/shared/infra/migrations/
   src/testing/__fixtures__/golden-vault src/delivery/context-pack-markdown.ts
   src/context/domain/services/context-pack.ts` is **empty**.
3. In the `package.json` diff, only `exports` and `scripts` change. The `package-lock.json` and
   `desktop/package.json` diffs are empty.
4. `git diff --exit-code feat/secret-warning-SECRET-WARN...HEAD -- src/delivery/mcp/server.ts
   src/delivery/cli/program.ts desktop/src/shared/ipc/channels.ts desktop/src/preload` is
   **empty**.
5. `grep -rnE "console\.|process\.(exit|stdin)|setInterval" src/delivery/sdk --exclude=*.test.ts`
   returns nothing.
6. `grep -rn "OsKeychain\|keyring" src/delivery/sdk --exclude=*.test.ts` returns nothing.
7. `grep -rnE "setItemPinned|setItemArchived|editItem|showProject|importConversations|vaultStatus|allowSecrets|pinned:" src/delivery/sdk --exclude=*.test.ts`
   returns nothing.
8. `grep -rn "setKey" src/delivery/sdk` returns nothing.
9. `grep -rn 'vaultErr("VAULT_SCHEMA_TOO_NEW"' src` returns nothing. Every refusal goes through
   `schemaTooNewErr`, so the desktop always receives the numbers (P-21).
10. `grep -nE "unlock\(|upgradeCheck|relocation\.|content\.|import\.|init\(" desktop/src/renderer/screens/schema-too-new.tsx`
    returns nothing (the screen never modifies the vault).
11. `server.test.ts` still reports 5 tools and 2 prompts.
12. Walk spec §13 line by line against §4.2, then hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

1. **Mode P open:**
   1. validate
   2. in-memory keychain and container (no `OsKeychain`)
   3. header
   4. Argon2
   5. **read-only probe**: newer or behind refused
   6. `readLineage`
   7. `setKey` (in memory)
   8. `recordActivity` (in memory)
   9. `recordSeen` (shared)
   10. the unref'd timer

   A refusal at step 5 or 6 leaves nothing set, written or recorded.
2. **Credentials and options are never retained** by the facade or the handle.
3. **`createVault`:**
   1. `headerExists`
   2. `parsePassphrase`
   3. derive
   4. header
   5. `initializeDb`
   6. in-memory `setKey`
   7. kit
   8. return once

   The kit is not a handle field, and nothing is written or logged.
4. **Every session open:**
   1. header
   2. key read
   3. **read-write open, refusing before the journal pragmas**
   4. upgrade gate
   5. idle guard
   6. `migrate` (with its backstop)
   7. repositories

   The key is kept on a refusal.
5. **Every unlock:** the probe runs before `readLineage`, `setKey`, `recordActivity` and
   `recordSeen`. `upgradeConfirmed` never bypasses it.
6. **Desktop terminal screen:**
   - it is reached only from status or from a refusal, before any content renders: the status
     branch is checked before `unlocked`, and the workspace view is reset on routing
   - its only bridge call is `vault.lock`, which drops the key without migrating (F8)
   - Quit closes the window
   - no unlock, upgrade, relocation, import or content call is reachable from it (DOM test plus the
     Slice 11 grep)
   - Settings opens with `unlocked={false}`, so vault actions stay hidden
7. **IPC carries numbers, never messages.** `schema` holds two integers, and only for
   `VaultSchemaTooNewError` (`to-ipc-result.test.ts`).
8. **Locking Mode P:** stop the timer, delete and zero the key, then mark the handle closed. The OS
   keychain is never touched.
9. **No widening of another surface's window** (⚑ D-A.3). There is no TTL option.
10. **Errors are codes and plain messages.** Thrown text is never copied (P-20). A serialization
    sweep checks it.
11. **No logging, no files, no network, no stdout** (greps, module-graph and import-inert tests).
12. **The secret check stays structural.** Fields are mapped explicitly, and there is no override.
13. **Busy writes roll back completely,** lineage included.

---

## 4. Test plan

### 4.1 By layer

| Layer | Files | Proves |
|---|---|---|
| Shared domain | `schema-compatibility.test.ts` | behind / current / newer |
| Shared infra | `migrations.test.ts`, `sqlite.test.ts` | backstops; refusal before pragmas; read-only probe; hot journal; busy |
| Vault domain | `errors.test.ts` | the typed error carries code, numbers and message |
| Vault infra | `file-vault-store`, `in-memory-keychain`, `in-memory-activity-device-identity` `.test.ts` | mapping; zeroing; in-memory activity |
| Vault use cases | `unlock-vault.schema-guard`, `vault-status`, `lock-vault` (+ the unmodified `upgrade-gate`) | refusal before key/activity; inert; status; lock |
| Context infra | `vault-sessions.test.ts` | refusal before the guard; `autoMigrate: false`; busy |
| Delivery | `cli/schema-guard`, `mcp/server.schema-guard`, `diagnostics`, `container` `.test.ts` | every command and tool; `status` line; `doctor` row; wiring |
| Desktop main | `to-ipc-result.test.ts`, content-handler and diagnostics-handler tests | code plus numbers only; localized row |
| Desktop state | `session-state`, `lock-aware-bridge`, `unlock-outcome` `.test.ts` | terminal phase from status and from any refusal; no confirm screen |
| Desktop DOM / structure | `schema-too-new.dom.test.tsx`, `app.shell.test.ts`, `app.theme.test.ts`, `catalogs`, `error-copy` | copy en/es, numbers, exactly Lock + Quit, never modifies, light/dark tokens only, routed inside `EntryShell` |
| SDK contracts | `valija-error`, `to-valija-error`, `sdk-schemas` | closed codes; mapping; validation |
| SDK facade | `vault-lifecycle`, `vault-handle`, `idle-lock-timer`, `keychain-isolation`, `docs-example` | modes, `createVault`, D-H/D-K/D-L, lock/close, expiry, §11.1/§11.2, serialization, type surface, docs example |
| Integration | `sdk-round-trip`, `sdk-concurrency`, `sdk-schema-guard`, `sdk-module-graph`, `sdk-import-inert` | same vault, byte-equal pack, §8 ×4, inert refusal, graph, inert import |
| Packaging | `npm run smoke:sdk` | tarball, types, inert import, bin, no CLI/MCP |

### 4.2 Acceptance criteria (spec §13) → where each is checked

| §13 criterion | Checked by |
|---|---|
| Mode K writes visible in `show`, MCP, desktop, `source` = client | `sdk-round-trip` 1 |
| CLI/MCP content visible to SDK; byte-identical pack; `listProjects` | `sdk-round-trip` 2 |
| Resolution order; shared state; no other file | `sdk-round-trip` 4 |
| Mode K locked / expiry / `lock()` locks the CLI | `vault-lifecycle` Mode K |
| No pin/edit/archive/list/export/status in the types | `vault-handle` type surface + Slice 11 step 7 |
| Mode P credentials; `WRONG_PASSPHRASE`; both → validation | `vault-lifecycle` + `sdk-schemas` |
| §11.1 zero OS calls; CLI locked; MCP `VAULT_LOCKED` | `keychain-isolation` |
| Mode P activity never shared; OS session still auto-locks | activity-adapter test + `keychain-isolation` |
| TTL proactive and lazy; `0`/`off`; unref'd | `idle-lock-timer` + `vault-handle` |
| `lock()`/`close()` → `VAULT_LOCKED`; OS session unaffected | `vault-handle` |
| Fork → non-fatal `forkNotice` | `vault-lifecycle` |
| `createVault` → CLI unlock by passphrase and recovery key; header = `init` | `sdk-round-trip` 3 + `vault-lifecycle` |
| Kit = `renderRecoveryKit`; no kit file | `vault-lifecycle` + `sdk-round-trip` 4 |
| `VAULT_ALREADY_EXISTS` untouched; `WEAK_PASSPHRASE` writes nothing | `vault-lifecycle` |
| The returned handle is Mode P | `keychain-isolation` |
| Secret refused, no override in types | `vault-handle` |
| `imported` rejected; `supersedes` as on MCP | `vault-handle` + `sdk-schemas` |
| No DTO/error holds the key, passphrase or refused content | `vault-handle` serialization + `to-valija-error` |
| `LATEST + 1` refused on every CLI command, MCP tool, desktop unlock and handler, `CheckVaultUpgrade`, SDK Mode P open, Mode K op | `cli/schema-guard`, `mcp/server.schema-guard`, desktop handler test + `lock-aware-bridge`, `unlock-vault.schema-guard`, `sdk-schema-guard` |
| …bytes, backups and keychains unchanged; OS key kept | `snapshotVaultFiles` in the same files + `vault-sessions` 1–2 |
| `status`/`doctor`/Diagnostics report, non-fatal; `lock` drops the key | `vault-status`, `diagnostics`, `cli/schema-guard`, `diagnostics-handlers`, `lock-vault`, DOM Lock case |
| Migration runner refuses (backstop) | `migrations.test.ts` |
| **Desktop `en`/`es` copy, no unlock loop, no upgrade-confirm screen** (now via the terminal screen, P-18 (b)) | `schema-too-new.dom.test.tsx`, `session-state`, `lock-aware-bridge`, `unlock-outcome`, `catalogs`, `error-copy` |
| D-H both modes; `allowUpgrade`; CLI/MCP unchanged | `vault-lifecycle` + `vault-sessions` 4–5 + `upgrade-gate` |
| §8 ×4, no false fork, no sidecar | `sdk-concurrency` |
| Tarball import, `nodenext` types, inert import, no CLI/MCP, bin | `smoke:sdk`, `sdk-import-inert`, `sdk-module-graph` |
| `docs/sdk.md` and its example | Slice 8/10 docs + `docs-example` |
| Docs in the same commit, CLAUDE.md line | per-slice docs + review |
| No new dependency, network call, tool/argument, command, channel or migration | Slice 11 steps 2–4 + `sdk-module-graph` |
| Loops green | every slice |

### 4.3 Surface parity

| Capability | CLI | Desktop | MCP | SDK |
|---|---|---|---|---|
| Refuse a newer vault on unlock | `error [VAULT_SCHEMA_TOO_NEW]`, exit 1 | **"Update Valija" screen** (both numbers) | — | Mode P open → code |
| Refuse it on every content operation | every command | **routes to the same screen** | `isError`, "update valija" | Mode K op → code |
| Report it | `status` line, `doctor` row | Diagnostics row; status at startup → the screen | — | — (D-J) |
| Lock a newer vault | `lock` | **Lock vault** on the screen | — | Mode K `lock()` |
| Leave | — | **Quit Valija** | — | `close()` |

### 4.4 Verification loop

```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
cd /home/user/valija && npx vitest run src/shared src/vault src/context/infra/vault-sessions.test.ts   # Slices 1–3
cd /home/user/valija/desktop && npx vitest run src/renderer/state src/renderer/screens/__dom-tests__/schema-too-new.dom.test.tsx src/main/ipc   # Slice 5
cd /home/user/valija && npx vitest run src/delivery/sdk                                                   # Slices 7–9
cd /home/user/valija && npm run build && npm run smoke:sdk                                                # Slice 10+
```

---

## 5. Assumptions (each one a place the plan could be wrong)

- **A1. TS 7's `tsc` emits declarations** for this codebase (Slice 0 step 2).
- **A2. Shipping an unbundled `.d.ts` tree is acceptable.** Consumers load only `index.d.ts` and
  the `dto/` files.
- **A3. A read-write connection that only reads does not modify `vault.db`.** The byte-equality
  tests check this every run. If one fails, P-7 (b) applies.
- **A4. `journal_mode = DELETE` on a `DELETE` vault does not write** (today's behaviour).
- **A5. Opening the database before the idle guard is behaviour-neutral** for the CLI, MCP and
  desktop. The only difference: a `STORAGE_ERROR` open no longer refreshes activity.
- **A6. `KEYCHAIN_ERROR` stays in the public union** even though nothing produces it yet.
- **A7. Mode K's `openVault` reads only the header.**
- **A8. Vitest can import a temp `.ts` file.** The fallback is a git-ignored `__generated__/`
  folder.
- **A9. A real hot journal can be produced in a test.** The fallback is an injected error.
- **A10. "Import must be inert" means Valija's own code**, not native dependency loaders.
- **A11. The smoke test is offline** (symlinked deps). A registry install is left to release QA.
- **A12. Docs per slice satisfy "same commit".**
- **A13. The version stays `0.3.0`.** The CHANGELOG entry goes under `Unreleased`.
- **A14. `docs/gui.md` gains one subsection and one bullet** (Slice 5). No screenshot is added; the
  screenshots section is unchanged.
- **A15. Closing the only window quits Valija Desktop on every platform.** Main registers no
  `window-all-closed` listener, and `main-window.ts` does not intercept `close` (grep found none),
  so Electron's default applies. If a later advance adds a macOS stay-alive handler, Quit would
  only close the window. Re-check it then (P-22).
- **A16. The terminal screen inherits the shell theme** (no `data-theme` of its own). The
  `EntryShell` brand panel stays its permanent dark, as on Locked.
- **A17. jsdom is acceptable for one more screen.** The original P-D5 limit of two DOM-tested screens
  was already widened by CURATION and SECRET-WARN (`project`, `import`, `search`, `pack-preview`).

---

## 6. Decisions

### 6.1 Resolved at Gate P (Oscar, relayed by the orchestrator)

| # | Decision | Resolution |
|---|---|---|
| P-1 (⚑ D-A.1) | Mode P `lock()`/`close()` drop the in-process key only; the OS session stays | **(a)** |
| P-2 (⚑ D-A.2) | Mode P auto-lock: lazy check **plus** a proactive unref'd timer | **(a)** |
| P-3 (⚑ D-A.3) | Mode P idle activity per handle, in memory | **(a)** |
| P-4 (⚑ D-D.1) | No kit file; `recoveryKit` returned once with documented obligations | **(a)** |
| P-5 | `.d.ts` via `tsc --emitDeclarationOnly`, an unbundled tree | **(a)** |
| P-6 | Read-only probe; on a hot journal, fall back to the read-write open (SQLite recovers, the pre-pragma refusal still guards) | **(a)** |
| P-7 | Refuse inside `openVaultDb` before the pragmas; sessions open the database before the idle guard | **(a)** |
| P-8 | "Vault busy" mapped in `SqliteVaultSessions` for every surface | **(a)** |
| P-9 | One SDK-only code, `INVALID_INPUT` | **(a)** |
| P-10 | zod schemas mirroring MCP; unknown keys stripped | **(a)** |
| P-11 | `openVault` returns the handle; `createVault` returns `{ vault, vaultId, recoveryKit }` | **(a)** |
| P-12 | `SearchHit` / `ProjectSummary` at MCP parity | **(a)** |
| P-13 | `getContextPack` → `{ project, markdown }` | **(a)** |
| P-14 | Calls after `lock()`/`close()` → `VAULT_LOCKED` | **(a)** |
| P-15 | Keep the static `@napi-rs/keyring` import; Mode P never constructs or calls it | **(a)** |
| P-16 | Zero `InMemoryKeychain`'s buffer and argon2's intermediate buffer | **(a)** |
| P-17 | Separate `npm run smoke:sdk` script | **(a)** |
| **P-18** | How the desktop reacts to `VAULT_SCHEMA_TOO_NEW` | **(b): a dedicated "Update Valija" terminal screen**, reached from status (`schemaTooNew`) or any refused call. It never offers to modify the vault, shows both schema numbers, and offers Lock and Quit (Slice 5) |
| P-19 | `VaultStatusOutput.schemaTooNew?`, present only when too new; `status` prints a line only then | **(a)** (the desktop now also routes on it) |
| P-20 | A generic message on an unexpected throw; the thrown text is never copied | **(a)** |

### 6.2 Still to confirm (new; they arise from P-18 = (b))

**P-21. How the screen learns the two schema numbers (F19).**
- **(a) Recommended:**
  - a typed `VaultSchemaTooNewError extends DomainError` (vault domain) carries
    `vaultVersion` / `supportedVersion`, and every producer builds it through `schemaTooNewErr`;
  - the desktop's `toIpcResult` adds an optional `schema: { vaultVersion, supportedVersion }` to the
    IPC error for that class only;
  - the bridge wrapper routes on it.
- (b) The screen shows the numbers only when status knows them (vault unlocked at startup), and on
  the unlock path it says "a newer schema" without numbers.
- (c) Parse the numbers out of the English error message in main.

*Trade-off:* (a) shows the numbers on **every** path, including the most common one (a locked vault
the user tries to unlock). It costs one small domain class and an optional IPC field (not a new
channel), and the SDK still exposes only `{ code, message }`. (b) needs no IPC change, but fails
Oscar's "shows vault vs supported" on the unlock path. (c) avoids a class, but makes a human message
load-bearing and breaks if the wording changes.

**P-22. How "Quit" works.**
- **(a) Recommended:** `window.close()` from the renderer. Closing the last window quits the app by
  Electron's default (F20, A15), so no new IPC channel is needed.
- (b) A new `app:quit` IPC channel that calls `app.quit()`.

*Trade-off:* (a) respects the spec's "no new IPC channel", at the cost of depending on a default
that a future macOS "stay in dock" handler would change. (b) is explicit and platform-proof, but
adds a channel, which spec §1 and §13 rule out. It would need a spec change.

**P-23. What the terminal screen keeps besides Lock and Quit.**
- **(a) Recommended:**
  - keep the **Settings gear**, for language and theme only. Settings already hides Diagnostics and
    Move vault when not unlocked (F21).
  - after **Lock**, stay on the screen with a "Vault locked on this device" note. The phase is
    terminal, because only an updated app can open this vault.
- (b) Lock and Quit only: no settings gear. After Lock, go to the Locked screen.

*Trade-off:* (a) lets a Spanish-speaking user switch the language of the one screen that matters,
and avoids a lock → unlock → same refusal loop. (b) is the strictest reading of "lock / quit", but
the screen's language is then stuck at whatever was set before, and Lock leads to a screen whose
only action re-triggers the refusal.

---

## 7. Naming, placement, and ubiquitous language

**Placement** (`CLAUDE.md` "no bare files at a layer's root"):

| New file | Folder kind | Precedent |
|---|---|---|
| `shared/domain/services/schema-compatibility.ts` | `services/` | `path-containment.ts` |
| `vault/infra/in-memory-keychain.ts`, `in-memory-activity-device-identity.ts` | tech-named infra adapters | `keyring.ts`, `file-device-identity.ts` |
| `vault/domain/errors.test.ts` | beside the per-module `errors.ts` exception | — |
| `delivery/sdk/index.ts` | package entry | `cli/program.ts` |
| `delivery/sdk/facade/…` | **new kind folder `facade/`** | spec §12 |
| `delivery/sdk/dto/…` | `dto/` | `context/application/dto/` |
| `delivery/sdk/mapping/to-valija-error.ts` | **new kind folder `mapping/`** | spec §12 "error mapping" |
| `delivery/sdk/validation/sdk-schemas.ts` | **new kind folder `validation/`** | `desktop/src/main/ipc/schemas.ts` |
| `delivery/sdk/*.test.ts` | beside the entry | `delivery/multi-device-sync.test.ts` |
| `desktop/src/renderer/screens/schema-too-new.tsx` | `screens/` (one file per screen) | `locked.tsx`, `migration-confirm.tsx` |
| `desktop/src/renderer/screens/__dom-tests__/schema-too-new.dom.test.tsx` | `__dom-tests__/` | `recovery-kit.dom.test.tsx` |
| `desktop/src/main/ipc/to-ipc-result.test.ts` | beside its file | `schemas.test.ts` |
| `testing/{schema-skew,recording-keychain,passphrase-vault}.ts` | test support | `fake-secrets.ts` |
| `tsconfig.sdk.json`, `scripts/sdk-pack-smoke.mjs` | build tooling | `tsup.config.ts` |

No new file sits loose at a `domain/application/infra` root. No use case is added.

**Names**

| Name | Verdict |
|---|---|
| `openVault`, `createVault`, `save`, `saveHandoff`, `getContextPack`, `search`, `listProjects`, `lock`, `close` | the spec's verbs and MCP's five operations |
| `ValijaVault`, `ValijaError`, `ValijaErrorCode`, `VALIJA_ERROR_CODES` | product-prefixed public names; the list mirrors `ITEM_TYPES` |
| `VaultMode` = `"keychain-session" \| "in-process"` | the spec's modes in words |
| `…Options`, `…Request`, `SavedItem`, `SearchHit`, `ProjectSummary`, `RenderedPack`, `CreatedVault`, `ForkNotice`, `SaveableType` | `…Request` follows the desktop IPC convention; `RenderedPack` avoids the domain's `ContextPack` |
| `InMemoryKeychain`, `InMemoryActivityDeviceIdentity` | `<tech><port>`. *Alternative if too long:* `ProcessLocalActivity` |
| `compareSchema`, `SchemaCompatibility`, `probeSchemaVersion`, `refuseNewerSchema` | the spec's words (§6, D-F) |
| `SchemaTooNewError` (shared infra, a thrown `Error`) vs `VaultSchemaTooNewError` (vault domain, a `DomainError`) | two layers, two kinds. Shared infra may not import the vault domain, so the adapters translate one into the other. The `Vault…` prefix marks the domain one, like `vaultErr` |
| `schemaTooNewErr`, `schemaTooNewMessage` | the `xxxErr` / `…_MESSAGE` conventions |
| `SchemaTooNewScreen`, phase `"schema-too-new"`, `afterSchemaTooNew`, catalog `schemaTooNew.*` | mirror `MigrationConfirmScreen` / `"upgrade-required"` / `afterUnlockUpgradeRequired` / `migration.*` |
| `SchemaVersionsMessage` | `…Message` is the desktop IPC suffix (`DiagnosticCheckMessage`) |
| `withLockDetection(bridge, onLocked, onSchemaTooNew)` | kept to avoid churn in existing call sites and tests. *Alternative:* rename it `withSessionRouting`, which is more accurate now, but touches `app.tsx` and the existing tests |
| `autoMigrate`, `keepActivityInMemory`, `allowUpgrade`, `startIdleLockTimer`, `createVaultHandle`, `toValijaError`, `unexpectedError`, `invalidInput`, `parseInput`, `INVALID_INPUT` | booleans read as sentences; verbs; `parseX` |

**Ubiquitous language.** The model and the copy say:
- *vault*, *unlock*, *lock*, *keychain session*, *in process*, *recovery kit*, *client*
- *schema … newer than this valija* and *update valija*
- on the desktop: "needs a newer Valija", "will not read or change the vault", "Nothing in your
  vault was changed"

They **never** say *account*, *login*, *sync*, *token* (for the key), *re-key*, *reset*, *downgrade*
or *repair*.

---

## 8. Estimated line count and risks

### Production lines

| Area | Lines |
|---|---|
| `src/shared` (`schema-compatibility`, migrations, sqlite) | ~80 |
| `src/vault` (errors incl. the typed error, store, three use cases, two adapters, argon2) | ~125 |
| `src/context/infra/vault-sessions.ts` | ~30 net |
| `src/delivery` (container, diagnostics, CLI status) | ~40 |
| `src/delivery/sdk` (index, facade ×3, dto ×3, mapping, validation) | ~570 |
| `desktop/src` (messages, `to-ipc-result`, session-state, bridge wrapper, screen, `app.tsx`, catalogs ×2, css) | ~165 |
| Build config | ~25 |
| **Total production** | **~1,035 (range 940–1,130)** |

The smoke script is about 90 lines. Tests are about 1,750, test support about 120, and docs about
450 (`docs/sdk.md` ≈ 250; `gui.md` ≈ 25; README, SPEC, `specs/` ×5, vault-format, CHANGELOG,
CLAUDE.md).

### Risks

1. **R1. The master secret passes through third-party code** (spec §15). Mitigations: Mode P never
   touches the OS keychain, the key lifetime is bounded, nothing is persisted, the kit is returned
   once, and Mode K is recommended. There is no re-key. **The follow-up is a passphrase-change /
   re-key advance.**
2. **R2. Version skew becomes a visible lockout.** On the desktop it is now a full-screen stop.
   That is clearer, but users who ignore updates will hit it. Mitigations: both numbers on screen,
   "update the app", `status`/`doctor` reporting, and SDK opt-in upgrades. The D-I follow-up
   remains open.
3. **R3. The TS 7 declaration toolchain** (Slice 0).
4. **R4. The session-open reorder** touches the most-used adapter. It is isolated in Slice 3, with
   the full suites unmodified as the check.
5. **R5. "Async" SDK calls block** (F16), as documented.
6. **R6. The hot-journal fallback** is verified in Slice 0 and pinned in Slice 1.
7. **R7. Native modules in host apps** (Electron rebuild), as documented.
8. **R8. Test runtime:** about 20 s more for the busy and Argon2 tests.
9. **R9. Desktop routing now has a second global trigger.** The bridge wrapper sends any
   `VAULT_SCHEMA_TOO_NEW` with numbers to a terminal phase from any screen, including mid-edit.
   That is intended: the vault cannot be used. But a wrongly classified error would strand the
   user. Mitigations:
   - routing needs the typed error, not just the code (`to-ipc-result.test.ts`, the wrapper tests);
   - Quit is always available;
   - Settings stays reachable.
10. **R10. Quit depends on Electron's default quit-on-last-window** (A15, P-22). A future macOS
    lifecycle change would silently turn it into "close window". This is noted in `specs/desktop.md`.
11. **R11. Size.** About 1,035 production lines over twelve slices, spanning shared, vault,
    context, delivery, desktop and build. Every slice is independently green.

---

## 9. Repo structure after execution

Legend: `+` new · `~` changed · unmarked = unchanged context.

```
valija/
├── CLAUDE.md                                             ~ + Surface parity line (D-V)
├── CHANGELOG.md                                          ~ Fixed: newer-schema refusal · Added: valija/sdk, desktop "Update Valija" screen
├── README.md                                             ~ + "Embed Valija in your product"
├── package.json                                          ~ + exports ("./sdk", "./package.json") · build = tsup && tsc -p tsconfig.sdk.json · + smoke:sdk
├── tsup.config.ts                                        ~ entry { program, sdk } (no dts — F1)
├── tsconfig.sdk.json                                     + declaration-only emit → dist/types
├── biome.json                                            ~ (only if lint scans dist/types)
├── scripts/
│   └── sdk-pack-smoke.mjs                                + pack → consumer → types → run → bin
├── advances/SDK/
│   ├── refined.md                                        (unchanged)
│   ├── plan.md                                           + THIS FILE
│   └── spike.md                                          + Slice 0 findings (implementer)
├── docs/
│   ├── sdk.md                                            + modes, createVault + kit, operations, codes, version policy, concurrency, limits, Electron, example
│   ├── gui.md                                            ~ + "When this app is older than your vault" · "does not do" bullet
│   ├── SPEC.md                                           ~ §1 · §3 · §8 · §10
│   └── vault-format.md                                   ~ §11 writers obey the newer-schema refusal
├── specs/
│   ├── shared.md                                         ~ schema-compatibility · openVaultDb refusal · probe · migrate backstop
│   ├── vault.md                                          ~ VAULT_SCHEMA_TOO_NEW · VaultSchemaTooNewError · refusals · schemaTooNew · in-memory adapters
│   ├── context.md                                        ~ vault-sessions open order · autoMigrate · busy
│   ├── delivery.md                                       ~ container options · diagnostics rows · status line · new sdk/ section
│   └── desktop.md                                        ~ IpcResult.schema · VaultStatusResponse.schemaTooNew · schema-too-new phase + screen (same channels)
├── src/
│   ├── shared/
│   │   ├── domain/services/
│   │   │   ├── schema-compatibility.ts                   + SchemaCompatibility, compareSchema
│   │   │   └── schema-compatibility.test.ts              +
│   │   └── infra/
│   │       ├── migrations.ts                             ~ + SchemaTooNewError, refuseNewerSchema; backstop first; table-aware schemaVersion
│   │       ├── migrations.test.ts                        ~
│   │       ├── migrations/                               (unchanged — schema v4)
│   │       ├── sqlite.ts                                 ~ applyKey → refuseNewerSchema → settleJournal · + probeSchemaVersion, isBusyError
│   │       └── sqlite.test.ts                            ~
│   ├── vault/
│   │   ├── domain/
│   │   │   ├── errors.ts                                 ~ + VAULT_SCHEMA_TOO_NEW, schemaTooNewMessage, VaultSchemaTooNewError, schemaTooNewErr
│   │   │   └── errors.test.ts                            +
│   │   ├── application/
│   │   │   ├── ports/vault-store.ts                      ~ doc only
│   │   │   └── use-cases/
│   │   │       ├── unlock-vault.use-case.ts              ~ refusal before readLineage
│   │   │       ├── unlock-vault.upgrade-gate.test.ts     (unchanged)
│   │   │       ├── unlock-vault.schema-guard.test.ts     +
│   │   │       ├── check-vault-upgrade.use-case.ts       ~
│   │   │       ├── vault-status.use-case.ts              ~ + schemaTooNew
│   │   │       ├── vault-status.use-case.test.ts         ~
│   │   │       ├── lock-vault.use-case.ts                (unchanged — F8)
│   │   │       └── lock-vault.use-case.test.ts           ~
│   │   └── infra/
│   │       ├── argon2.ts                                 ~ zero intermediate buffer
│   │       ├── file-vault-store.ts                       ~ probe · toStoreError
│   │       ├── file-vault-store.test.ts                  +
│   │       ├── keyring.ts                                (unchanged)
│   │       ├── in-memory-keychain.ts                     + (+ test)
│   │       └── in-memory-activity-device-identity.ts     + (+ test)
│   ├── context/infra/
│   │   ├── vault-sessions.ts                             ~ open order · autoMigrate · busy
│   │   └── vault-sessions.test.ts                        ~
│   ├── delivery/
│   │   ├── container.ts                                  ~ ContainerOptions · + deviceIdentity, autoLockMinutes
│   │   ├── container.test.ts                             +
│   │   ├── diagnostics.ts                                ~ vault / lineage rows on a newer vault
│   │   ├── diagnostics.test.ts                           ~
│   │   ├── cli/
│   │   │   ├── program.ts                                (unchanged)
│   │   │   ├── vault-commands.ts                         ~ status: schema line
│   │   │   └── schema-guard.test.ts                      +
│   │   ├── mcp/
│   │   │   ├── server.ts                                 (unchanged — 5 tools, 2 prompts)
│   │   │   ├── server.test.ts                            ~ typed literal + 2 fields (F11)
│   │   │   └── server.schema-guard.test.ts               +
│   │   └── sdk/                                          + NEW DELIVERY ADAPTER (valija/sdk)
│   │       ├── index.ts                                  +
│   │       ├── facade/                                   + NEW KIND FOLDER
│   │       │   ├── vault-lifecycle.ts (+ test)           + openVault, createVault
│   │       │   ├── vault-handle.ts (+ test)              + five operations, lock, close
│   │       │   └── idle-lock-timer.ts (+ test)           + ⚑ D-A.2
│   │       ├── dto/
│   │       │   ├── valija-error.ts (+ test)              +
│   │       │   ├── requests.ts                           +
│   │       │   └── results.ts                            +
│   │       ├── mapping/                                  + NEW KIND FOLDER
│   │       │   └── to-valija-error.ts (+ test)           +
│   │       ├── validation/                               + NEW KIND FOLDER
│   │       │   └── sdk-schemas.ts (+ test)               +
│   │       ├── keychain-isolation.test.ts                +
│   │       ├── docs-example.test.ts                      +
│   │       ├── sdk-round-trip.test.ts                    +
│   │       ├── sdk-concurrency.test.ts                   +
│   │       ├── sdk-schema-guard.test.ts                  +
│   │       ├── sdk-module-graph.test.ts                  +
│   │       └── sdk-import-inert.test.ts                  +
│   └── testing/
│       ├── schema-skew.ts                                +
│       ├── recording-keychain.ts                         +
│       └── passphrase-vault.ts                           +
└── desktop/src/
    ├── shared/
    │   ├── ipc/
    │   │   ├── messages.ts                               ~ + SchemaVersionsMessage · IpcResult error schema? · VaultStatusResponse.schemaTooNew?
    │   │   └── channels.ts                               (unchanged — no new channel)
    │   └── i18n/catalogs/
    │       ├── en.ts                                     ~ + errors.VAULT_SCHEMA_TOO_NEW · schemaTooNew.* (10)
    │       └── es.ts                                     ~ + errors.VAULT_SCHEMA_TOO_NEW · schemaTooNew.* (10)
    ├── preload/                                          (unchanged)
    ├── main/ipc/
    │   ├── to-ipc-result.ts                              ~ + schema numbers for VaultSchemaTooNewError only
    │   ├── to-ipc-result.test.ts                         +
    │   └── handlers/
    │       ├── content-handlers.session-safety.test.ts   ~ + { code, schema } only
    │       └── diagnostics-handlers.test.ts              ~ + vault row errorCode
    └── renderer/
        ├── app.tsx                                       ~ + case "schema-too-new" in EntryShell · wrapper callback · onQuit = window.close
        ├── app.shell.test.ts                             ~ + routing assertion
        ├── app.theme.test.ts                             ~ + screen sets no data-theme
        ├── screens/
        │   ├── locked.tsx                                (unchanged — the wrapper routes its refused unlock)
        │   ├── migration-confirm.tsx                     (unchanged)
        │   ├── schema-too-new.tsx                        + SchemaTooNewScreen ("Update Valija": versions, Lock, Quit)
        │   └── __dom-tests__/
        │       └── schema-too-new.dom.test.tsx           + en/es, numbers, exactly Lock + Quit, never modifies, light/dark tokens only
        ├── state/
        │   ├── session-state.ts                          ~ + "schema-too-new" phase · afterSchemaTooNew · afterStatusCheck branch
        │   ├── session-state.test.ts                     ~
        │   ├── lock-aware-bridge.ts                      ~ + onSchemaTooNew routing
        │   ├── lock-aware-bridge.test.ts                 ~
        │   ├── unlock-outcome.ts                         (unchanged)
        │   └── unlock-outcome.test.ts                    ~ + stays "error"
        └── styles/
            └── screens.css                               ~ + .screen.schema-too-new, .schema-versions (tokens only)
```

**Net:**
- **About 43 new files:**
  - 13 production code files:
    - 1 shared domain service
    - 2 vault infra adapters
    - 9 under `delivery/sdk/` (index, facade ×3, dto ×3, mapping, validation)
    - 1 desktop screen (`schema-too-new.tsx`)
  - 2 tooling files: `tsconfig.sdk.json` and `scripts/sdk-pack-smoke.mjs`
  - 24 test files: 21 root, plus `errors.test.ts`, `to-ipc-result.test.ts` and
    `schema-too-new.dom.test.tsx`
  - 3 test-support files
  - 2 docs: `docs/sdk.md`, and `advances/SDK/spike.md` (implementer)
- **About 50 changed files**, including 12 doc files plus `CLAUDE.md`.
- **6 new folders:** `src/delivery/sdk/`, its kind folders `facade/`, `dto/`, `mapping/` and
  `validation/`, and `scripts/`.
- **0** migrations (schema stays v4), new dependencies, new CLI commands, new IPC channels, and new
  MCP tools, arguments or prompts.
