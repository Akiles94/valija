---
title: Search saved context
theme: Working with context
---

## Who
The user or an AI tool with a specific recall question, such as "what did we decide about auth?".

## Why
To find a piece of context by its words, across every project or within one, including imported
conversations that never appear in a context pack.

## Business rules
- Full-text search over item content and tags; every word must match.
- Search across all projects, or within one existing project.
- At most 100 results (20 by default), best match first.
- An empty query returns nothing instead of an error; special characters never break the search.
- Searching only reads; it never changes the vault.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The project given as scope does not exist ({{err:PROJECT_NOT_FOUND}}).

## Entry points
- CLI: {{cli:search}} (`--project`)
- Desktop: {{ipc:content:search}}
- MCP: {{mcp:search_context}}

## Steps
1. [User → CLI] Runs `valija search "auth decision"` — {{searchCommand}}
2. [CLI → SearchContext] Asks to search, optionally within a project — {{SearchContext}}
3. [SearchContext → VaultSessions] Checks the project scope exists, when one is given
4. [SearchContext → Item store] Runs the full-text query, best match first — {{SqliteContextItemRepository}}
5. [CLI → User] Prints each hit with its project, type and date

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_FOUND}} — the project given as scope does not exist.
