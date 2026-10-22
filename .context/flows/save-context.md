# Flow: save-context
Summary: MCP `save_context` / `save_handoff` → parse input → keychain-gated session (idle TTL, migrate) → one tx: find-or-create project + item save + lineage bump → last-seen after commit.
Trigger: `src/delivery/mcp/server.ts:buildMcpServer()` tools `save_context` and `save_handoff` (same use case, `type: "handoff"` forced); served by `valija mcp` (`src/delivery/cli/build-program.ts:buildProgram()`). MCP-only: no CLI/desktop save.
Path:
1. `src/delivery/mcp/server.ts:buildMcpServer()` — `source` = MCP client name; zod enum `ITEM_TYPES` (excludes `imported`).
2. `src/context/application/use-cases/save-context.use-case.ts:SaveContext.execute()` — parses project/type/tags/content (32 KB cap) and refuses possible secrets (`src/context/domain/services/secret-detection/secret-refusal.ts:refusePossibleSecrets()`, `POSSIBLE_SECRET`, no override over MCP) before any session opens.
3. `src/context/infra/vault-sessions.ts:SqliteVaultSessions.withSession()` — header → keychain key (none → `VAULT_LOCKED`) → `src/vault/application/policies/session-guard.ts:SessionGuard.guard()` → `openVaultDb` + `migrate()`.
4. `SessionGuard.guard()` — idle TTL (`VALIJA_AUTOLOCK_MINUTES`) expired → deletes keychain key, `VAULT_LOCKED`; else records activity.
5. `src/context/infra/vault-sessions.ts:SqliteVaultSessions.commitWrite()` — `db.transaction`: mutate (find-or-create project, `src/context/infra/item-repo.ts:SqliteContextItemRepository.save()`) then `src/vault/infra/sqlite-lineage-store.ts:SqliteLineageStore.bump()`; then `recordSeen`.
6. `buildMcpServer()` — domain error → `isError` text `"message [CODE]"`.
Side effects: projects, context_items (+FTS5 index), lineage meta (generation, write stamp, writer, writtenAt), device activity/last-seen file.
Gotchas: every mutation must run inside `session.write()`; repo calls outside it autocommit without a lineage bump, so other devices can't detect the change/fork. A failed mutation rolls back via sentinel throw (`WriteFailedSentinel`), bump included. Each tool call reopens the DB; session always closed in `src/context/infra/vault-sessions.ts:runWithSession()`. Wrong key in keychain → key deleted, reported as `VAULT_LOCKED`.
Related: `.context/flows/unlock-vault.md`, `docs/flows/save-context.md`, `docs/flows/hand-off-conversation.md`, `docs/flows/idle-auto-lock.md`, `docs/flows/multi-device-sync.md`, `docs/SPEC.md`
