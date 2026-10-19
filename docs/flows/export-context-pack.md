---
title: Export a project
theme: Working with context
---

## Who
The user, wanting a project's context outside Valija: to read it, share it, paste it into a tool
without MCP, or keep a copy.

## Why
Context in Valija is never locked in. A project can always be taken out as readable Markdown or as
structured JSON.

## Business rules
- Markdown export is the project's whole context pack, without a token budget.
- JSON export lists every item of the project (including imported ones), with all its fields.
- The terminal prints to the screen or writes to a file (`--output`); the desktop app saves to a
  file chosen in a native dialog, or copies the pack to the clipboard.
- Exporting only reads; it never changes the vault.

## What can go wrong
- The vault is locked ({{err:VAULT_LOCKED}}).
- The project does not exist ({{err:PROJECT_NOT_FOUND}}).
- The user cancels the save dialog in the desktop app; nothing is written.

## Entry points
- CLI: {{cli:export}} (`--json`, `--output`)
- Desktop: {{ipc:content:export}}, {{ipc:content:copy}}

## Steps
1. [User → CLI] Runs `valija export demo-project` — {{exportCommand}}
2. [CLI → GetContextPack] For Markdown, asks for the whole pack, unbudgeted — {{exportProjectMarkdown}}
3. [CLI → ShowProject] For JSON, asks for every item of the project instead — {{exportProjectJson}}
4. [CLI → User] Prints the result, or writes it to the file given with `--output`
5. [User → Desktop app] Alternatively saves to a chosen file or copies to the clipboard — {{ipc:content:export}}

## Errors
- {{err:VAULT_LOCKED}} — unlock the vault first.
- {{err:PROJECT_NOT_FOUND}} — there is no project with that name.
