<!-- easy-repo-context:begin -->
# Repo context (easy-repo-context)
Local-first, end-to-end encrypted (SQLCipher + Argon2id) AI-context vault, exposed through a CLI, a local stdio MCP server and an Electron desktop app. Product spec: `docs/SPEC.md`; process: `CLAUDE.md`, `CONTRIBUTING.md`; generated developer guide: `docs/guide/README.md`; on-disk format: `docs/vault-format.md`; sync: `docs/sync.md`; GUI: `docs/gui.md`.

## Commands
- install: `npm ci` (package-lock.json)
- build: `npm run build` (package.json#scripts.build)
- test: `npm test` (package.json#scripts.test)
- lint: `npm run lint` (package.json#scripts.lint)
- format: `npm run format` (package.json#scripts.format)
- typecheck: `npm run typecheck` (package.json#scripts.typecheck)

## Where to look
- Architecture, components, data stores: `.context/overview.md`
- Invariants and traps: `.context/gotchas.md` (before changing code, read "Repo-wide" + the areas you touch)
- Flows (read only the one matching the task):
  - context-pack: MCP `get_context` / `valija export` / desktop `content:pack` → `GetContextPack` → budgeted section assembly → Markdown pack → `.context/flows/context-pack.md`
  - desktop-ipc-call: screen → `ValijaBridge` → preload `ipcRenderer.invoke` → zod-validated channel → handler → container use case → `IpcResult` (`{ error: { code } }`) → catalog error copy → `.context/flows/desktop-ipc-call.md`
  - import-chat-history: export file (.json/.zip) → read + autodetect parser → normalized conversations → select → chunk → `ImportItems` upserts deterministic-id `imported` items in one write tx. → `.context/flows/import-chat-history.md`
  - multi-device-sync: vault in a synced folder → every committed write bumps an encrypted lineage stamp → unlock compares it with this device's last-seen → in-sync / fast-forward / fork notice; `sync:status` reports folder hazards. → `.context/flows/multi-device-sync.md`
  - save-context: MCP `save_context` / `save_handoff` → parse input → keychain-gated session (idle TTL, migrate) → one tx: find-or-create project + item save + lineage bump → last-seen after commit. → `.context/flows/save-context.md`
  - unlock-vault: CLI `valija unlock` / desktop `vault:unlock` → resolve key (Argon2id or raw recovery key) → schema-version gate → open+migrate+verify via lineage read → key into OS keychain → fork check. → `.context/flows/unlock-vault.md`
- Existing docs (authoritative, not duplicated): `CONTRIBUTING.md`, `README.md`, `docs/SPEC.md`, `docs/flows/README.md`, `docs/flows/_overview.md`, `docs/flows/browse-project.md`, `docs/flows/check-setup.md`, `docs/flows/check-vault-status.md`
- Tool-specific instructions: `CLAUDE.md`
- Agents/skills/hooks: `.claude/agents/`, `.claude/hooks/`
- Before editing a file, run `easy-repo-context context <file>`: it lists the flow docs and gotchas that cover it.
- How to present answers: `.context/presentation.md`
<!-- easy-repo-context:end -->
