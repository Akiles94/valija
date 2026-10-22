---
title: Import chat history
theme: Bringing history in
---

## Who
A user whose real history lives in ChatGPT or Claude.ai and who wants it next to their saved
context, without retyping anything.

## Why
A fresh vault is empty. Importing the official data export turns past conversations into a
searchable archive inside the encrypted vault.

## Business rules
- Supported sources: ChatGPT and Claude.ai data exports (`.zip` or `.json`), and Valija's own
  versioned generic format for anything else. The format is detected from the content, or forced.
- **List first:** without a selection, nothing is written; the user sees a numbered list of
  conversations (date, size, estimated items, title) and then picks.
- Selection: all, by index (`1,3-5`), by title text, or since a date. A dry run goes through the
  whole pipeline and writes nothing.
- Each conversation becomes one or more `imported` items of at most 28 KB, each headed by where it
  came from (source, title, date, part n of m). Original dates are kept.
- Re-importing the same export into the same project creates no duplicates.
- Imported items are **searchable and browsable, but never part of a context pack**: an archive
  pulled on demand, not context pushed into every session.
- One bad conversation is reported and skipped; it never aborts the import. The whole import is one
  write to the vault.
- **Secrets block the import, all or nothing:** if any selected chunk looks like it contains a
  secret, nothing is imported and each blocking chunk is listed (conversation number, title, part,
  kind and line, never the secret). A dry run shows the same list. The user can leave those
  conversations out, or import anyway (`--allow-secrets`, **Import anyway** in the desktop app).
- Zip files are read in memory with caps that stop decompression bombs; nothing is extracted to disk.
- In the desktop app the file is chosen in a native dialog and passed as an opaque handle.

## What can go wrong
- The file cannot be read ({{err:UNREADABLE_FILE}}) or the archive is damaged or oversized ({{err:CORRUPT_ARCHIVE}}).
- The format is not recognised ({{err:UNSUPPORTED_SOURCE}}), the file is not a valid export
  ({{err:MALFORMED_EXPORT}}), it is empty ({{err:EMPTY_EXPORT}}), or the generic format has an
  unknown version ({{err:UNSUPPORTED_GENERIC_VERSION}}).
- The selection is invalid ({{err:INVALID_SELECTION}}) or matches nothing ({{err:NO_CONVERSATIONS_SELECTED}}).
- The vault is locked ({{err:VAULT_LOCKED}}).
- Some selected chunks look like they contain secrets ({{err:POSSIBLE_SECRET}}).

## Entry points
- CLI: {{cli:import}} (`--list`, `--pick`, `--query`, `--since`, `--all`, `--dry-run`, `--from`)
- Desktop: {{ipc:dialog:chooseImportFile}}, {{ipc:import:list}}, {{ipc:import:preview}}, {{ipc:import:run}}

## Steps
1. [User → CLI] Runs `valija import export.zip -p demo-project` to list conversations — {{importCommand}}
2. [CLI → ImportConversations] Asks to list, preview or import — {{ImportConversations}}
3. [ImportConversations → ExportReader] Reads the JSON documents, from a zip in memory if needed — {{FileExportReader}}
4. [ImportConversations → Parser] Detects the format and normalises conversations — {{ChatgptParser}}
5. [ImportConversations → ImportConversations] Selects conversations and renders them into chunks — {{renderConversationChunks}}
6. [ImportConversations → ImportItems] Stores every chunk in one write, creating the project if needed — {{ImportItems}}
7. [ImportItems → Item store] Upserts each item under a deterministic id, so re-runs do not duplicate — {{createImportedContextItem}}
8. [CLI → User] Reports imported, skipped and failed conversations

## Errors
- {{err:UNREADABLE_FILE}} — the file could not be read.
- {{err:CORRUPT_ARCHIVE}} — the zip is damaged or exceeds the decompression caps.
- {{err:UNSUPPORTED_SOURCE}} — the format could not be detected; force it with `--from`.
- {{err:MALFORMED_EXPORT}} — the file is not a valid export of that format.
- {{err:EMPTY_EXPORT}} — the export holds no conversations.
- {{err:UNSUPPORTED_GENERIC_VERSION}} — the generic envelope's version is unknown.
- {{err:INVALID_SELECTION}} — the pick, query or date is malformed.
- {{err:NO_CONVERSATIONS_SELECTED}} — nothing matches the selection.
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:POSSIBLE_SECRET}} — leave the listed conversations out, or import anyway with `--allow-secrets`.
