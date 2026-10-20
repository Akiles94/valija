# Flow: context-pack
Summary: MCP `get_context` / `valija export` / desktop `content:pack` → `GetContextPack` → budgeted section assembly → Markdown pack
Trigger: `src/delivery/mcp/server.ts:buildMcpServer()` (`get_context` tool, optional `budget`); `src/delivery/cli/content-commands.ts:exportCommand()`; `desktop/src/main/ipc/handlers/content-handlers.ts:createContentHandlers()` (`content:pack`, `content:export`)
Path:
1. MCP passes `budgetTokens` only when given (default `DEFAULT_BUDGET_TOKENS` = 4000). CLI and desktop go through `src/delivery/context-pack-export.ts:exportProjectMarkdown()` with `budgetTokens: Infinity`: one shared function, so CLI and desktop output are byte-identical by construction.
2. `src/context/application/use-cases/get-context-pack.use-case.ts:GetContextPack.execute()`: `parseProjectName`, then `withSession` (fails `VAULT_LOCKED` when locked); `PROJECT_NOT_FOUND` if no project.
3. `src/context/infra/item-repo.ts:SqliteContextItemRepository.findByProject()`: newest first, archived excluded by default.
4. `src/context/domain/services/context-pack.ts:assembleContextPack()`: preamble cost first; `addPinned()` (newest pinned always kept even over budget, older pinned cut), `addLatestHandoff()` (skipped whole if it does not fit), `addTypeSections()` in order decision, preference, progress, fact. Cost = `estimateItemTokens()` (~4 chars/token, body + type/date/tags); section headings are charged too. No item appears twice (`included` set).
5. `src/delivery/context-pack-markdown.ts:renderContextPackMarkdown()`: domain returns entities only; headings/labels live here.
6. MCP returns text; errors as `message [CODE]`. Desktop wraps in `toIpcResult()` (code only); `desktop/src/renderer/screens/pack-preview.tsx:PackPreviewScreen()` shows it.
Side effects: none (read-only); desktop `content:export` writes the file the user picked in a native dialog.
Gotchas: never in a pack, even unbudgeted export: `imported` items (not in `SECTION_TYPE_ORDER`, and never pinned per `src/context/domain/entities/context-item.ts:createImportedContextItem()`), archived items, and older handoffs (only pinned ones plus the latest unpinned one get in). Markdown `export` is therefore not a full dump; `--json` (`src/delivery/context-pack-export.ts:exportProjectJson()` via `showProject`) includes imported and all handoffs (still no archived).
Gotchas: header "N items in vault" is `totalCount` = all non-archived items incl. imported, not what was included. A type section stops at the first item that does not fit (`break`), but later sections still try.
Gotchas: `docs/SPEC.md` §5 says all pinned items are always included; code guarantees only the newest one.
Related: `.context/flows/save-context.md`, `.context/flows/desktop-ipc-call.md`, `docs/flows/load-context-pack.md`, `docs/flows/export-context-pack.md`, `docs/flows/serve-mcp.md`, `docs/SPEC.md`
