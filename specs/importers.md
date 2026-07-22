# Spec: importers — bring existing chatbot history into the vault

Import subdomain (v0.2.0). Ubiquitous language: **conversation, message, role, export, parser, source, chunk, import**. Depends on `shared` and on `context` (it writes items only through context's `ImportItems` use case); it **never** touches `vault` directly.

## User walkthrough — the workflow from the user's perspective

**Why:** a fresh vault is empty; a user's real history lives in ChatGPT/Claude. This feature pulls that history into the encrypted vault so it is searchable next to saved context, with no re-typing.

1. **Get the export** from the provider's official "Export data" (ChatGPT → a `.zip` with `conversations.json`; Claude → a `.zip`/JSON). Other providers: the generic JSON format, or the MCP path below.
2. **List first (safety default).** With no selection flag, `valija import <file> -p <project>` writes nothing — it prints a numbered table (index, date, chunk estimate, title) so the user sees the file's contents before importing.
3. **Select and import** with `--pick 1,3-5`, `--query <text>`, `--since <YYYY-MM-DD>`, or `--all`; `--from` forces a parser; `--dry-run` runs the full pipeline but opens no write session.
4. **Result:** `Imported N item(s) from M conversation(s) into "<project>" (skipped S, failed F)`. Re-running the same file makes no duplicates (deterministic ids).
5. **Afterward:** imported items are **searchable** (`valija search`, MCP `search_context`) and browsable (`valija show <p> --type imported`), but are **excluded from context packs** (`get_context` / `valija export`) by design — a searchable archive pulled on demand, not auto-injected context. `save_context` can never create an imported item.
6. **Escape hatch:** any connected AI can read an arbitrary export and call `save_context` to distill it into real `decision`/`preference`/`fact` items (which *do* enter the pack). Parsers = fast bulk archive; MCP = curated distillation.

## domain/errors.ts

`UNSUPPORTED_SOURCE · MALFORMED_EXPORT · EMPTY_EXPORT · UNREADABLE_FILE · CORRUPT_ARCHIVE · INVALID_SELECTION · NO_CONVERSATIONS_SELECTED · UNSUPPORTED_GENERIC_VERSION`. Importers never redefine context errors — a content/tag violation raised while context persists a chunk surfaces as the existing `contextErr` code.

## domain/entities & values

- **Conversation / Message / Role** (`entities/conversation.ts`) — the normalized IR every parser produces: `Conversation { id, title, createdAt, messages }`, `Message { role, content, createdAt? }`, `Role = user | assistant | system`. No I/O.
- **ImportSource** (`values/import-source.ts`) — `chatgpt | claude | generic`; `parseImportSource` rejects anything else (`UNSUPPORTED_SOURCE`).

## domain/services (pure)

- `chunk-render.ts` — `renderConversationChunks(conversation, source, byteBudget = 28 KB)`: greedily packs messages into markdown bodies on message boundaries, each with a `> Imported from <Source> · "title" · date · part n/m` provenance header. A single message larger than the budget is hard-split at a **codepoint boundary** (UTF-8 never cut). Every emitted chunk independently passes `parseContent` (≤ 32 KB); the 28 KB budget is headroom.
- `selection.ts` — `parsePickSpec("1,3-5", count)` → sorted, unique, 0-based indices (bad token/range → `INVALID_SELECTION`); `selectConversations(convos, filters)` narrows the chronological list — `--pick` resolves against the full printed order first, then `--since` (≥ date) and `--query` (case-insensitive title substring). Empty result → `NO_CONVERSATIONS_SELECTED`.

## application/ports

- `parser.ts` — `ConversationParser { source, detect(doc): boolean, parse(doc): Result<ParsedExport> }`. `detect` recognizes an already-decoded JSON document by structure; whole-document problems return `err`, per-conversation problems go into `ParsedExport.failures` (collected, not fatal).
- `parser-registry.ts` — `ParserRegistry { autodetect, forSource(source) }`, so the use case depends on a port, not the infra registry.
- `export-reader.ts` — `ExportReader.read(path): Result<unknown[]>` (candidate JSON documents).

## application use cases

- **ImportConversations** (importers) — reads the file, resolves a parser (explicit `--from` calls that parser and surfaces its parse error **verbatim**; otherwise the first `autodetect` parser whose `detect` is true wins, else `UNSUPPORTED_SOURCE`; `generic` is never auto-selected), sorts chronologically, resolves the **mode** (no selection flag or `--list` → list; else `--dry-run` → dry-run; else import), selects, chunks, and hands the drafts to `ImportItems`. It never opens a vault session itself.
- **ImportItems** (context) — persists a batch in one session; see [context.md](context.md).

## infra

- `parsers/{chatgpt,claude,generic}-parser.ts` — zod-based; ChatGPT linearizes the `mapping` node tree by `create_time`; Claude maps `sender: human → user`, reads a message's `text` or its typed content blocks; generic parses the versioned envelope. A conversation with no derivable date carries an epoch sentinel that `ImportConversations` replaces with the import instant.
- `parser-registry.ts` — `autodetect = [chatgpt, claude]` (order matters); `forSource` includes `generic`. Adding a provider later is one new file plus one line here.
- `file-export-reader.ts` — reads `.json` directly, or `.json` entries from a `.zip` via fflate **entirely in memory** (no extraction to disk), with per-entry and total decompression-bomb caps; over-cap or inflate failure → `CORRUPT_ARCHIVE`.

## Generic import format (v1)

```json
{
  "valija_import_version": 1,
  "conversations": [
    { "id": "…", "title": "optional", "createdAt": "ISO-8601",
      "messages": [ { "role": "user|assistant|system", "content": "…", "createdAt": "optional ISO" } ] }
  ]
}
```

An unknown `valija_import_version` is rejected with `UNSUPPORTED_GENERIC_VERSION`, never mis-parsed.

## Security

Imported items are persisted only through context → `VaultSessions` → SQLCipher; no plaintext sidecar, no temp files (zip inflated in memory). A locked vault returns `VAULT_LOCKED`. No new MCP tool or argument is added. Imported transcripts may contain prompt-injection-flavoured text; blast radius is bounded because imported items are **excluded from context packs** (they never auto-load via `get_context`) and appear only as explicit search hits — M2 stores them verbatim and does not attempt sanitization.

Proof: `chunk-render.test.ts`, `selection.test.ts`, `import-source.test.ts`, `parsers/*-parser.test.ts` (+ fixtures), `file-export-reader.test.ts`, `import-conversations.use-case.test.ts`, and context's `import-items.use-case.test.ts` + `migrations/002-imported-type.test.ts`.
