# Spec: delivery — CLI, MCP server, composition root

`src/delivery/` sits at the top of the dependency graph: it wires `vault` + `context` + `shared` into runnable entry points. It is not a bounded context.

## container.ts

`buildContainer(options?: { vaultRoot?: string })` (GUI advance) is the single composition root: constructs the infra adapters (`Argon2VaultCrypto`, `OsKeychain`, `FileVaultStore`, `SqliteVaultSessions`, `FileExportReader`, the `parserRegistry`) and injects them into every use case — including `ImportConversations`, wired over an `ImportItems` write path. The CLI keeps calling `buildContainer()`; the desktop app passes `vaultRoot` resolved from its own preferences (D-R(a)), and rebuilds the container after a successful relocation. `resolveVaultPaths(options?.vaultRoot)` — an explicit root still beats `VALIJA_HOME`, which still beats `~/.valija`, unchanged. Both entry points share one container. M3 adds `FileDeviceIdentity` (over `resolveStatePaths()`), `FileVaultFolder`, and a `SessionGuard` built from `parseAutoLockTtl(process.env.VALIJA_AUTOLOCK_MINUTES)` — threaded into `SqliteVaultSessions`, `CreateVault` (to start the idle clock at init), `UnlockVault`, `LockVault`, and `VaultStatus`. `Container` also exposes the already-constructed `folder: VaultFolder` (GUI advance) and `checkVaultUpgrade: CheckVaultUpgrade` (GUI advance, D-J(b)) — `doctor.ts` reads `c.folder` rather than constructing a second `FileVaultFolder`.

## context-pack-markdown.ts

`renderContextPackMarkdown(pack)` turns an assembled `ContextPack` into markdown: the `# Context pack:` header, one `##` per section, and `### type · date · #tags` per item. **Formatting lives here, not in the domain** — the domain orders sections, delivery names and renders them. Shared by `cli/` (`export`) and `mcp/` (`get_context`).

## context-pack-export.ts (GUI advance)

`exportProjectMarkdown(c, project)` and `exportProjectJson(c, project)` — the two compositions `cli/content-commands.ts`'s `exportCommand` used to build privately, lifted out so the desktop app's pack view/export calls the *same* functions rather than a second copy. `exportProjectMarkdown` is `GetContextPack({ budgetTokens: Number.POSITIVE_INFINITY })` + `renderContextPackMarkdown`, unbudgeted — this is what makes "byte-identical to `valija export`" a structural property, checked against the golden fixture in `context-pack-export.test.ts`, rather than a test that can drift as the two call sites evolve independently.

## cli/ — `valija <command>`

| Command | Behavior |
|---|---|
| `init` | Prompt passphrase twice (hidden on a TTY); print recovery kit once; vault starts unlocked. |
| `unlock [--recovery-key <hex>]` | Session control via the keychain. Always calls `UnlockVault` with `upgradeConfirmed: true` (GUI advance, D-J(b)) — the CLI keeps migrating a behind-schema vault silently, byte-identical to before that gate existed. On success, if the lineage classifies as a **fork** (M3, D-B), the vault still unlocks (for inspection) and a `VAULT_FORK_DETECTED` notice prints alongside the vault folder path — no exit-1, so the user isn't stranded from `doctor`, the tool that helps resolve it. |
| `lock` | Drops the key; on a real unlock→lock transition reports the generation and the last writer (as `this device`/`another device` **with a short device-id prefix**, so a three-device fork is tellable). The "single file (vault.db) — safe to switch" reassurance prints **only when no sidecars remain** (refined §6.5); if stray `-wal`/`-shm`/`-journal` files are present it prints a "NOT safely at rest" warning instead, never both. |
| `status` | Session control via the keychain, plus (M3) journal mode + single-file state, lineage generation/last-writer (short device-id prefix) when unlocked, and the auto-lock TTL/idle state. |
| `projects` / `show <p> [--type]` / `search <q> [-p]` | Read views. `show --type imported` lists imported items. |
| `export <p> [--json] [-o file]` | Context pack to stdout/file — the escape hatch for non-MCP tools. md = `GetContextPack` with an infinite budget, rendered; json = `ShowProject` serialized as `{ project, items }`. |
| `import <file> -p <p> [--from] [--list] [--pick] [--query] [--since] [--all] [--dry-run]` | Import chatbot history. **No selection flag → lists conversations and writes nothing** (the safe default); `-p` required for a real import or `--dry-run`. Auto-detects chatgpt/claude unless `--from` is given (`generic` requires it). Prints `Imported N item(s) from M conversation(s) into "<p>" (skipped S, failed F)`. See [importers.md](importers.md). |
| `install <claude-code\|claude-desktop\|cursor>` | Merge the MCP entry into the client config, backing up first; refuses to touch non-object/invalid JSON; prints manual fallback. `installIntoClient(client, vaultPath?)` (GUI advance, D-R(a)'s companion step) — the CLI's own call site never passes `vaultPath`, so the entry it writes has no `env` block and is byte-identical to before; the desktop app always passes one, from both the ordinary connect flow and the relocation wizard's re-pointing step, one shared writer serving both. |
| `mcp` | Run the stdio server (used by tools, not humans). |
| `doctor` | Check node ≥22, sqlcipher load, keychain r/w, vault state, client configs, and (M3) journal/single-file state, cloud-folder recognition with a lock-before-switch reminder, a loud warning on a vendor conflicted-copy file **or a leftover `*.pre-NNN.bak` from a failed upgrade**, lineage generation/last-writer (short device-id prefix), and auto-lock TTL/idle state. The vault status is computed **once** and shared across the four M3 checks (each `execute()` opens the db), not recomputed per check. All four M3 checks are advisory — never fatal, never exit non-zero. |

Errors print `error [CODE]: message` and exit 1 (the fork notice on `unlock` is the one deliberate exception — see above).

**Env vars (M3):** `VALIJA_AUTOLOCK_MINUTES` — idle auto-lock TTL in minutes; unset/empty defaults to 15, `0`/`off` disables it. `VALIJA_STATE_HOME` — device-local state root (device id, per-vault last-seen, last-activity); defaults to `~/.valija-state`, independent of `VALIJA_HOME` so it never lands in a synced folder. There is no `init --cloud <path>` flag — placing a vault in a synced folder needs no special-casing, just point `VALIJA_HOME` at it (see [../docs/sync.md](../docs/sync.md)).

## mcp/server.ts — server name `valija`, stdio

Five tools — `save_context`, `save_handoff` (forces `handoff` type), `get_context`, `search_context`, `list_projects` — plus prompts `/save-context` and `/load-context`. Every input is zod-validated at the boundary. `save_context`'s type enum is `ITEM_TYPES` (the five saveable types) — `imported` is **not** offered, so a model can never create an imported item; import stays CLI-only. On a locked vault, tools return `isError` with the uniform message: *Vault is locked. Ask the user to run "valija unlock" in a terminal.* The MCP client's declared name is captured into each item's `source`.

The tool descriptions are the product's real prompt engineering — see [../docs/SPEC.md](../docs/SPEC.md) §7.

Proof: `src/delivery/mcp/server.test.ts` (real MCP client over in-memory transport), `src/delivery/context-pack-markdown.test.ts`, `src/delivery/context-pack-export.test.ts` (GUI advance; byte-identity against the golden fixture), `src/delivery/cli/installer.test.ts` (GUI advance; `vaultPath` present/absent, `manualInstructions` unaffected), `src/delivery/cli/vault-commands.test.ts` (GUI advance; `unlockCommand` still migrates silently), `src/delivery/cli/render.test.ts` (the `writerLabel` short-id formatter), and `src/delivery/multi-device-sync.test.ts` (two-device handoff/fork, idle-TTL, device-state location).
