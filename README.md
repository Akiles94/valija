# valija

> An encrypted vault for your AI context. Save it from one tool, load it in any other.

**valija** is an open source, end-to-end encrypted context vault for developers who use several AI tools. Save distilled context ("we chose SQLCipher, next step is the restore flow") from inside Claude Code, Claude Desktop, Cursor, or any MCP client — and load it later from any other. The vault lives on your machine, encrypted with a passphrase. No cloud, no accounts, no telemetry.

The name comes from *valija diplomática* — a sealed pouch that crosses borders and only its owner may open.

## Status

**0.1.0** — young but working. The vault format (schema v1) will be migrated forward, not broken.

## Quickstart (5 minutes)

```
npm install -g valija
valija init                 # create your encrypted vault (passphrase + recovery kit)
valija install claude-code  # wire the MCP server in (also: claude-desktop, cursor)
```

Restart your AI tool. Then, inside it: *"save context: we decided X, next step is Y"* — and tomorrow, in a different tool: *"load context for my-project"*.

Day-to-day:

```
valija unlock | lock        # session control — MCP tools only work while unlocked
valija status               # where the vault is, locked or not
valija projects             # what's inside
valija search "auth"        # full-text search from the terminal
valija export my-project    # print the context pack (paste it into any non-MCP tool)
valija doctor               # checks node, keychain, vault, client configs
```

### The MCP surface (what your AI tools see)

Five tools: `save_context`, `save_handoff`, `get_context`, `search_context`, `list_projects` — plus `/save-context` and `/load-context` prompts in clients that support them.

## Security model (short version)

- Everything at rest is ciphertext: SQLCipher whole-database encryption, full-text search index included.
- Passphrase → Argon2id → key. Losing the passphrase **and** the recovery kit means the data is gone, by design.
- Any MCP client you connect receives plaintext of the context you ask it to load. Encryption protects data *at rest*.
- No telemetry, no network calls at runtime.

See [docs/SPEC.md](docs/SPEC.md) for the full specification.

## License

[Apache-2.0](LICENSE)
