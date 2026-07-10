# valija

> An encrypted vault for your AI context. Save it from one tool, load it in any other.

**valija** is an open source, end-to-end encrypted context vault for developers who use several AI tools. Save distilled context ("we chose SQLCipher, next step is the restore flow") from inside Claude Code, Claude Desktop, Cursor, or any MCP client — and load it later from any other. The vault lives on your machine, encrypted with a passphrase. No cloud, no accounts, no telemetry.

The name comes from *valija diplomática* — a sealed pouch that crosses borders and only its owner may open.

## Status

🚧 **Under construction** — pre-0.1.0. Do not use for anything you can't afford to lose yet.

## How it will work

```
valija init                 # create your encrypted vault (passphrase + recovery kit)
valija unlock               # unlock for this session (key goes to the OS keychain)
valija install claude-code  # wire the MCP server into your AI tool
```

Then, inside any connected AI tool: *"save context: we decided X, next step is Y"* — and tomorrow, in a different tool: *"load context for my-project"*.

## Security model (short version)

- Everything at rest is ciphertext: SQLCipher whole-database encryption, full-text search index included.
- Passphrase → Argon2id → key. Losing the passphrase **and** the recovery kit means the data is gone, by design.
- Any MCP client you connect receives plaintext of the context you ask it to load. Encryption protects data *at rest*.
- No telemetry, no network calls at runtime.

See [docs/SPEC.md](docs/SPEC.md) for the full specification.

## License

[Apache-2.0](LICENSE)
