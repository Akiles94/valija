# Overview
Purpose: Local-first, end-to-end encrypted (SQLCipher + Argon2id) AI-context vault, exposed through a CLI, a local stdio MCP server and an Electron desktop app. Product spec: `docs/SPEC.md`; process: `CLAUDE.md`, `CONTRIBUTING.md`; generated developer guide: `docs/guide/README.md`; on-disk format: `docs/vault-format.md`; sync: `docs/sync.md`; GUI: `docs/gui.md`.
## Components
- `src/vault` — key lifecycle: create/unlock/lock/status/relocate/change passphrase (in-place re-encryption, `src/vault/infra/sqlite-vault-rekeyer.ts:SqliteVaultRekeyer`), lineage + fork detection, idle auto-lock; `src/vault/application/use-cases/unlock-vault.use-case.ts:UnlockVault`.
- `src/context` — projects and items, save, search (FTS5), context packs; reaches the DB only via `src/context/infra/vault-sessions.ts:SqliteVaultSessions`.
- `src/importers` — ChatGPT/Claude/generic export parsing and chunking, written via context's `ImportItems`; `src/importers/application/use-cases/import-conversations.use-case.ts`.
- `src/shared` — `Result`, `UseCase`, SQLite open + migrations, vault/state paths; `src/shared/infra/sqlite.ts:openVaultDb()`.
- `src/delivery` — composition root `src/delivery/container.ts:buildContainer()`; CLI `src/delivery/cli/build-program.ts:buildProgram()` (bin `src/delivery/cli/program.ts`); MCP `src/delivery/mcp/server.ts:buildMcpServer()`; embeddable SDK `src/delivery/sdk/index.ts` (`valija/sdk` subpath export: `openVault`, `createVault`).
- `src/testing` — golden-vault fixture and fakes for the format-conformance test (`src/testing/golden-vault.ts`).
- `desktop/` — Electron app, own `desktop/package.json`; main `desktop/src/main/index.ts`, IPC `desktop/src/main/ipc/register-handlers.ts:registerHandlers()`, preload `desktop/src/preload/index.ts`, renderer `desktop/src/renderer/app.tsx`.
- `tools/living-docs` — generator/checker for `docs/guide/` from code + `docs/flows/`; entry `tools/living-docs/valija/composition/main.ts`, config `tools/living-docs/valija/composition/valija-guide.ts`.
- `advances/` — per-advance refined/plan/review records (decision log).
## Data stores
| Store | Where | Holds |
|---|---|---|
| `vault.db` | `$VALIJA_HOME` or `~/.valija` (`src/shared/infra/vault-paths.ts:resolveVaultPaths()`) | SQLCipher DB: projects, items + FTS5, project bindings (folder/repository links), meta (schema version), lineage |
| `vault.json` | same folder, plaintext | vault id, salt, Argon2id params (`src/vault/infra/vault-header.ts`) |
| OS keychain | service `valija`, one entry per vault id (`src/vault/infra/keyring.ts:OsKeychain`) | derived key; present = unlocked |
| `state.json` | `$VALIJA_STATE_HOME` or `~/.valija-state` (`src/shared/infra/state-paths.ts`) | device id, last-seen lineage, last activity (`src/vault/infra/file-device-identity.ts`) |
| `preferences.json` | Electron `userData` (`desktop/src/main/infra/file-app-preferences-store.ts`) | theme, language, tour-seen, vault path |
| AI client configs | per client (`src/delivery/cli/installer.ts:clientConfigPath()`) | MCP server entry; timestamped backup before each write |
| Sync folder | user's own cloud folder as `VALIJA_HOME` | the same `vault.db` + `vault.json`; see `docs/sync.md` |
## Boundaries
- Dependency rule (`CONTRIBUTING.md`): `context → vault` only via `VaultSessions`; `importers → context` only via `ImportItems`; use cases never call each other.
- CLI, MCP and desktop IPC all call use cases from one `Container`; desktop main imports root `src/` by relative path.
- Renderer ↔ main: only `window.valija` methods from the preload; errors as `code` only; paths as opaque handles; the passphrase goes in, the recovery kit comes out once.
- MCP surface is deliberately narrower than CLI/desktop (SPEC §7), and so is the SDK (MCP's five operations plus lock/close; no curation, export or status). Nothing networks: no telemetry, no HTTP transport, no auto-update.
- Traced flows: `flows/unlock-vault.md`, `flows/save-context.md`, `flows/multi-device-sync.md`, `flows/import-chat-history.md`, `flows/context-pack.md`, `flows/desktop-ipc-call.md`, `flows/change-passphrase.md`.
