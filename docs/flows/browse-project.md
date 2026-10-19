---
title: Browse a project
theme: Working with context
---

## Who
The user, wanting to read what has been saved in one project.

## Why
To review the project's memory item by item: what the AI tools saved, and the imported
conversations, newest first.

## Business rules
- Items are listed newest first; archived items are not shown.
- The list can be filtered by type, including `imported`.
- The desktop app shows pinned items first, then the rest in their original order, and collapses
  long items behind a "show more" toggle.
- Browsing only reads; it never changes the vault.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The project does not exist ({{err:PROJECT_NOT_FOUND}}).
- The type filter is not a known type ({{err:INVALID_ITEM_TYPE}}).

## Entry points
- CLI: {{cli:show}} (`--type`)
- Desktop: {{ipc:content:show}} (the project screen)

## Steps
1. [User → CLI] Runs `valija show demo-project --type decision` — {{showCommand}}
2. [CLI → ShowProject] Asks for the project's items, optionally of one type — {{ShowProject}}
3. [ShowProject → ShowProject] Validates the project name and the type filter — {{parseStorableItemType}}
4. [ShowProject → Item store] Reads the items, newest first — {{SqliteContextItemRepository}}
5. [CLI → User] Prints each item with its type, date and tags

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_FOUND}} — there is no project with that name.
- {{err:INVALID_ITEM_TYPE}} — the type filter is not a known type.
