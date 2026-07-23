# Spec: delivery — CLI, MCP server, composition root

`src/delivery/` sits at the top of the dependency graph: it wires `vault` + `context` + `shared` into runnable entry points. It is not a bounded context.

## container.ts

`buildContainer()` is the single composition root: constructs the infra adapters (`Argon2VaultCrypto`, `OsKeychain`, `FileVaultStore`, `SqliteVaultSessions`, `FileExportReader`, the `parserRegistry`) and injects them into every use case — including `ImportConversations`, wired over an `ImportItems` write path. Both entry points share one container. M3 adds `FileDeviceIdentity` (over `resolveStatePaths()`), `FileVaultFolder`, and a `SessionGuard` built from `parseAutoLockTtl(process.env.VALIJA_AUTOLOCK_MINUTES)` — threaded into `SqliteVaultSessions`, `UnlockVault`, `LockVault`, and `VaultStatus`.

## context-pack-markdown.ts

`renderContextPackMarkdown(pack)` turns an assembled `ContextPack` into markdown: the `# Context pack:` header, one `##` per section, and `### type · date · #tags` per item. **Formatting lives here, not in the domain** — the domain orders sections, delivery names and renders them. Shared by `cli/` (`export`) and `mcp/` (`get_context`).

## cli/ — `valija <command>`

| Command | Behavior |
|---|---|
| `init` | Prompt passphrase twice (hidden on a TTY); print recovery kit once; vault starts unlocked. |
| `unlock [--recovery-key <hex>]` | Session control via the keychain. On success, if the lineage classifies as a **fork** (M3, D-B), the vault still unlocks (for inspection) and a `VAULT_FORK_DETECTED` notice prints alongside the vault folder path — no exit-1, so the user isn't stranded from `doctor`, the tool that helps resolve it. |
| `lock` | Drops the key; on a real unlock→lock transition also prints the M3 "safe to switch devices" line — generation + whether this device or another device wrote last — plus a warning if stray `-wal`/`-shm`/`-journal` sidecars are present (not safely at rest). |
| `status` | Session control via the keychain, plus (M3) journal mode + single-file state, lineage generation/last-writer when unlocked, and the auto-lock TTL/idle state. |
| `projects` / `show <p> [--type]` / `search <q> [-p]` | Read views. `show --type imported` lists imported items. |
| `export <p> [--json] [-o file]` | Context pack to stdout/file — the escape hatch for non-MCP tools. md = `GetContextPack` with an infinite budget, rendered; json = `ShowProject` serialized as `{ project, items }`. |
| `import <file> -p <p> [--from] [--list] [--pick] [--query] [--since] [--all] [--dry-run]` | Import chatbot history. **No selection flag → lists conversations and writes nothing** (the safe default); `-p` required for a real import or `--dry-run`. Auto-detects chatgpt/claude unless `--from` is given (`generic` requires it). Prints `Imported N item(s) from M conversation(s) into "<p>" (skipped S, failed F)`. See [importers.md](importers.md). |
| `install <claude-code\|claude-desktop\|cursor>` | Merge the MCP entry into the client config, backing up first; refuses to touch non-object/invalid JSON; prints manual fallback. |
| `mcp` | Run the stdio server (used by tools, not humans). |
| `doctor` | Check node ≥22, sqlcipher load, keychain r/w, vault state, client configs, and (M3) journal/single-file state, cloud-folder recognition with a lock-before-switch reminder, a loud warning on a vendor conflicted-copy file, lineage generation/last-writer, and auto-lock TTL/idle state. All four M3 checks are advisory — never fatal, never exit non-zero. |

Errors print `error [CODE]: message` and exit 1 (the fork notice on `unlock` is the one deliberate exception — see above).

**Env vars (M3):** `VALIJA_AUTOLOCK_MINUTES` — idle auto-lock TTL in minutes; unset/empty defaults to 15, `0`/`off` disables it. `VALIJA_STATE_HOME` — device-local state root (device id, per-vault last-seen, last-activity); defaults to `~/.valija-state`, independent of `VALIJA_HOME` so it never lands in a synced folder. There is no `init --cloud <path>` flag — placing a vault in a synced folder needs no special-casing, just point `VALIJA_HOME` at it (see [../docs/sync.md](../docs/sync.md)).

## mcp/server.ts — server name `valija`, stdio

Five tools — `save_context`, `save_handoff` (forces `handoff` type), `get_context`, `search_context`, `list_projects` — plus prompts `/save-context` and `/load-context`. Every input is zod-validated at the boundary. `save_context`'s type enum is `ITEM_TYPES` (the five saveable types) — `imported` is **not** offered, so a model can never create an imported item; import stays CLI-only. On a locked vault, tools return `isError` with the uniform message: *Vault is locked. Ask the user to run "valija unlock" in a terminal.* The MCP client's declared name is captured into each item's `source`.

The tool descriptions are the product's real prompt engineering — see [../docs/SPEC.md](../docs/SPEC.md) §7.

Proof: `src/delivery/mcp/server.test.ts` (real MCP client over in-memory transport), `src/delivery/context-pack-markdown.test.ts`.
