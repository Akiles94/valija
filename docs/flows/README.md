# Flow sources

**Readers: go to [`docs/guide/`](../guide/README.md).** This folder holds the hand-written sources
the guide is generated from; `npm run docs` turns them into `docs/guide/flows/*.md`, and
`npm run docs:check` (run in CI) fails when a source and the code disagree.

- `_overview.md` — the product summary at the top of the guide.
- `<slug>.md` — one business flow per file.

## Writing a flow

```markdown
---
title: Unlock the vault
theme: Vault lifecycle
---

## Who
Plain language: who does this.

## Why
Plain language: what it is for. The first sentence is shown on the guide index.

## Business rules
- What always holds, in business terms.

## What can go wrong
- What the user can run into, and what happens then.

## Entry points
- CLI: {{cli:unlock}}
- Desktop: {{ipc:vault:unlock}} (or why there is none)

## Steps
1. [User → CLI] Types the passphrase — {{cli:unlock}}
2. [CLI → UnlockVault] Asks to unlock — {{UnlockVault}}

## Errors
- {{err:WRONG_PASSPHRASE}} — the passphrase does not open the vault.
```

All seven sections are required. Each step reads `N. [From → To] text`, numbered from 1; the
sequence diagram is drawn from the steps, so a step's `From`/`To` are the diagram's participants.

## References

| Write | Points at | Fails when |
|---|---|---|
| `{{UnlockVault}}` | an exported code symbol | it is renamed or deleted |
| `{{vault/UnlockVault}}` | the same, when the name is exported from several files | still ambiguous |
| `{{cli:unlock}}` | a CLI command | the command is renamed |
| `{{mcp:save_context}}` | an MCP tool | the tool is renamed |
| `{{prompt:load-context}}` | an MCP prompt | the prompt is renamed |
| `{{ipc:vault:unlock}}` | a desktop IPC channel | the channel is renamed |
| `{{err:VAULT_LOCKED}}` | an error code | the code is removed |

Every use case, CLI command, MCP tool, MCP prompt and IPC channel must be cited by at least one
flow; a new one fails `docs:check` until a flow mentions it.
