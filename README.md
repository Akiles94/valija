# valija

> An encrypted vault for your AI context. Save it from one tool, load it in any other — on any of your machines.

**valija** is an open source, end-to-end encrypted context vault for developers who use several AI
tools. Save distilled context ("we chose SQLCipher, next step is the restore flow") from inside
Claude Code, Claude Desktop, Cursor, or any MCP client — and load it later from any other. The vault
lives on your machine, encrypted with a passphrase. No cloud service, no accounts, no telemetry. If
you want it on more than one machine, you point it at a folder your own sync client already
replicates — valija never talks to a server of its own.

The name comes from *valija diplomática* — a sealed pouch that crosses borders and only its owner
may open.

## Status

**Young but working.** The vault format migrates forward in place, never breaks: schema **v1 → v3**
upgrades run automatically on first open, always after taking a ciphertext backup. The newest
capability is **bring-your-own-cloud sync** — using one vault across several devices (see
[Use it on several devices](#use-it-on-several-devices)).

## Quickstart (5 minutes)

```
npm install -g valija
valija init                 # create your encrypted vault (passphrase + recovery kit)
valija install claude-code  # wire the MCP server in (also: claude-desktop, cursor)
```

`init` prints a **recovery kit once** — copy it somewhere safe offline before you close the
terminal. Your vault starts **unlocked**. Restart your AI tool, then, inside it:
*"save context: we decided X, next step is Y"* — and tomorrow, in a different tool:
*"load context for my-project"*.

## Everyday use

Saving and loading happen **inside your AI tool** through the MCP server — you just ask it to save or
load context in plain language. The CLI is for everything around that: session control, reading your
own data, and housekeeping.

```
valija status                     # where the vault is, lock state, sync/idle info
valija unlock                     # unlock for this session (asks for your passphrase)
valija lock                       # lock again (drops the key from the OS keychain)
valija projects                   # list projects with item counts and last activity
valija show my-project            # print a project's items (--type to filter)
valija search "auth"              # full-text search (-p to scope to one project)
valija export my-project          # print the context pack (paste into any non-MCP tool)
valija doctor                     # health check: node, keychain, vault, sync, client configs
```

Useful flags:

- `valija unlock --recovery-key <hex>` — unlock using the raw key from your recovery kit when you've
  lost the passphrase. This is the one moment the kit exists for.
- `valija show <project> --type <decision|progress|preference|fact|handoff|imported>` — filter items.
- `valija search <query> -p <project>` — restrict the search to one project.
- `valija export <project> --json` / `-o <file>` — export as JSON, or write to a file instead of stdout.

## Locking, unlocking, and idle auto-lock

valija has **no daemon**. Unlocking puts the vault key in your OS keychain (Windows Credential
Manager, macOS Keychain, Linux Secret Service); MCP tools work only while the vault is unlocked, and
locking removes the key.

**Idle auto-lock:** an unlocked vault re-locks itself after **15 minutes of inactivity** — the key is
dropped the next time any command runs after the timer elapses (there's no background timer, so it's
the *next* command that notices). If your AI tool suddenly reports the vault is locked, this is why —
just `valija unlock` again. Change or disable it:

```
export VALIJA_AUTOLOCK_MINUTES=30    # change the timeout (minutes)
export VALIJA_AUTOLOCK_MINUTES=off   # disable it (0 also works)
```

`valija status` shows the effective TTL and how long the vault has been idle.

## Where your vault lives

By default the vault is a single encrypted file at `~/.valija/vault.db`, with its plaintext header
`vault.json` beside it. Point `VALIJA_HOME` somewhere else to move it:

```
export VALIJA_HOME="$HOME/.valija"   # default; set it to any folder you like
```

Device-local bookkeeping (this machine's id, per-vault sync state, the idle timer) lives **separately**
under `VALIJA_STATE_HOME` (default `~/.valija-state`), by design outside `VALIJA_HOME` so it never
lands in a synced folder.

## Use it on several devices

valija has no backend. To use one vault on a laptop and a desktop, put it in a folder a sync client
you already trust replicates — **Dropbox, iCloud Drive, OneDrive, Google Drive, Syncthing** — and
point `VALIJA_HOME` at it. valija only ever touches the local filesystem; the sync client is a black
box to it.

```
export VALIJA_HOME="$HOME/Dropbox/valija"   # once per device, same synced path
valija init                                  # (or move an existing vault there)
```

The passphrase, salt, and KDF params live in the plaintext `vault.json` header, which syncs alongside
`vault.db` — so the **same passphrase unlocks the vault on every device**. The ritual is just *lock,
let it sync, unlock elsewhere*:

```
# on device A, when you're done
valija lock            # confirms the vault is a single file at rest, safe to sync

# …wait for your sync client to show "up to date"…

# on device B
valija unlock          # a clean handoff adopts silently; you continue where A left off
```

**If you skip the ritual and edit two devices before they sync,** your sync client keeps one copy and
usually drops the other as a "conflicted copy" file. valija detects this — `unlock` still opens the
vault but prints a `VAULT_FORK_DETECTED` warning, and **deletes nothing**. There is no automatic
merge, ever, by design. `valija doctor` helps you find and resolve the conflicted copy.

See **[docs/sync.md](docs/sync.md)** for the full walkthrough: the handoff ritual, resolving a fork,
OneDrive's naming quirk, and what sync data is (and isn't).

## Import your history

A fresh vault is empty — but your history already lives in ChatGPT and Claude. Import it:

```
valija import chatgpt-export.zip -p my-history           # lists conversations, writes nothing
valija import chatgpt-export.zip -p my-history --all      # import all of them
valija import claude.zip -p work --query "postgres"       # or pick by title / date / index
valija import export.json -p misc --from generic --all    # any other provider (see below)
```

Get the export from the provider's **Export data** (ChatGPT → a `.zip` containing `conversations.json`;
Claude → a `.zip`/JSON). valija auto-detects the source, or pass `--from chatgpt|claude|generic`. With
no selection flag it **lists** conversations so you can look before importing; select with
`--pick 1,3-5`, `--query`, `--since <YYYY-MM-DD>`, or `--all`, and add `--dry-run` to preview. `.zip`
files are read entirely in memory — nothing is extracted to disk.

Imported conversations are **searchable** (`valija search`, `valija show <project> --type imported`)
but stay **out of context packs** — they're a searchable archive, not context that auto-loads into
your AI tools.

**Any other provider — two doors:**

- **Generic JSON** — hand any exporter this shape and import it with `--from generic`:
  ```json
  { "valija_import_version": 1,
    "conversations": [
      { "id": "abc", "title": "optional", "createdAt": "2024-05-01T09:00:00Z",
        "messages": [ { "role": "user", "content": "…" }, { "role": "assistant", "content": "…" } ] } ] }
  ```
- **Via a connected AI (no parser needed)** — because valija is an MCP server, you can hand any AI
  tool an arbitrary export and ask it to distill the important parts into `save_context`. Those become
  real, pack-eligible context (decisions, preferences, facts).

## The MCP surface (what your AI tools see)

Five tools — `save_context`, `save_handoff`, `get_context`, `search_context`, `list_projects` — plus
`/save-context` and `/load-context` prompts in clients that support them. Wire it into a client with
`valija install <claude-code|claude-desktop|cursor>` (it backs up the existing config first and prints
a manual fallback if it can't). No sync, lineage, or device data is ever exposed through an MCP tool —
that's CLI-only plumbing.

## Configuration reference

| Variable | Default | What it does |
|---|---|---|
| `VALIJA_HOME` | `~/.valija` | Vault folder (`vault.db` + `vault.json`). Point it at a synced folder to sync. |
| `VALIJA_AUTOLOCK_MINUTES` | `15` | Idle auto-lock timeout in minutes; `0` or `off` disables it. |
| `VALIJA_STATE_HOME` | `~/.valija-state` | Device-local state (device id, sync bookkeeping, idle timer). Never synced. |

## Security model (short version)

- Everything at rest is ciphertext: SQLCipher whole-database encryption, full-text search index
  included. The only plaintext file is `vault.json` (salt + KDF params + vault id) — no context, and
  no sync/device metadata, ever.
- Passphrase → Argon2id → key. Losing the passphrase **and** the recovery kit means the data is gone,
  by design.
- Any MCP client you connect receives plaintext of the context you ask it to load. Encryption
  protects data *at rest*.
- No telemetry, no network calls at runtime, no daemon.

## Docs

- **[docs/sync.md](docs/sync.md)** — using one vault across devices, in depth.
- **[docs/SPEC.md](docs/SPEC.md)** — the full specification.

## License

[Apache-2.0](LICENSE)
