# Changelog

All notable changes to valija. Format: [Keep a Changelog](https://keepachangelog.com), versioning: SemVer.

## [Unreleased]

### Added

- **Change the passphrase** (`advances/REKEY/`): `valija change-passphrase [--recovery-key <hex>]
  [--yes]` and the desktop app's **Settings → Vault & sync → Change passphrase…** re-encrypt the
  whole `vault.db` in place under the key the new passphrase derives (same salt and KDF parameters,
  so `vault.json` never changes), with a ciphertext backup, a fresh-connection verify, and crash
  safety: a crash leaves a vault the old or the new credential opens, or a backup the old one opens.
  Both always ask for the current credential — the recovery key resets a forgotten passphrase — and,
  in a synced folder, a confirmation that other devices are locked and synced. This device stays
  unlocked with the new key, and the new recovery kit is shown once. MCP and the SDK cannot change a
  passphrase. After a change elsewhere, `valija unlock`'s `WRONG_PASSPHRASE` (and the desktop copy)
  hints to use the new passphrase. New error codes: `PASSPHRASE_UNCHANGED`,
  `VAULT_FOLDER_UNSETTLED`, `REKEY_FAILED`.
- The recovery kit now says when its key was issued (**Key issued**) and that it replaces any
  earlier kit for the vault.
- A leftover rekey backup (`vault.db.pre-rekey.bak`, encrypted with the PREVIOUS passphrase/key) is
  flagged by `valija status`, `valija doctor`, and the desktop Sync panel and Diagnostics, and counts
  as an unsettled folder for relocation.

- Context for AI coding agents: an [`AGENTS.md`](AGENTS.md) index plus [`.context/`](.context/) flows and gotchas, maintained with [easy-repo-context](https://github.com/Akiles94/easy-repo-context) and checked in CI by `npm run context:check`. No runtime behavior changed.
- A generated developer guide ([`docs/guide/`](docs/guide/README.md)) — business flows with sequence diagrams, the code map and reference tables — checked in CI by `npm run docs:check`, which also requires TSDoc on every exported symbol. No runtime behavior changed.
- **`valija/sdk`: embed Valija in your product** (`advances/SDK/`, experimental `0.x`). A Node 22
  product can `import { openVault, createVault } from "valija/sdk"` and give its user's context a
  home in **the user's own vault** — the same `vault.json` + `vault.db` the CLI, desktop app and MCP
  use, found the same way (`vaultRoot`, `VALIJA_HOME`, `~/.valija`). Two ways in: **Mode K** reuses
  the session the user unlocked with Valija (recommended — the product never sees a secret);
  **Mode P** takes a passphrase or recovery key and keeps the derived key in the product's process
  only, never in the OS keychain, so it never unlocks the user's AI tools. `createVault` makes a new
  vault in `valija init`'s format and returns the recovery kit once. The operations are MCP's five —
  `save`, `saveHandoff`, `getContextPack` (byte-identical to `get_context`), `search`,
  `listProjects` — plus `lock` and `close`; secrets are refused with no override, and there is no
  curation, export or status. Every call returns a `Result` with a closed list of error codes and
  never throws for an expected condition. A vault behind the SDK's schema is not migrated without
  `allowUpgrade`. No network calls, no files besides the vault, nothing printed. Ships as the
  `./sdk` subpath export with TypeScript declarations; the `valija` bin is unchanged. **Supports
  vault schema 4.** See [docs/sdk.md](docs/sdk.md).
- **Desktop "Update Valija" screen** (`advances/SDK/`): when the desktop app is older than the vault
  (a newer Valija upgraded it), it stops on one screen that explains it, shows the vault's schema and
  the highest one this app supports, says nothing was changed, and offers only **Lock vault** and
  **Quit Valija** (Settings stays open for language and theme). It is reached at startup or from any
  refused call, in English or Spanish. The app never opens, downgrades or changes such a vault. Same
  37 IPC channels.
- **Secret check on every write (CLI)** (`advances/SECRET-WARN/`): `valija edit --content-file` and
  `valija import` refuse content that looks like it contains a secret (private keys, provider API
  keys and tokens, JWTs, passwords in URLs or assignments, long random-looking strings) with
  `error [POSSIBLE_SECRET]`, naming the kind and line, never the secret, and exit 1. `--allow-secrets`
  saves or imports it anyway; there is no prompt. Imports are all-or-nothing: each blocking chunk is
  listed as `#n "title" part p — kind (line k)` (`#n` works with `--pick`), and `--dry-run` shows the
  same list as "A real import would be REFUSED" while still exiting 0. Public key material
  (certificates, PEM public keys, `ssh-ed25519 …` public keys) is never flagged. Best effort: it can
  miss a secret or flag something harmless.
- **Secret check over MCP** (`advances/SECRET-WARN/`): `save_context` and `save_handoff` refuse
  content that looks like it contains a secret with `POSSIBLE_SECRET`; the reply names the kind and
  line and tells the AI to use a placeholder such as `<API_KEY>` or describe the value instead.
  Nothing is saved, and there is no override argument. Both save descriptions say so in one
  sentence. Still five tools and two prompts, with unchanged input schemas.
- **Secret warning in the desktop Edit dialog** (`advances/SECRET-WARN/`): saving text that looks
  like it contains a secret keeps the dialog open with a warning naming the kind and line (in English
  or Spanish), never the secret, plus **Edit text** and **Save anyway**. Main refuses on its own; the
  `content:edit` request gains an optional `allowSecrets` flag that only Save anyway sets. No new IPC
  channel.
- **Secret check on the desktop Import screen** (`advances/SECRET-WARN/`): imports are
  all-or-nothing. **Preview** says a real import would be refused and lists each blocking chunk
  (conversation number, title — hidden when it is itself flagged — part, kind and line); a refused
  **Import** writes nothing and offers **Uncheck these conversations** or **Import anyway**, which
  re-sends exactly the refused selection. `import:run` gains an optional `allowSecrets` flag and the
  import outcome gains `refused` and `blockingChunks`. Same 37 IPC channels.
- **Project detection from the CLI** (`advances/PROJECT-DETECT/`): `valija link <project>` links the
  current folder's git repository (or only the folder, `--by folder`) to an existing project;
  `valija which` shows what a folder resolves to and why; `valija links [project]` lists links with
  their ids, and `valija unlink <id>` (or `--dir`/`--by`) removes one. `valija show` and
  `valija export` now take an optional project, detected from the current folder when omitted —
  `VALIJA_PROJECT` first, then the deepest linked folder, then the linked repository. A given
  project always wins; `search` and `import` are unchanged; detection never creates a project and
  never runs `git`. New env var `VALIJA_PROJECT`.
- **Project detection over MCP** (`advances/PROJECT-DETECT/`): `project` is now optional on
  `save_context`, `save_handoff` and `get_context`. When it is omitted, the server resolves the
  workspace the client reports (MCP roots, else its working directory unless that is `/`, home or an
  install folder) through `VALIJA_PROJECT` and your links. Save replies add
  `(detected: linked folder | linked repository | VALIJA_PROJECT)` — never a path or a remote;
  `list_projects` marks the detected project `(this workspace)`; `/load-context` takes an optional
  project. Nothing linked → `PROJECT_NOT_DETECTED`, telling the AI to call `list_projects` and ask.
  A given `project` behaves exactly as before; `search_context` stays vault-wide. Still five tools
  and two prompts. Per-client behaviour is assumed until observed (`advances/PROJECT-DETECT/spike.md`).
- **Project links in Valija Desktop** (`advances/PROJECT-DETECT/`): each project screen gets a
  **Linked folders & repositories** section — the project's links with **Unlink**, and **Link a
  folder…**, which opens the folder picker and shows what the folder resolves to now before linking
  it by repository (any clone) or by folder. Same use cases as `valija which`/`link`/`unlink`/`links`;
  five new IPC channels (`dialog:chooseProjectFolder`, `bindings:inspect|link|unlink|list`), none of
  which takes a path. The app itself never detects a project.
- **Curation in Valija Desktop**: each project card gets **Pin**/**Unpin**, **Edit** (a dialog for
  content, tags and type — the same `EditItem` as `valija edit`) and **Archive**, with an
  **Undo** notice after archiving and a **Show archived** toggle that lists archived items in their own
  section with **Unarchive**. Three new IPC channels (`content:setPinned`, `content:setArchived`, `content:edit`), going
  through the same use cases as the CLI.
- **Curation from the CLI**: `valija pin | unpin | archive | unarchive <id>` and
  `valija edit <id> [--content-file <file|->] [--tags a,b] [--type t]`, addressed by full id or a unique
  6+-character prefix. `valija show` now prints each item's id, and `--archived` includes archived items.
  Archive hides an item from packs and search without deleting it.
- **Curation** (`advances/CURATION/`): `save_context` gains an optional `supersedes` argument — the
  exact id of one outdated item in the same project, archived in the same write as the new save (all
  or nothing; never pinned, imported or already-archived items). `search_context` lines now include
  each item's id. Still five MCP tools.

- **Valija Desktop** — an Electron companion app (`desktop/`, distributed as its own unsigned
  [GitHub release](https://github.com/Akiles94/valija/releases/tag/desktop-v0.1.0), not part of the
  npm package) giving the vault a window: browse, search and export context packs; connect Claude
  Code, Claude Desktop and Cursor with one click; import chat history; a bilingual (English/Spanish)
  UI with a welcome tour and a Settings screen; a Diagnostics screen mirroring `valija doctor`; and a
  **vault relocation wizard** — move your vault into a folder a sync client already keeps up to
  date, re-pointing every already-connected AI tool's config as part of the move. See
  [`docs/gui.md`](docs/gui.md). No MCP tool, CLI command, or published npm package changed.
- `src/vault`: a **schema-upgrade consent gate** — `UnlockVault` now refuses
  (`VAULT_UPGRADE_REQUIRED`) to migrate a behind-schema vault unless the caller confirms
  (`upgradeConfirmed: true`); the CLI passes this at its one call site, so `valija unlock`'s own
  behavior — migrate silently — is unchanged. A new `readSchemaVersion` read lets a caller check the
  pending migration (and whether it backs up ciphertext) before confirming.
- `src/vault`: a **vault relocation use case** (`RelocateVault`) — copies the vault to a new folder,
  verifies the copy byte-for-byte before removing the original, and refuses to run against an
  unlocked vault or an unsafe destination (occupied, unwritable, nested, or a source that isn't at
  rest). Used by the desktop app's relocation wizard; no CLI command added.
- `src/delivery`: `context-pack-export.ts` and `diagnostics.ts` — the composition `valija export`
  and `valija doctor` already used, lifted into shared functions the desktop app also calls, so
  "byte-identical to the CLI" is structural rather than a test that can rot.

- `docs/vault-format.md` — a written contract documenting the vault's crypto parameters, header schema, encrypted schema, pack-assembly algorithm, markdown rendering, and search query construction, for anyone building a second (non-Node) reader — starting with the mobile companion groundwork in `advances/M4/`. Verified against a committed golden-vault conformance fixture (`src/testing/__fixtures__/golden-vault/`) that proves the desktop implementation matches it byte-for-byte; no behavior change.
- `advances/MOBILE/` — a Kotlin Multiplatform proof of concept (in the separate `akiles94/valija-mobile` repo) proved the vault format and pack algorithm are portable: a second implementation renders a byte-identical pack, and the vendored SQLite3MultipleCiphers amalgamation plus Argon2id compile and execute through both JNI/NDK and Kotlin/Native cinterop, verified in CI against an Android emulator and an iOS simulator. No distributable mobile app is planned (decided against, 2026-08-16); on-device Argon2id latency and Android arm64 execution were never measured and stay open if mobile is ever reconsidered. No behavior change.

### Changed

- Vault schema v4 (migration 004, `project_bindings`, PROJECT-DETECT): the encrypted vault gains a
  table of project links. Unlocking an older vault migrates it in one transaction, after taking a
  ciphertext backup that is removed once the migration commits; Valija Desktop asks before
  upgrading, as for earlier migrations.
- Re-importing an export no longer un-archives imported chunks you archived; their content is still
  refreshed.

### Fixed

- **An older valija no longer opens a vault upgraded by a newer one** (`advances/SDK/`). Every
  command, MCP tool and unlock now refuses it with `VAULT_SCHEMA_TOO_NEW`, naming the vault's schema
  and the highest one this version supports and asking you to update valija. The refusal is inert:
  nothing is written, migrated or recorded, and the session key stays in the keychain. `valija status`
  adds a `schema:` line, `valija doctor` shows a failing (non-fatal) `vault` row, and `valija lock`
  still locks. Before, an older valija ran its journal pragmas on such a vault and carried on as if
  the schema were its own.
- A write that stays blocked by another valija process for more than 5 s now fails with
  `STORAGE_ERROR` "The vault is busy … Nothing was saved. Try again." instead of an uncaught SQLite
  error (`advances/SDK/`). A contended write now also **waits** for that timeout: writes take the
  vault's write lock up front, where before one that had read first was refused at once.

- `docs/vault-format.md` corrected in five places where a real second implementation (the Kotlin proof of concept in `advances/MOBILE/`) proved the contract wrong or under-specified: the markdown concatenation rule, the three distinct section-label budgeting rules, latest-handoff selection, `estimateTokens`'s UTF-16 code-unit semantics, and the preamble's ISO timestamp format. Documentation only — this describes existing behavior; no code, fixture, or output changed.

## [0.3.0] — 2026-07-25

Bring-your-own-cloud vault sync — keep your vault in a folder your own sync client (Dropbox, iCloud Drive, OneDrive, Syncthing, …) already replicates, and use it safely across devices. See [docs/sync.md](docs/sync.md).

### Added

- Vault journaling switched from WAL to a rollback journal (`DELETE`): at rest, after every command, the vault is a single self-consistent `vault.db` — no `-wal`/`-shm` sidecar a sync client could upload out of step.
- Fork detection: each write stamps the vault's lineage (generation + a random write stamp, inside the encrypted db); `valija unlock` adopts a clean handoff from another device silently, and reports `VAULT_FORK_DETECTED` — without deleting or overwriting anything — if two devices wrote independently from the same starting point.
- `valija lock` now confirms the vault is safely at rest as a single file and reports the current generation and who wrote it last.
- Idle auto-lock: an unlocked vault re-locks itself after 15 minutes of inactivity by default (`VALIJA_AUTOLOCK_MINUTES` to change or `0`/`off` to disable). Lazy, no background process.
- `valija status` / `valija doctor` report journal mode, sync-folder recognition, a warning on a vendor "conflicted copy" file (Dropbox/iCloud/Syncthing) or a leftover `*.pre-NNN.bak` upgrade backup, lineage generation/last-writer, and auto-lock state.
- Schema migration 003 (lineage baseline) — runs automatically, with a ciphertext backup on first upgrade of an existing vault.

### Notes

- No new MCP tool, argument, or prompt. Sync/lineage/device/session data never reaches a context pack or an MCP tool response — it is CLI-only plumbing (`status`/`lock`/`unlock`/`doctor`).
- Device identity and activity timestamps are device-local (`VALIJA_STATE_HOME`, default `~/.valija-state`) and never sync — separate from `VALIJA_HOME` by design.
- No valija-hosted sync service. No automatic conflict merge, ever, by design.

## [0.2.0] — 2026-07-22

Importers — load your existing chatbot history into the vault so a fresh install is no longer empty.

### Added

- `valija import <file> -p <project>` — import ChatGPT and Claude official exports (`.json` or `.zip`), plus a generic JSON format for any other provider. Auto-detects the source (or `--from chatgpt|claude|generic`).
- **List-first safety:** with no selection flag the command lists conversations and writes nothing. Select with `--pick 1,3-5`, `--query <text>`, `--since <YYYY-MM-DD>`, or `--all`; `--dry-run` previews without writing.
- New `imported` item type: imported conversations are chunked into markdown items, **searchable** via `search_context` / `valija search` and `valija show <p> --type imported`, but **excluded from context packs** (`get_context`) and never creatable from an MCP tool. Original conversation dates are preserved; re-importing the same file does not duplicate.
- Schema migration 002 (context_items type constraint) — runs automatically, transactional, with a ciphertext backup on first upgrade of an existing vault.

### Notes

- `.zip` exports are inflated entirely in memory (no extraction to disk), with a decompression-bomb cap.
- Imported transcripts are stored verbatim and are not sanitized; their blast radius is bounded by exclusion from context packs. New dependency: `fflate`.

## [0.1.0] — 2026-07-11

First release.

### Added

- Encrypted local vault: SQLCipher whole-database encryption (FTS5 search index included), Argon2id key derivation, plaintext header (`vault.json`), one-time recovery kit.
- Session model: `valija unlock`/`lock` via the OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service). No daemon.
- MCP server (`valija mcp`, stdio): `save_context`, `save_handoff`, `get_context` (token-budgeted context pack), `search_context`, `list_projects`; prompts `/save-context` and `/load-context`.
- CLI: `init`, `unlock`, `lock`, `status`, `projects`, `show`, `search`, `export` (md/json), `install <claude-code|claude-desktop|cursor>`, `doctor`.
- Context pack assembly: pinned items always first (newest kept under budget pressure), latest handoff, then decisions → preferences → progress → facts, newest first, within a ~4000-token default budget.

### Security notes

- Everything at rest is ciphertext. Losing the passphrase **and** the recovery kit means the data is unrecoverable, by design.
- Any connected MCP client receives plaintext of the context you load. Encryption protects data at rest.
- No telemetry, no network calls at runtime.
