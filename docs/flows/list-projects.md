---
title: List projects
theme: Working with context
---

## Who
The user, or an AI tool that needs to know which project the user means before saving or loading.

## Why
To see what the vault holds at a glance: every project, how many items it has, and when it was
last active.

## Business rules
- Every project is listed with its item count (archived items excluded) and last activity date.
- Listing only reads; it never changes the vault.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).

## Entry points
- CLI: {{cli:projects}}
- Desktop: {{ipc:content:projects}} (the dashboard)
- MCP: {{mcp:list_projects}}

## Steps
1. [User → CLI] Runs `valija projects` — {{projectsCommand}}
2. [CLI → ListProjects] Asks for the project list — {{ListProjects}}
3. [ListProjects → Project store] Reads projects with item counts and last activity — {{SqliteProjectRepository}}
4. [CLI → User] Prints one line per project

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
