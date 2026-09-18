# Changelog

All notable changes to valija. Format: [Keep a Changelog](https://keepachangelog.com), versioning: SemVer.

## [Unreleased]

### Added

- **Valija Desktop** — an Electron companion app (`desktop/`, unpublished, not part of the npm
  package) giving the vault a window: browse, search and export context packs; connect Claude Code,
  Claude Desktop and Cursor with one click; import chat history; a bilingual (English/Spanish) UI
  with a welcome tour and a Settings screen; a Diagnostics screen mirroring `valija doctor`; and a
  **vault relocation wizard** — move your vault into a folder a sync client already keeps up to
  date, re-pointing every already-connected AI tool's config as part of the move. See
  [`docs/gui.md`](docs/gui.md). No MCP tool, CLI command, or published package changed.
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

### Fixed

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
