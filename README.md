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

## Updating

```
npm install -g valija@latest    # or: npm update -g valija
```

That's it — there's no separate migration step to run by hand. The next time any `valija` command
opens your vault, it checks the schema version and upgrades in place automatically if it's behind,
always taking a ciphertext backup (`vault.db.pre-NNN.bak`) first and removing it only once the
upgrade succeeds. Your passphrase, recovery kit, and existing projects/context are unaffected.

If you're only using valija on one machine, updating is the whole story — nothing else changes.
**New in 0.3.0:** if you'd like to start using the same vault on more than one device, see
[Use it on several devices](#use-it-on-several-devices) below; it's opt-in and requires no change to
an existing single-machine setup. Check [CHANGELOG.md](CHANGELOG.md) for what's new in each release.

## Everyday use

Saving and loading happen **inside your AI tool** through the MCP server — you just ask it to save or
load context in plain language. The CLI is for everything around that: session control, reading your
own data, and housekeeping.

```
valija status                     # where the vault is, lock state, sync/idle info
valija unlock                     # unlock for this session (asks for your passphrase)
valija lock                       # lock again (drops the key from the OS keychain)
valija projects                   # list projects with item counts and last activity
valija show my-project            # print a project's items (--type to filter; omit the name inside a linked folder)
valija search "auth"              # full-text search (-p to scope to one project)
valija export my-project          # print the context pack (paste into any non-MCP tool)
valija link my-project            # link this folder's git repository to a project (once)
valija which                      # which project this folder resolves to, and why
valija pin <id>                   # keep an item at the top of every pack (unpin to undo)
valija archive <id>               # hide an outdated item from packs and search (unarchive to undo)
valija edit <id> --content-file - # rewrite an item in place, reading the new text from stdin
valija doctor                     # health check: node, keychain, vault, sync, client configs
```

Useful flags:

- `valija unlock --recovery-key <hex>` — unlock using the raw key from your recovery kit when you've
  lost the passphrase. This is the one moment the kit exists for.
- `valija show <project> --type <decision|progress|preference|fact|handoff|imported>` — filter items.
- `valija search <query> -p <project>` — restrict the search to one project.
- `valija export <project> --json` / `-o <file>` — export as JSON, or write to a file instead of stdout.

### Working inside a project folder

Link a folder once and valija knows which project you mean there, so `valija show` and
`valija export` work without a project name.

```
$ cd ~/code/valija
$ valija which
No project detected here.
Hint: a project named "valija" matches this repository's name. Link it with: valija link valija

$ valija link valija
Linked repository github.com/oscar/valija → project "valija".
(Any clone of this repository, on any device that syncs this vault, now resolves to "valija".)

$ valija which
valija  (linked repository github.com/oscar/valija)
```

- **Repository or folder.** Inside a git repository with a remote, `link` links the *repository*
  (its normalized remote, credentials stripped), so every clone of it resolves, on every device that
  syncs this vault. `--by folder` links only that folder (and everything under it). Outside a
  repository, a folder link is the only kind. The project must already exist: linking never creates one.
- **Monorepos.** A folder link on a sub-folder beats the repository link, so
  `cd ~/code/acme/services/billing && valija link acme-billing --by folder` routes that sub-folder
  to its own project while the rest of the repo keeps the repository's.
- **See and undo.** `valija links [project]` lists links with their ids; `valija unlink <id>`
  removes one, or `valija unlink` (with `--dir`/`--by` if needed) removes the one this folder resolves
  through. `--dir <path>` works on `which`, `link` and `unlink` instead of the current folder.
- **A project name you type always wins.** Detection only fills in an omitted name, and only from
  links you made — never from a folder's name, which can at most produce a hint. `valija search`
  without `-p` stays vault-wide, and `valija import` still needs `-p`.
- **`VALIJA_PROJECT`** names the project to use whenever one is omitted, ahead of any link — handy
  in a shell profile or a per-project env file.
- Links (folder paths, remotes) live only inside the encrypted vault, never in `~/.valija-state` or
  any log, and detection only reads `.git` files — it never runs `git` or touches the network.

### Curating your context

Packs are only as good as what's in them, so keep them current. `valija show <project>` prints every
item's id; any command below takes that id or a unique prefix of at least 6 characters.

- `valija pin <id>` / `unpin <id>` — pinned items always lead the pack.
- `valija archive <id>` — the item is **hidden from packs and search, not deleted**. See archived items
  with `valija show <project> --archived`, and bring one back with `valija unarchive <id>`.
- `valija edit <id> [--content-file <file|->] [--tags a,b] [--type <type>]` — edit in place. The new
  text comes from a file or stdin (`-`); valija never opens an editor or writes a temp file, because
  either would leave your plaintext outside the vault. `--tags ""` clears the tags.

Imported items can only be archived or unarchived — and a re-import keeps them archived.

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

- `save_context` takes an optional `supersedes`: the id of one outdated item in the same project
  (a reversed decision, stale progress), which is archived in the same step. `search_context` shows
  each item's id so the AI can find it. It can't touch pinned or imported items, and it fails
  without saving anything if the id doesn't fit.
- Archived items never reach your AI tools: not in packs, not in search.
- **Project detection.** `save_context`, `save_handoff` and `get_context` no longer need a `project`:
  in a folder or repository you linked (see *Working inside a project folder*), the AI can just say
  "load my context" and gets that project. A save then replies e.g.
  `Saved decision to project "valija" (detected: linked repository).` — the project and the kind of
  link only, never a path or a remote. `list_projects` marks that project `(this workspace)`. If
  nothing is linked, the call fails with `PROJECT_NOT_DETECTED` and the AI is told to list your
  projects and ask you. A project the AI names always wins, and `search_context` without a project
  still searches everything.
- **Where the server learns your workspace.** From the folders the client reports (MCP *roots*), or
  else from the folder the client starts the server in — ignored when that is clearly not a project
  (`/`, your home folder, an app's install folder). What each client does is **not yet confirmed**;
  the current assumptions ([spike](advances/PROJECT-DETECT/spike.md)): Claude Code is expected to
  report the project you started `claude` in; Claude Desktop is expected to report no workspace at
  all; Cursor is expected to report its open folders in recent versions.
- **Per-project override.** Where a client reports no workspace, set `VALIJA_PROJECT` in a
  per-project client config — it wins over any link:

  ```jsonc
  // .mcp.json (Claude Code) or .cursor/mcp.json (Cursor), in the project folder
  { "mcpServers": { "valija": { "command": "npx", "args": ["-y", "valija", "mcp"],
      "env": { "VALIJA_PROJECT": "valija" } } } }
  ```

## Configuration reference

| Variable | Default | What it does |
|---|---|---|
| `VALIJA_HOME` | `~/.valija` | Vault folder (`vault.db` + `vault.json`). Point it at a synced folder to sync. |
| `VALIJA_AUTOLOCK_MINUTES` | `15` | Idle auto-lock timeout in minutes; `0` or `off` disables it. |
| `VALIJA_STATE_HOME` | `~/.valija-state` | Device-local state (device id, sync bookkeeping, idle timer). Never synced. |
| `VALIJA_PROJECT` | unset | The project to use whenever a command omits one, ahead of any linked folder or repository. Must be a valid project slug. |

## Desktop app

A companion window for people who'd rather not live in a terminal: browse and search your vault,
connect Claude Code/Claude Desktop/Cursor with one click, import chat history, and move your vault
into a synced folder safely. Same encrypted vault, same MCP server — the app adds a window, it
doesn't replace the CLI. See **[docs/gui.md](docs/gui.md)** for installing it and what each screen
does.

## Security model (short version)

- Everything at rest is ciphertext: SQLCipher whole-database encryption, full-text search index
  included. The only plaintext file is `vault.json` (salt + KDF params + vault id) — no context, and
  no sync/device metadata, ever.
- Passphrase → Argon2id → key. Losing the passphrase **and** the recovery kit means the data is gone,
  by design.
- Any MCP client you connect receives plaintext of the context you ask it to load. Encryption
  protects data *at rest*.
- No telemetry, no network calls at runtime, no daemon.
- Project detection trusts a folder's own `.git` files. A downloaded archive that ships its own
  `.git/config` can claim a remote you already linked, and an AI tool working there would load that
  project's context. Pass `project` explicitly (or don't connect an AI tool) in folders you didn't
  clone yourself.

## Docs

- **[docs/guide/](docs/guide/README.md)** — developer guide: how Valija works, business flows and code map (generated).
- **[docs/gui.md](docs/gui.md)** — the desktop app: installing it, and what each screen does.
- **[docs/sync.md](docs/sync.md)** — using one vault across devices, in depth.
- **[docs/SPEC.md](docs/SPEC.md)** — the full specification.

## License

[Apache-2.0](LICENSE)
