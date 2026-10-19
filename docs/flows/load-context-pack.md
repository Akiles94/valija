---
title: Load a project's context pack
theme: Working with context
---

## Who
An AI tool starting or resuming work on a project, or the user previewing what the AI will see.

## Why
To give the AI the right context at the start of a session (pinned notes, the latest handoff,
decisions, preferences, progress, facts) without the user pasting anything.

## Business rules
- The pack is ordered: **pinned** items first, then the **latest handoff**, then decisions,
  preferences, progress and facts, each newest first. No item appears twice.
- It fits a token budget (4,000 by default, estimated at about 4 characters per token). The newest
  pinned item is always kept; older items are cut first.
- Imported conversations are never part of a pack: they are searchable, not auto-loaded.
- The `load-context` prompt asks the AI to load the pack and summarise where things stand.
- The desktop app shows the whole pack, unbudgeted, as a preview.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The project does not exist ({{err:PROJECT_NOT_FOUND}}) or the name is invalid ({{err:INVALID_PROJECT_NAME}}).

## Entry points
- CLI: {{cli:export}} prints the same pack, unbudgeted (see the export flow)
- Desktop: {{ipc:content:pack}} (pack preview)
- MCP: {{mcp:get_context}}, prompt {{prompt:load-context}}

## Steps
1. [User → AI tool] Asks to resume a project — {{prompt:load-context}}
2. [AI tool → MCP server] Calls `get_context` for the project, optionally with a budget — {{mcp:get_context}}
3. [MCP server → GetContextPack] Asks for the pack — {{GetContextPack}}
4. [GetContextPack → VaultSessions] Loads the project's items, newest first — {{SqliteContextItemRepository}}
5. [GetContextPack → GetContextPack] Picks what fits the budget, in pack order — {{assembleContextPack}}
6. [MCP server → AI tool] Returns the pack as Markdown — {{renderContextPackMarkdown}}

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_FOUND}} — there is no project with that name.
- {{err:INVALID_PROJECT_NAME}} — the project slug is not valid.
