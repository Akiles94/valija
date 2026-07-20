# Spec: delivery — CLI, MCP server, composition root

`src/delivery/` sits at the top of the dependency graph: it wires `vault` + `context` + `shared` into runnable entry points. It is not a bounded context.

## container.ts

`buildContainer()` is the single composition root: constructs the infra adapters (`Argon2VaultCrypto`, `OsKeychain`, `FileVaultStore`, `SqliteVaultSessions`, `FileExportReader`, the `parserRegistry`) and injects them into every use case — including `ImportConversations`, wired over an `ImportItems` write path. Both entry points share one container.

## context-pack-markdown.ts

`renderContextPackMarkdown(pack)` turns an assembled `ContextPack` into markdown: the `# Context pack:` header, one `##` per section, and `### type · date · #tags` per item. **Formatting lives here, not in the domain** — the domain orders sections, delivery names and renders them. Shared by `cli/` (`export`) and `mcp/` (`get_context`).

## cli/ — `valija <command>`

| Command | Behavior |
|---|---|
| `init` | Prompt passphrase twice (hidden on a TTY); print recovery kit once; vault starts unlocked. |
| `unlock [--recovery-key <hex>]` / `lock` / `status` | Session control via the keychain. |
| `projects` / `show <p> [--type]` / `search <q> [-p]` | Read views. `show --type imported` lists imported items. |
| `export <p> [--json] [-o file]` | Context pack to stdout/file — the escape hatch for non-MCP tools. md = `GetContextPack` with an infinite budget, rendered; json = `ShowProject` serialized as `{ project, items }`. |
| `import <file> -p <p> [--from] [--list] [--pick] [--query] [--since] [--all] [--dry-run]` | Import chatbot history. **No selection flag → lists conversations and writes nothing** (the safe default); `-p` required for a real import or `--dry-run`. Auto-detects chatgpt/claude unless `--from` is given (`generic` requires it). Prints `Imported N item(s) from M conversation(s) into "<p>" (skipped S, failed F)`. See [importers.md](importers.md). |
| `install <claude-code\|claude-desktop\|cursor>` | Merge the MCP entry into the client config, backing up first; refuses to touch non-object/invalid JSON; prints manual fallback. |
| `mcp` | Run the stdio server (used by tools, not humans). |
| `doctor` | Check node ≥22, sqlcipher load, keychain r/w, vault state, client configs. Non-zero exit on a fatal check. |

Errors print `error [CODE]: message` and exit 1.

## mcp/server.ts — server name `valija`, stdio

Five tools — `save_context`, `save_handoff` (forces `handoff` type), `get_context`, `search_context`, `list_projects` — plus prompts `/save-context` and `/load-context`. Every input is zod-validated at the boundary. `save_context`'s type enum is `ITEM_TYPES` (the five saveable types) — `imported` is **not** offered, so a model can never create an imported item; import stays CLI-only. On a locked vault, tools return `isError` with the uniform message: *Vault is locked. Ask the user to run "valija unlock" in a terminal.* The MCP client's declared name is captured into each item's `source`.

The tool descriptions are the product's real prompt engineering — see [../docs/SPEC.md](../docs/SPEC.md) §7.

Proof: `src/delivery/mcp/server.test.ts` (real MCP client over in-memory transport), `src/delivery/context-pack-markdown.test.ts`.
