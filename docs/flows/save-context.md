---
title: Save context from an AI tool
theme: Working with context
---

## Who
An AI tool (Claude Code, Claude Desktop, Cursor…) acting for the user, usually when the user says
"remember this" or at the end of a working session.

## Why
So that what was learned in one session (a decision and its reason, progress, a preference, a fact)
is available to any other tool, in any later session, on any of the user's machines.

## Business rules
- Context is saved per **project**, identified by a slug such as `demo-project`. A project that does
  not exist yet is created on the fly.
- An item has a type: `decision`, `progress`, `preference`, `fact` (the default) or `handoff`.
  An AI can never save an `imported` item.
- Content is trimmed, must not be empty and is capped at 32 KB: distilled context, not transcripts.
  Up to 10 lowercase tags. Secrets do not belong in context.
- The tool's name is recorded as the item's source.
- Everything is validated before the vault is touched; a valid save advances the vault's lineage
  once, as one transaction.
- The vault must be unlocked; a locked vault refuses with a message telling the user how to unlock.
- The `save-context` prompt lets the user ask the AI to distil the whole session into one save.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- Bad project name, type, tags or content ({{err:INVALID_PROJECT_NAME}}, {{err:INVALID_ITEM_TYPE}},
  {{err:INVALID_TAG}}, {{err:TOO_MANY_TAGS}}, {{err:CONTENT_EMPTY}}, {{err:CONTENT_TOO_LARGE}}).

## Entry points
- CLI: none — saving is done by AI tools through MCP (see the parity table)
- Desktop: none — the desktop app browses context, AI tools save it
- MCP: {{mcp:save_context}}, prompt {{prompt:save-context}}

## Steps
1. [User → AI tool] Asks to save what was decided — {{prompt:save-context}}
2. [AI tool → MCP server] Calls `save_context` with project, content, type and tags — {{mcp:save_context}}
3. [MCP server → SaveContext] Asks to save, with the tool's name as source — {{SaveContext}}
4. [SaveContext → SaveContext] Validates project, type, tags and content before opening the vault — {{parseContent}}
5. [SaveContext → VaultSessions] Opens a session; refuses if the vault is locked — {{SqliteVaultSessions}}
6. [SaveContext → VaultSessions] Finds or creates the project and stores the item in one write — {{createContextItem}}
7. [MCP server → AI tool] Confirms the type, project and item id, and whether the project is new

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:INVALID_PROJECT_NAME}} — the project slug is not valid.
- {{err:INVALID_ITEM_TYPE}} — the type is not one an AI may save.
- {{err:INVALID_TAG}} / {{err:TOO_MANY_TAGS}} — a tag is malformed, or there are too many.
- {{err:CONTENT_EMPTY}} / {{err:CONTENT_TOO_LARGE}} — the content is empty or over 32 KB.
