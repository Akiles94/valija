---
title: Hand off a conversation to another tool
theme: Working with context
---

## Who
An AI tool, when the user wants to continue the current work in another tool or a new session.

## Why
To package "where we are" (goal, what was done, blockers, the exact next step, relevant files) so
the next tool can pick up seamlessly instead of starting from zero.

## Business rules
- A handoff is a context item of type `handoff` in the project.
- Only the **latest** handoff is included in a project's context pack, right after pinned items.
- It follows every rule of a normal save: unlocked vault, project created on the fly, 32 KB cap.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- Bad project name or content ({{err:INVALID_PROJECT_NAME}}, {{err:CONTENT_EMPTY}}, {{err:CONTENT_TOO_LARGE}}).

## Entry points
- CLI: none — handoffs are written by AI tools through MCP
- Desktop: none — the desktop app shows handoffs in the project and the pack preview
- MCP: {{mcp:save_handoff}}

## Steps
1. [User → AI tool] Asks to hand the session off
2. [AI tool → MCP server] Calls `save_handoff` with the project and a structured summary — {{mcp:save_handoff}}
3. [MCP server → SaveContext] Saves it as a `handoff` item, with the tool's name as source — {{SaveContext}}
4. [MCP server → AI tool] Confirms the project and item id
5. [Next AI tool → MCP server] Later loads the project; the latest handoff leads the pack — {{mcp:get_context}}

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:INVALID_PROJECT_NAME}} — the project slug is not valid.
- {{err:CONTENT_EMPTY}} / {{err:CONTENT_TOO_LARGE}} — the summary is empty or over 32 KB.
