---
title: Pin or archive an item
theme: Working with context
---

## Who
The user, tidying a project's memory: keeping what matters on top and retiring what is out of date.

## Why
So the context pack an AI tool loads leads with what the user says matters and leaves out what no
longer holds, without deleting anything.

## Business rules
- An item is addressed by its full id or by a unique prefix of at least 6 characters (the CLI prints
  ids in `valija show`; the desktop app acts on the card itself).
- A pinned item always leads its project's context pack. Imported and archived items cannot be
  pinned.
- Archiving is a soft, reversible removal: the item leaves packs, search and counts but stays in
  the vault, and `unarchive` brings it back. Any item can be archived, imported ones included.
- Pinning an already pinned item, or archiving an already archived one, changes nothing and writes
  nothing.
- AI tools cannot pin or archive through MCP; the only archive a model can cause is a `supersedes`
  on save, which never touches pinned items.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The id is malformed or too short, matches nothing, or matches several items
  ({{err:INVALID_ITEM_ID}}, {{err:ITEM_NOT_FOUND}}, {{err:ITEM_ID_AMBIGUOUS}}).
- The item cannot be pinned because it is imported or archived ({{err:ITEM_NOT_CURATABLE}},
  {{err:ITEM_ARCHIVED}}).

## Entry points
- CLI: {{cli:pin}}, {{cli:unpin}}, {{cli:archive}}, {{cli:unarchive}}
- Desktop: {{ipc:content:setPinned}}, {{ipc:content:setArchived}} (Pin, Archive and Undo on each
  item card; **Show archived** lists archived items with Unarchive)

## Steps
1. [User → CLI] Runs `valija pin 01HZX4` or `valija archive 01HZX4` — {{pinCommand}}
2. [CLI → SetItemPinned] Asks to pin or unpin the item — {{SetItemPinned}}
3. [CLI → SetItemArchived] Or asks to archive or unarchive it — {{SetItemArchived}}
4. [SetItemPinned → SetItemPinned] Validates the id or prefix before opening the vault — {{parseItemReference}}
5. [SetItemPinned → Item store] Finds the one item the id or prefix names, archived ones included — {{findItemByReference}}
6. [SetItemPinned → SetItemPinned] Applies the change, refusing imported or archived items for a pin — {{setPinned}}
7. [SetItemPinned → Item store] Saves only when the state changed — {{saveIfChanged}}
8. [CLI → User] Prints what changed (or that it already was so), with the item's id and project

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:INVALID_ITEM_ID}} — the id is malformed, or a prefix is shorter than 6 characters.
- {{err:ITEM_NOT_FOUND}} — no item has that id or prefix.
- {{err:ITEM_ID_AMBIGUOUS}} — the prefix matches several items; type more of the id.
- {{err:ITEM_NOT_CURATABLE}} — imported items can only be archived or unarchived.
- {{err:ITEM_ARCHIVED}} — unarchive the item before pinning it.
