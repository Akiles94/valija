# Changelog

All notable changes to valija. Format: [Keep a Changelog](https://keepachangelog.com), versioning: SemVer.

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
