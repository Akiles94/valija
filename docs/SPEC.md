# valija — M0 Specification

**Version:** 0.3 · **Status:** In construction — D1–D3 decided · **Scope:** MVP (M1) only
**Legend:** `[TBR]` = To Be Refined — a decision proposed with a default, reviewable before it ships in 0.1.0.

---

## 1. What we are building

An **open source, end-to-end encrypted context vault for developers who use several AI tools**. The vault runs locally, is unlocked with a passphrase, and exposes its content to AI tools (Claude Code, Claude Desktop, Cursor, and any MCP client) through a **local MCP server**. A developer saves distilled context ("we chose SQLCipher, next step is the restore flow") from inside any tool and loads it later from any other tool. A small CLI manages the vault. No cloud, no accounts, no telemetry.

One npm package. One binary surface: `valija`.

---

## 2. MVP scope

**In:**
- Encrypted local vault (single vault per machine) with passphrase + recovery kit
- MCP server (stdio) with 5 tools and 2 prompts
- CLI: init, unlock/lock, list, show, search, export, install helper
- Config installer for Claude Code, Claude Desktop, Cursor

**Out (explicit non-goals for MVP):**
- Importers (ChatGPT/Claude export files) → M2
- File watchers (Claude Code sessions) → M2
- Bring-your-own-cloud vault sync → M3
- GUI, encrypted backup / restore → later (bumped from M3 by M3's redefinition, see §10b)
- Scoped profiles, per-tool visibility → M4
- Browser extension → M5
- A valija-hosted sync service, mobile client → explicitly rejected / not scheduled (see §10b — M3 ships the lower-risk BYO-cloud slice instead)
- Auto-capture (model decides what to save) — explicit saves only
- Embeddings / semantic search / any AI inside the app — FTS only
- Remote/HTTP MCP transport — local stdio only

---

## 3. Architecture

Both entry points (MCP server and CLI) are thin adapters over the same use cases. The vault is a single SQLCipher-encrypted SQLite file; the session key lives in the OS keychain between `valija unlock` and `valija lock`.

Key property of MCP to keep in mind: **the server never sees the conversation**. It only receives what the model puts in the tool arguments. Therefore the vault stores *distilled* context, and the quality of what gets saved is driven by the tool descriptions (§7), which act as extraction prompts.

---

## 4. Key decisions

| # | Decision | Status |
|---|----------|--------|
| D1 | Project name | **DECIDED: `valija`** — npm package `valija` (confirmed free 2026-07-10), binary `valija`. GitHub org `valija` is taken → repo lives under the maintainer's personal account; transferable later. |
| D2 | License | **DECIDED: Apache-2.0** (patent grant matters for a security tool companies may adopt). |
| D3 | Language / runtime | **DECIDED: TypeScript strict on Node ≥ 22, ESM-only, npm.** Best-supported official MCP SDK, largest contributor pool, `npx -y valija mcp` matches how developers install MCP servers. |
| D4 | DB + encryption | **SQLCipher via `better-sqlite3-multiple-ciphers`** — whole-DB encryption, FTS5 index included. App-level per-item encryption would break FTS. |
| D5 | KDF | **Argon2id** (`argon2` pkg), 64 MiB memory, t=3, p=1 → 32-byte raw key. Params stored in plaintext header `vault.json`. `[TBR: benchmark on modest hardware]` |
| D6 | Session / unlock model | `valija unlock` derives + verifies key, stores it in **OS keychain** (`@napi-rs/keyring`); `valija lock` removes it; MCP server reads keychain per call and returns a structured "vault locked" error otherwise. Key verification = successfully opening the SQLCipher DB. No daemon in MVP. |
| D7 | Recovery kit | On `valija init`, write a one-page recovery file (raw key hex + vault id + instructions); user stores it offline. Losing passphrase + kit = data loss, by design. |
| D8 | Libraries | `@modelcontextprotocol/sdk`, `commander`, `zod`, `ulid`, `vitest`, `biome`, `tsup`. |
| D9 | Project auto-create | `save_context` creates the project if it doesn't exist. |
| D10 | Token budget for `get_context` | Default 4000 tokens, estimated as `chars / 4`. Per-call override via `budget` argument. |
| D11 | Single vault per machine | Yes, at `~/.valija/` (override with `VALIJA_HOME` env var). |
| D12 | Commits / versioning | Conventional Commits, SemVer starting `0.1.0`, schema_version `1`. |

---

## 5. Domain model

**Project:** `id: Ulid` · `name: ProjectName` (unique slug, 1–64 chars, `[a-z0-9-]`) · `description?` · `createdAt / updatedAt`

**ContextItem:** `id: Ulid` · `projectId: Ulid` · `type: decision | progress | preference | fact | handoff` · `content: string` (markdown, self-contained, max 32 KB) · `tags: Tag[]` (lowercase, max 10) · `pinned: boolean` · `source?: string` (MCP client name) · `archived: boolean` · `createdAt / updatedAt`

**Ports** (defined in domain, implemented in infrastructure): `ProjectRepository`, `ContextItemRepository`, `VaultCrypto`, `KeychainPort`, `Clock`, `IdGenerator`.

**Use cases:** `CreateVault`, `UnlockVault`, `LockVault`, `VaultStatus`, `SaveContext`, `GetContextPack`, `SearchContext`, `ListProjects`, `ExportPack`.

### Context pack assembly

`GetContextPack(project, budget=4000)` returns markdown assembled as:
1. Header line with project name, item counts, and generation timestamp
2. All **pinned** items, newest first (always included, even if over budget → then truncate oldest pinned last)
3. Latest **handoff**, if any
4. Recent items grouped by type in order: `decision`, `preference`, `progress`, `fact` — newest first, adding items until the budget is reached

---

## 6. Storage layout

```
~/.valija/
├── vault.json      # plaintext header: vault_id, schema_version, kdf params, salt, created_at
├── vault.db        # SQLCipher database (everything else, FTS index included)
└── recovery-kit.txt is NOT stored here — generated once at init, user moves it offline
```

**Schema v1:** `projects`, `context_items`, `context_items_fts` (FTS5 over `content` + `tags`, kept in sync by triggers), `meta` (schema_version). Migrations = ordered `.sql` files applied inside a transaction.

---

## 7. MCP surface

Server name: `valija`. Transport: stdio. Started as `valija mcp` (client config: `npx -y valija mcp`). Input validation with zod at the boundary; on locked vault every tool returns: *"Vault is locked. Ask the user to run `valija unlock` in a terminal."*

### Tools (5 — resist adding more)

| Tool | Arguments | Description role |
|------|-----------|------------------|
| `save_context` | `project`, `content`, `type?`, `tags?` | Save durable, self-contained context. Never secrets. |
| `save_handoff` | `project`, `content` | Package THIS conversation's state: goal, done, blockers, exact next step, files. |
| `get_context` | `project`, `budget?` | Load the context pack before starting work. |
| `search_context` | `query`, `project?`, `limit?` | FTS recall ("what did we decide about auth?"). |
| `list_projects` | — | Disambiguate which project the user means. |

Full descriptions live in the tool source — they are the product's real prompt engineering.

### Prompts (2)

- `/save-context [project]` — compose a save following the checklist, confirm project, call the tool.
- `/load-context <project>` — call `get_context`, summarize state in 3 lines, propose next step.

---

## 8. CLI surface

```
valija init | unlock | lock | status
valija projects
valija show <project> [--type]
valija search <query> [-p proj]
valija export <project> [--md|--json] [-o file]
valija install <claude-code|claude-desktop|cursor>
valija mcp
valija doctor
```

---

## 9. Security model (summary)

**Protects against:** reading `vault.db` without the passphrase (lost/stolen laptop, another OS user, third-party backup storage). Everything at rest is ciphertext, FTS index included.

**Does not protect against:** a compromised OS / malware while unlocked; and **any MCP client you connect receives plaintext** of loaded context, processed by that AI provider. Encryption protects data *at rest*; per-tool scoping arrives in M4.

**Rules:** no telemetry, no network calls at runtime, tool descriptions instruct models to refuse secrets. Losing passphrase + recovery kit = unrecoverable data.

---

## 10. Repository structure — module-first (package by bounded context)

Each bounded context is a top-level folder owning its full clean-architecture stack:

```
src/
├── shared/     domain/(Result, DomainError)  application/(Clock, UseCase)  infra/(sqlite, migrations, paths)
├── vault/      domain/(errors, values)  application/(use-cases + ports)  infra/(argon2, keyring, header, store)
├── context/    domain/(entities, values, services, errors)  application/(use-cases + ports + dto)  infra/(repos, vault-sessions)
└── delivery/   container.ts + context-pack-markdown.ts + cli/ + mcp/   (composition root + entry points)
```

Within a module: `domain/` (entities, values, services, module errors — no I/O), `application/` (use cases, the ports they need, and the DTOs they return), `infra/` (adapters implementing those ports). Technical ports (crypto, keychain, store, repositories) live in `application/`, following Hexagonal; only the branded domain types and invariants live in `domain/`.

Use cases implement `UseCase<In, Out>` — a contract, not a base class. Cross-cutting plumbing is composed in through the port that owns it (`VaultSessions.withSession`), never inherited. Logic that spans entities lives in `domain/services/`, so no use case ever calls another. Rendering (markdown, JSON, tables) belongs to `delivery/`: the domain decides *what* is in a context pack and in what order, delivery decides how it *reads*.

**Dependency rule:** `shared ←` everyone · `vault → shared` · `context → shared, vault` · `importers → shared, context` · `delivery →` all. `context` reaches `vault` only through the `VaultSessions` bridge (a locked vault refuses a session, which is why the content context is downstream of the vault context); `importers` writes items only through context's `ImportItems` use case and never touches `vault`.

Tests are co-located with their subject (`foo.ts` + `foo.test.ts`). Behavior specs live in [`specs/`](../specs/), one file per module. Use cases receive ports via plain constructor injection — no DI framework.

---

## 10a. M2 — Importers (v0.2.0)

Every vault starts empty — the biggest adoption gap. M2 lets users load existing chatbot history so a fresh install is useful on day one.

**Shipped:**
- New `src/importers/` module (`importers → shared, context`), writing through context's `ImportItems` batch use case; it never touches `vault`.
- Parsers for **ChatGPT** and **Claude** official exports, plus a **generic JSON** format (versioned envelope) as the universal door for any other provider. `.zip` accepted, inflated in memory via `fflate` (the only new dependency) with a decompression-bomb cap.
- New storable item type `imported`: searchable via FTS (`search_context`, `valija show --type imported`) but **excluded from context packs** and **never creatable from an MCP tool** (`ITEM_TYPES` stays the five saveable types; storage uses the wider `STORABLE_ITEM_TYPES`). Original conversation dates preserved; deterministic ids make re-import idempotent.
- `valija import [file] -p <project>` with list-first safety, `--pick/--query/--since/--all`, `--from`, and `--dry-run`.
- Schema migration 002 (extend the type CHECK): transactional table rebuild + FTS reindex, with a ciphertext backup on first upgrade of a populated vault.
- Documented the **MCP distillation path**: any connected AI can turn an arbitrary export into real, pack-eligible context via `save_context`.

**Deferred (0.2.x+):** Gemini / Google Takeout parser (messy format), Claude Code session import, a live watcher/daemon. No new MCP tool or argument — import is CLI-only. Also deferred: **conversation reassembly by name** — imported chunks carry a title/date/part-n-of-m header in their body, but there is no lookup that returns one imported conversation's chunks, in order, as a single reassembled document; today that requires manually searching/browsing and ordering by the part header.

---

## 10b. M3 — Bring-your-own-cloud vault sync (v0.3.0)

A vault was single-machine only. M3 makes a single SQLCipher vault file survive living
inside a folder a third-party sync client (Dropbox, iCloud Drive, OneDrive, Google Drive,
Syncthing, …) also watches — lock on device A, let it sync, unlock on device B and continue
— without a backend, accounts, or any network call. The **rejected** shape is a
valija-hosted sync service; that stays out of scope, permanently, not just for this
milestone. This is the lower-risk first slice of what earlier drafts of this roadmap called
"multi-device sync" — see [docs/sync.md](sync.md) for the user-facing ritual.

**Shipped:**
- **Single-file-at-rest journaling (D-A):** `openVaultDb` switches from WAL to a rollback
  journal (`DELETE`), folding any pre-existing WAL first. The vault is one self-consistent
  `vault.db` at rest after **every** command, not only after an explicit `lock` — a sync
  client only ever sees one file to upload. `PRAGMA synchronous` stays at its safe default.
- **Fork detection (D-B):** a lineage stamp (generation counter + random per-write stamp +
  writer device id) committed atomically with every write, inside the encrypted `meta`
  table — never in the plaintext header. `VaultLineage.classifyLineage` compares the vault's
  current stamp against what a device last saw: a clean fast-forward adopts silently; a fork
  (same-or-lower generation, different stamp — proof two devices wrote independently) is
  reported as `VAULT_FORK_DETECTED` and **never** auto-merged, auto-deleted, or
  auto-overwritten.
- **Device identity (D-C):** a device-local id + per-vault last-seen/last-activity record,
  stored under `VALIJA_STATE_HOME` (default `~/.valija-state`) — deliberately independent of
  `VALIJA_HOME` so it never syncs.
- **`lock` = the "safe to switch devices" signal (D-D):** verifies the single-file-at-rest
  state, drops the key, and reports the current generation + who wrote it last. No new
  command.
- **Idle auto-lock (D-I), resolving §12 open question 3:** a device-local last-activity
  timestamp checked lazily at the next session open (no daemon); past the configurable TTL
  (`VALIJA_AUTOLOCK_MINUTES`, default 15 minutes, `0`/`off` disables it) the keychain key is
  proactively dropped.
- **`status` / `doctor` (D-E):** journal mode + single-file check, cloud-folder recognition
  with a lock-before-switch reminder, a loud warning on a vendor "conflicted copy" file,
  lineage generation/last-writer, and auto-lock TTL/idle state — all advisory, never fatal.
- **Upgrade path (D-G):** migration 003 seeds the lineage generation baseline (with a
  ciphertext backup on a populated vault, mirroring M2's migration 002); the journal
  fold/switch happens unconditionally at open, independent of migration success.
- No MCP tool, argument, or prompt added or changed. Sync/lineage/session metadata is
  plumbing for humans (`status`/`lock`/`unlock`/`doctor` output) — it never reaches a context
  pack or an MCP tool response.

**Deferred / explicitly rejected:** a valija-hosted sync backend, accounts, or device
pairing (rejected, not deferred); automatic conflict merge; telemetry or any "is my sync
client done yet?" polling; simultaneous multi-device use (the supported model is strictly
sequential); a background daemon or OS sleep/shutdown hooks (idle auto-lock is deliberately
lazy instead); `valija init --cloud <path>` (the plain `VALIJA_HOME` mechanism already
suffices — deferred, not rejected, as a future convenience). Mobile is unscheduled; see
`advances/M4/idea.md` for the raw idea and the note on why its milestone number is still
tentative.

---

## 11. Build history

Originally planned as 15 reviewed advances (A00–A15) at one per day. On 2026-07-10 the working agreement changed to: **generate the full MVP in one pass, review and refactor afterwards.** Commits still land per advance for reviewable history. The LOC discipline and per-layer tests remain.

---

## 12. Open questions `[TBR]`

1. D5 Argon2id parameters (benchmark on modest hardware)
2. Secret-pattern warning on save: MVP or M2?
3. ~~`valija unlock` TTL / auto-lock: M2+?~~ **Resolved by M3, D-I:** a lazy, no-daemon idle
   auto-lock, default 15 minutes, configurable via `VALIJA_AUTOLOCK_MINUTES` (`0`/`off`
   disables it). See §10b.
4. Multi-vault support: which milestone?

---

## 13. What success looks like

A developer with no prior knowledge goes from `npm i -g valija` (or pure `npx`) to saving context from Claude Code and loading it in Cursor in **under 5 minutes**, with everything on disk encrypted and a recovery kit in their drawer.
