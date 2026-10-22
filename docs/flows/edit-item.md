---
title: Edit an item
theme: Working with context
---

## Who
The user, correcting or refining something an AI tool saved.

## Why
To fix an item in place — its wording, tags or type — so the vault keeps one accurate item instead
of a wrong one and a correction.

## Business rules
- An item is addressed by its full id or a unique prefix of at least 6 characters.
- Content, tags and type can be changed; each field left out stays as it is, and new tags replace
  the old list (an empty list clears it). The same rules as saving apply: 32 KB, 10 tags, no
  `imported` type.
- The item keeps its id and creation date; its update date is stamped and search is re-indexed.
- Imported and archived items cannot be edited.
- The CLI reads new content from a file or standard input, never an editor; the desktop app edits
  in a dialog and sends only the fields that changed.
- An edit that changes nothing writes nothing.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- No field to change was given ({{err:NOTHING_TO_EDIT}}).
- The id is malformed, matches nothing or matches several items ({{err:INVALID_ITEM_ID}},
  {{err:ITEM_NOT_FOUND}}, {{err:ITEM_ID_AMBIGUOUS}}).
- The item is imported or archived ({{err:ITEM_NOT_CURATABLE}}, {{err:ITEM_ARCHIVED}}).
- The new content, tags or type are not valid ({{err:CONTENT_EMPTY}}, {{err:CONTENT_TOO_LARGE}},
  {{err:INVALID_TAG}}, {{err:TOO_MANY_TAGS}}, {{err:INVALID_ITEM_TYPE}}).

## Entry points
- CLI: {{cli:edit}}
- Desktop: {{ipc:content:edit}} (Edit on each item card opens a dialog)

## Steps
1. [User → CLI] Runs `valija edit 01HZX4 --content-file notes.md --tags api,auth` — {{editCommand}}
2. [CLI → EditItem] Asks to edit the item with the given fields — {{EditItem}}
3. [EditItem → EditItem] Validates the id, content, tags and type before opening the vault — {{parseItemReference}}
4. [EditItem → Item store] Finds the one item the id or prefix names — {{findItemByReference}}
5. [EditItem → EditItem] Applies the edit, refusing imported or archived items — {{applyEdit}}
6. [EditItem → Item store] Saves only when a field actually changed — {{saveIfChanged}}
7. [CLI → User] Prints which fields changed, with the item's id and project

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:NOTHING_TO_EDIT}} — pass at least one of content, tags or type.
- {{err:INVALID_ITEM_ID}} / {{err:ITEM_NOT_FOUND}} / {{err:ITEM_ID_AMBIGUOUS}} — the id does not name exactly one item.
- {{err:ITEM_NOT_CURATABLE}} — imported items cannot be edited.
- {{err:ITEM_ARCHIVED}} — unarchive the item before editing it.
- {{err:CONTENT_EMPTY}} / {{err:CONTENT_TOO_LARGE}} — the new content is empty or over 32 KB.
- {{err:INVALID_TAG}} / {{err:TOO_MANY_TAGS}} — a tag is malformed, or there are too many.
- {{err:INVALID_ITEM_TYPE}} — the type is not one that can be saved.
