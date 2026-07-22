# Changelog

All notable changes to valija. Format: [Keep a Changelog](https://keepachangelog.com), versioning: SemVer.

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
