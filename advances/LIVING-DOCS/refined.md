# LIVING-DOCS — an onboarding guide that is generated from the code and fails CI when it drifts · Refined Spec

**Status:** Gate R approved by Oscar 2026-10-19 (resolutions below). Ready for planning.
**Directory:** `LIVING-DOCS`, deliberately not a milestone number (same posture as `GUI`, `CARDS`,
`IMPORT-FEEDBACK`).
**Origin:** Oscar: a living, self-maintaining onboarding documentation system inside the repo, with
**no dependency on Claude or any external service**, so that a developer new to the code can
understand Valija from the business side and the technical side. It has to be readable, cover
business flows and technical detail, include diagrams, and stay current as the code grows, enforced
by CI. Strategic constraint: the tooling may later be extracted as a standalone open-source package,
so this advance must leave a visible seam between a **generic core** and **Valija-specific
extractors**. The extraction itself is not in scope.
**Prototype:** a ~200-line zero-dependency regex script, validated in a scratchpad and not in the
repo. It shows the intended *output*. Its mechanism is not binding.
**Legend:** **Fixed** = already decided by Oscar, not reopened here. **Default:** = this refiner's
recommendation for an open decision. The main agent takes every open decision to Oscar at Gate R.

### Decisions Oscar already made (fixed)

| # | Fixed decision |
|---|---|
| F-1 | **One page per business flow, two levels.** A business section on top (who, why, business rules, what can go wrong, in plain language), then a technical section (Mermaid sequence diagram, steps linked to code, errors). The guide index has two entry points, "Understand the product" and "I'm going to touch code". There is one doc tree, not two. |
| F-2 | **TSDoc is mandatory on every exported symbol** (class, function, interface, type, const) in `src/**`, across all layers. Test files are out. Whether `src/testing/` and `desktop/src/**` are covered is open (D-6). |
| F-3 | **The missing documentation is completed in this same advance.** That means TSDoc for 9 of the 13 use cases and every other undocumented export, plus a business flow for every existing use case. The check is **strict (failing) from day one**, with no warn-only phase. |
| F-4 | **Full ritual.** |

### Gate R resolutions (Oscar, 2026-10-19)

These resolve §5's open decisions and override any default in §5 that disagrees.

| # | Resolution |
|---|---|
| D-1 | **B: `tools/living-docs/{core,valija}/`**, not `src/living-docs/`. Generic core and Valija extractors sit in sibling folders. tsconfig / vitest / Biome includes extend to cover `tools/**`. |
| D-1b | **Extend `.claude/hooks/guard-implementation.sh` to also gate `tools/**`**, as part of this advance (Oscar's explicit say-so), so the `Approved:` gate keeps covering everything implementable. |
| D-2 | **A:** dependency-free, fail-closed lexical scanner in the core. |
| D-3 | **A: hybrid.** Runtime for CLI (refactor `program.ts` into a side-effect-free `buildProgram(container)`, CLI output byte-identical) and MCP; static for desktop and everything else. |
| D-4 | **A:** dedicated `tsup` build entry, output to a git-ignored folder. |
| D-5 | **A:** `docs:check` on every `ci.yml` matrix entry. The main agent proposes adding `npm run docs:check` to CLAUDE.md's per-slice command; that edit is Oscar's. |
| D-6 | **A:** `src/**` (minus tests and `src/testing/`) plus all of `desktop/src/**` (minus tests). |
| D-7 | **Default:** top-level exports only; summary sentence that is not just the name restated; class doc covers its methods; no `@param`/`@returns` requirement. |
| D-8 | **A:** use cases plus every CLI command, MCP tool, MCP prompt and IPC channel must be cited by ≥ 1 flow. |
| D-9 | **Default:** typed references (`cli:`, `mcp:`, `prompt:`, `ipc:`, `err:`); ambiguous names fail until qualified. |
| D-10 | **A:** sources in `docs/flows/`, generated pages in `docs/guide/`. |
| D-11 | **A:** one-line doc required on every error code; never-raised codes are shown, not failed. |
| D-12 | **A:** parity table enforced by `docs:check`; declared gaps need a reason (relocate = known gap). |
| D-13 | **A:** English everywhere. |
| D-14 | **A:** data-only extractor contract; the core renders. |
| D-15 | **Default:** required business and technical headings per flow, enforced. |
| D-16 | **Default:** per-flow sequence diagram + module-dependency flowchart + composition (wiring) flowchart. |

---

## 1. Goal

**Ship a zero-dependency-on-services documentation generator and checker that turns hand-written
flow files plus facts extracted from the code into a committed Markdown + Mermaid guide
(`docs/guide/`).** CI fails whenever the guide and the code disagree: a cited symbol no longer
exists, an export has no TSDoc, a use case (or entry point, per D-8) has no flow, or the committed
guide differs from a fresh regeneration. The generator is split into a **generic core** and
**Valija-specific extractors**, joined by one small, explicit extractor contract.

---

## 2. Ground truth read from the repo (so the planner does not re-derive it)

### 2.1 What the extractors have to find

| Fact | Where it lives today | Shape |
|---|---|---|
| CLI commands (12) | `src/delivery/cli/program.ts` | commander `.command().description().argument().option()` chains. **The module has side effects at import time**: it calls `buildContainer()` and `program.parseAsync()` at module scope, so importing it would parse `process.argv`. |
| MCP tools (5) + prompts (2) | `src/delivery/mcp/server.ts` | `registerTool` / `registerPrompt` inside the exported `buildMcpServer(c)`. `server.test.ts` already lists tools through the public `InMemoryTransport` + `client.listTools()`. |
| Use cases (13) | `src/{vault,context,importers}/application/use-cases/*.use-case.ts` | Exported classes implementing `UseCase` or `AsyncUseCase`. `vault`: CreateVault, UnlockVault, LockVault, VaultStatus, RelocateVault, CheckVaultUpgrade. `context`: SaveContext, SearchContext, ListProjects, GetContextPack, ShowProject, ImportItems. `importers`: ImportConversations. |
| Use cases **without** TSDoc (9, confirmed) | same | GetContextPack, ListProjects, SaveContext, SearchContext, ShowProject, CreateVault, LockVault, UnlockVault, VaultStatus |
| Composition / wiring | `src/delivery/container.ts` | The `Container` interface (15 keys) plus `buildContainer()`, which constructs adapters (`FileVaultStore`, `Argon2VaultCrypto`, `OsKeychain`, `FileVaultFolder`, `FileVaultMover`, `FileDeviceIdentity`, `SqliteVaultSessions`, `FileExportReader`, `parserRegistry`) and the `SessionGuard` policy. `ImportItems` is constructed but **not exposed** on `Container`. It is reached only through `ImportConversations`. |
| Error codes | `src/{vault,context,importers}/domain/errors.ts` | **String-literal union types** (`VaultErrorCode` has 20 members, `ContextErrorCode` 8, `ImporterErrorCode` 8, so 36 in total) plus `vaultErr` / `contextErr` / `importerErr` constructors. None of the union members has a per-code description today. The union is the source of truth. `xxxErr("CODE", …)` call sites tell you *where* a code is raised. |
| Desktop entry points (29 IPC channels) | `desktop/src/shared/ipc/channels.ts` (`CHANNELS` tuple + `ChannelMap`), handlers in `desktop/src/main/ipc/handlers/*-handlers.ts`, registered by `register-handlers.ts` | Handlers call the **same** `Container` use cases (`getContainer().unlockVault.execute(...)`), so the CLI command and the desktop channel that serve one capability share a use case. |
| Entry point → use case | `src/delivery/cli/*.ts`, `src/delivery/mcp/server.ts`, `desktop/src/main/ipc/handlers/*.ts` | A uniform `.<containerKey>.execute(` pattern. Some calls are **one hop away** through delivery helpers: `export` goes through `context-pack-export.ts` (GetContextPack, ShowProject), and `doctor` / `diagnostics:run` go through `diagnostics.ts` (VaultStatus). |
| Module / layer map | `src/<module>/{domain,application,infra}/<kind>/` | Modules: `shared`, `vault`, `context`, `importers`, `delivery` (delivery is a composition layer, not a bounded context). The dependency rule is stated in `docs/SPEC.md` §10 and `specs/README.md`. |

### 2.2 Size of the TSDoc backfill (heuristic grep, to be confirmed by the tool's first run)

| Scope | `export` statements (non-test) | Already preceded by `/** */` | Missing (approx.) |
|---|---|---|---|
| `src/**` excluding `src/testing/` | ~216 | ~77 | **~139** |
| `src/testing/` | 18 | 11 | 7 |
| `desktop/src/**` | ~232 | ~106 | **~126** (`shared/ipc/messages.ts` alone is ~38, `renderer/components/icons.tsx` ~11) |
| Error-code union members (if D-11 = A) | 36 | 0 | 36 |

Business flows: there are none today. About 18–20 are needed (§4.3).

### 2.3 Constraints discovered

- **TypeScript is `^7.0.2`, the Go-native port, in both root and `desktop/`.** The classic
  `typescript` JS compiler API (`ts.createProgram`, the checker, JSDoc nodes) may not be exposed by
  this version. This has **not been verified**, because `node_modules` is not installed in this
  checkout. The planner must verify before choosing a mechanism (D-2).
- **Node's built-in type stripping cannot run `src/**` directly.** Imports use `.js` specifiers
  that point at `.ts` files (`"../container.js"`), and Node does not rewrite them. Anything that
  imports source at runtime needs a bundler or loader step (D-4).
- **Root CI does not install `desktop/` dependencies.** `ci.yml` runs only `npm ci` at the root, on
  a 3-OS × 2-Node matrix. `desktop.yml` runs only when `desktop/**` changes. A check that must catch
  desktop drift on *every* PR therefore has to read `desktop/src/**` **statically** from the root
  job.
- **The implementation gate only covers `src/`, `desktop/`, `package.json`, `tsup.config.ts` and
  `tsconfig*.json`** (`.claude/hooks/guard-implementation.sh`). Generator code placed in a new
  top-level folder such as `tools/` or `scripts/` would **not** be gated (D-1).
- `.gitattributes` already forces `eol=lf`, which helps byte-stable output on Windows runners.
- `npm run lint` is `biome check .`. If Biome processes `.md` in this version, the generated output
  must already be in Biome's format (or `docs/guide/` must be excluded). Otherwise `lint` and
  `docs:check` will fight each other. The planner must verify which applies.
- **`specs/` already exists.** It holds one behavioural contract per module (`specs/vault.md`,
  `context.md`, `importers.md`, `shared.md`, `delivery.md`, `desktop.md`). The guide is onboarding
  narrative and must **link** to specs, not duplicate them.
- **`CONTRIBUTING.md` is stale.** Its module list says `shared, vault, context, delivery`, which
  misses `importers`. The generated module map will contradict it.
- An observation, not in scope: `relocate-vault.use-case.ts` (application) imports
  `vault/infra/vault-header.ts`. A generated layer map shows the code **as it is**, so this edge will
  appear. Fixing it is not part of this advance.

---

## 3. User walkthrough (observable behaviour)

There are three people: **Lucía**, a new contributor; **Marco**, a maintainer adding a feature; and
**CI**.

### 3.1 Lucía onboards (reading only)

| # | She does | She sees |
|---|---|---|
| 1 | Opens `README.md` → **Docs** → "Developer guide" | `docs/guide/README.md`: a one-paragraph product summary and two entry points, **Understand the product** (flow list grouped by theme, business sections only) and **I'm going to touch code** (architecture → reference → flows). |
| 2 | Clicks **Understand the product** → "Unlock your vault" | `docs/guide/flows/unlock-vault.md`. The top half is plain language: who does this, why, business rules ("the key lives in the OS keychain, never on disk"), what can go wrong ("wrong passphrase", "this vault was forked on another device"). |
| 3 | Scrolls to the technical half | A Mermaid sequence diagram drawn **from the same numbered steps** (GitHub renders it natively). Each step links to the file that exports the cited symbol (`UnlockVault`, `OsKeychain`, …). There are entry points for **both** the CLI (`valija unlock`) and the desktop app (`vault:unlock`), and an errors table whose codes link to the catalogue. |
| 4 | Opens **Architecture** | A module map (modules × layers), a module dependency diagram derived from real imports, and a port → adapter wiring table/diagram taken from the composition root. |
| 5 | Opens **Reference** | Generated tables: CLI commands (with descriptions and options), MCP tools and prompts, IPC channels, a CLI ↔ desktop parity table, use cases (with TSDoc summary and **back-links to every flow that cites them**), and a per-module error catalogue. |

### 3.2 Marco adds a feature

```
$ git switch -c feat/archive-project
# adds ArchiveProject use case + `valija archive` command + `content:archive` channel
$ npm run docs:check
✗ TSDoc missing: src/context/application/use-cases/archive-project.use-case.ts › ArchiveProject
✗ Use case not referenced by any flow: ArchiveProject
✗ CLI command not referenced by any flow: archive          (if D-8 = A)
✗ Guide is stale: docs/guide/reference.md differs — run `npm run docs`
4 problems. Guide not up to date.
$ # writes TSDoc; adds docs/flows/archive-project.md citing {{ArchiveProject}}, {{cli:archive}}, {{ipc:content:archive}}
$ npm run docs            # regenerates docs/guide/**
$ npm run docs:check
✓ 312 exports documented · 14 use cases covered by 21 flows · 0 broken references · guide up to date
```

Marco did **not** hand-edit `reference.md`. The new command, channel, use case and any new error
code show up there automatically, and `ArchiveProject`'s reference row back-links to the new flow.
If he later renames `ArchiveProject` → `ArchiveProjectUseCase`, `docs:check` fails with
`✗ Broken reference {{ArchiveProject}} in docs/flows/archive-project.md:14`.

### 3.3 CI

Every PR runs `npm run docs:check` (D-5). It fails on any condition in the table below and never
needs network access, an API key, or an AI service.

| When someone… | Result |
|---|---|
| adds a CLI command, MCP tool or prompt, IPC channel, use case, or adapter | Appears in the reference/map/wiring after `npm run docs`. If they forget to regenerate, CI fails. |
| adds an error code to an `XErrorCode` union | Appears in that module's error catalogue (with its description, if D-11 = A) |
| adds an export without TSDoc | CI fails |
| adds a use case (or an entry point, per D-8) that no flow references | CI fails |
| renames or deletes a symbol, command, tool, channel, or error code that a flow cites | CI fails |
| forgets to regenerate the guide | CI fails |
| adds a CLI command with no desktop counterpart, or the reverse (if D-12 = A) | CI fails unless it is declared as a known gap with a reason |

### 3.4 What surfaces the guide reaches, and which it deliberately does not

| Surface | Affected? |
|---|---|
| `docs/guide/**` (committed, rendered by GitHub) | **Yes.** This is the product of this advance. |
| `docs/flows/**` (hand-written sources, per D-10) | **Yes.** New. |
| npm package (`files: dist`) | **No.** The generator and the guide are not shipped to users. |
| `valija` CLI behaviour / output | **No change** (the `program.ts` refactor under D-3 must be byte-identical). |
| Desktop app behaviour | **No change.** Only TSDoc comments are added to `desktop/src/**` (if D-6 includes it). |
| MCP surface | **No change.** 5 tools + 2 prompts, same descriptions. The guide documents the MCP surface. It never adds to it. |
| The user's vault, keychain, `~/.valija`, `~/.valija-state` | **Never touched** by the generator (§7). |

Every acceptance criterion in §6 traces to a step here.

---

## 4. Scope

### 4.1 In scope

1. **Generic core.** It contains:
   - flow-file parsing (`N. [A → B] text — {{ref}}`; both `→` and `->` accepted)
   - Mermaid `sequenceDiagram` generation from the same steps
   - a symbol index built from exported declarations
   - `{{ref}}` resolution to relative file links
   - a TSDoc-coverage check
   - a generic "every item of a required kind is referenced by ≥1 flow" check
   - flow-structure validation (required business/technical headings, D-15)
   - the staleness check (regenerate in memory, compare to the committed copy)
   - deterministic Markdown + Mermaid rendering of generic catalogue/table data
   - back-link computation

   The core has no knowledge of commander, MCP, Electron, `Container`, or Valija module names.
2. **Extractor contract.** One small, explicit interface between core and extractors (D-14). There
   is no plugin loading or discovery. The Valija configuration lists its extractors explicitly.
3. **Valija extractors:**
   - CLI commands
   - MCP tools and prompts
   - use cases (with TSDoc summary)
   - module / layer map plus the module dependency graph
   - container wiring (port → adapter, use case → injected ports)
   - error codes per module (from the union types, plus raising sites)
   - desktop IPC channels and their handlers
   - entry point → use case links (including one hop through delivery helpers)
   - the CLI ↔ desktop parity table (D-12)
4. **Guide output** in `docs/guide/`: `README.md` (two entry points), `architecture.md`,
   `reference.md` (or split per section, at the planner's discretion), and `flows/*.md`. Every
   generated file starts with a "generated, do not edit, run `npm run docs`" banner.
5. **npm scripts** `docs` (write) and `docs:check` (verify, non-zero exit on any problem, readable
   `file:line` diagnostics), plus wiring into CI (D-5).
6. **TSDoc backfill** for every export inside the coverage scope (D-6, D-7). That includes the 9
   use cases and, if D-11 = A, the 36 error codes.
7. **Flows for every existing use case** (and, per D-8, every entry point). §4.3 has the inventory.
8. **Doc cross-links:**
   - README "Docs" gains the guide.
   - `docs/SPEC.md` §10 and `specs/README.md` point to the guide's architecture page.
   - `docs/gui.md` and `docs/sync.md` link to the relevant flows.
   - Each guide module section links to its `specs/<module>.md`.
   - **CONTRIBUTING.md** gains "How to add or update a flow" (syntax, the reference kinds, running
     `npm run docs` / `docs:check`, what CI checks) and its module list is corrected to include
     `importers`.
9. Tests for the core (parser, resolver, renderers, checks, determinism) and the extractors (against
   small fixtures plus one smoke run over the real repo). There is also an architecture test proving
   **the core imports nothing from the Valija extractors or from any other `src/` module**.

### 4.2 Explicitly deferred

| Deferred | Why |
|---|---|
| Extracting the core into a separate npm package or repo | Out of scope by Oscar's decision. Only the seam ships now. |
| Plugin loading, extractor discovery, config files for third-party repos | "No plugin system." Explicit wiring is enough. |
| A static-site generator, search, or hosted docs | GitHub's Markdown + Mermaid rendering is the reader. |
| Enforcing the dependency rule (failing on `application → infra` edges such as §2.3's relocate observation) | It is a separate architecture-lint concern. The map *shows* edges but does not judge them. |
| TSDoc on members (methods, properties) of exported types, beyond what D-7 decides | Only top-level exports are in scope by default |
| Translating the guide (see D-13) | Single language this advance |
| A `valija relocate` CLI command (the known parity gap) | Owed to a future advance. Here it is only *declared* as a known gap. |
| Fixing behaviour anywhere | This advance documents code. It changes no runtime behaviour (the `program.ts` refactor, if any, must be output-identical). |
| AI-written or AI-checked prose of any kind | The system must work with no AI service. Humans write flows and TSDoc. |

### 4.3 Flow inventory (each use case is referenced by ≥ 1 flow)

| # | Flow (page) | Use cases cited | CLI | Desktop (IPC) | MCP |
|---|---|---|---|---|---|
| 1 | Create a vault (passphrase + recovery kit) | CreateVault | `init` | `vault:init`, `vault:readRecoveryKit` | — |
| 2 | Unlock the vault (passphrase or recovery key) | UnlockVault | `unlock [--recovery-key]` | `vault:unlock` | — |
| 3 | Upgrade a behind-schema vault on unlock | CheckVaultUpgrade, UnlockVault | `unlock` (silent upgrade) | `vault:upgradeCheck`, `vault:unlock` | — |
| 4 | Lock the vault | LockVault | `lock` | `vault:lock` | — |
| 5 | Check vault status (lock, journal, lineage, auto-lock) | VaultStatus | `status` | `vault:status`, `sync:status` | — |
| 6 | Idle auto-lock | VaultStatus (+ `SessionGuard` policy) | — | — | — (every tool refuses when locked) |
| 7 | Move the vault to another folder | LockVault, RelocateVault | **gap** | `relocation:preflight/move/retryClient/pointAtExisting`, `dialog:chooseVaultFolder` | — |
| 8 | Save context from an AI tool | SaveContext | — | — | `save_context`, prompt `save-context` |
| 9 | Hand off a conversation to another tool | SaveContext | — | — | `save_handoff` |
| 10 | Load a project's context pack | GetContextPack | — | `content:pack` | `get_context`, prompt `load-context` |
| 11 | Export a context pack (markdown / JSON / clipboard) | GetContextPack, ShowProject | `export` | `content:export`, `content:copy` | — |
| 12 | Search saved context | SearchContext | `search` | `content:search` | `search_context` |
| 13 | List projects | ListProjects | `projects` | `content:projects` | `list_projects` |
| 14 | Browse a project | ShowProject | `show` | `content:show` | — |
| 15 | Import chat history (list → preview → import) | ImportConversations, ImportItems | `import` | `import:list/preview/run`, `dialog:chooseImportFile` | — |
| 16 | Connect an AI tool | — (installer, no use case) | `install` | `tools:status/connect/nodeStatus` | — |
| 17 | Serve AI tools over MCP | — (all five tools) | `mcp` | — | all |
| 18 | Check my setup (doctor / diagnostics) | VaultStatus | `doctor` | `diagnostics:run`, `diagnostics:copyReport` | — |
| 19 | Use one vault on several devices (lock → sync → unlock, fork detection) | LockVault, UnlockVault, VaultStatus | `lock`/`unlock`/`status` | `vault:*`, `sync:status` | — |
| 20 | Desktop preferences (theme, language) *(only if D-8 requires every IPC channel)* | — | **n/a, desktop-only by nature** | `preferences:read/write` | — |
| 21 | Keep the guide current *(only if D-1 = A, because the generator's own use cases then need a flow)* | the generator's use cases | `npm run docs` | — | — |

---

## 5. Open decisions (each has a default; Gate R confirms or overrides)

### D-1. Where the generator lives
- **A (default): `src/living-docs/`**, a new module with `domain / application / infra`. The core
  sits in `domain/` + `application/` + generic `infra/` adapters (file reading, Markdown/Mermaid
  writing). The Valija extractors sit in **`infra/extractors/valija/`**, so the seam can be seen in
  the folder tree, and an architecture test enforces it.
  - **For:** the existing tsconfig, vitest, Biome and the **implementation gate** already cover it.
    The conventions (no bare files, TSDoc mandate) apply automatically. It is not bundled
    (`tsup` has a single entry), so it never ships.
  - **Against:** it appears in its own module map as a sixth module (labelled "tooling"). Its use
    cases then need a flow (#21 in §4.3, which is also dogfooding). The Valija extractors import
    `delivery`, so the dependency rule gains `living-docs → all`.
- **B: top-level `tools/living-docs/{core,valija}/…`.**
  - **For:** the cleanest product/tooling separation and the easiest later extraction.
  - **Against:** it needs tsconfig/vitest include changes. **It is not covered by
    `guard-implementation.sh`**, so implementation could bypass the `Approved:` gate unless Oscar
    extends that hook, which is his config and not the agents'.
- **C: `scripts/`.** Loose files. Rejected: it violates the spirit of "no bare files" and has no
  visible seam.

### D-2. How source is analysed (exports, TSDoc presence, error unions, call sites)
- **A (default): a dependency-free, comment/string/template-aware lexical scanner in the core.** It
  recognises top-level `export` declarations and whether a `/** */` block is directly attached. It
  **fails closed**: a file it cannot scan with confidence (unbalanced state) is a `docs:check`
  error, never a silent pass. Golden-fixture tests cover the tricky cases (template literals,
  regex literals, multi-line exports, `export type`, `export const` arrows, overloads).
  - **For:** portable to any repo, no dependency, and robust enough for top-level declarations.
  - **Against:** it is not a full parser. Exotic syntax may trip it, which is why it fails closed.
- **B: the TypeScript compiler JS API.** This is the most accurate option. **It is blocked or
  uncertain under TS 7** (§2.3), and the planner must verify. If the API exists, B is the best
  option.
- **C: add `typescript@5` under an npm alias as a dev dependency, only for the tool.** It is
  accurate and mature, but it brings two TypeScript versions and a new dependency (CONTRIBUTING:
  "no new dependencies without discussion", and Gate R *is* that discussion).
- **D: a small parser dependency** (for example an oxc or babel TS parser). It is accurate and fast,
  but it is a new dependency and the extracted package would carry it.
- **E: a Biome GritQL plugin for "export without doc comment".** It would reuse an existing tool, but
  its support for this is unverified, and it only covers the TSDoc check, not the index.

### D-3. How entry points are discovered
- **A (default): hybrid.**
  - **Runtime** introspection where a real registry exists in root dependencies: commander's
    registered commands, and MCP `listTools` / `listPrompts` via the public `InMemoryTransport`
    (already used in `server.test.ts`).
  - **Static** scanning for everything else, including desktop channels (root CI has no desktop
    deps), use cases, errors, wiring, and call sites.
  - This **requires refactoring `program.ts`** into a side-effect-free `buildProgram(container)`
    plus a thin entry that calls `parseAsync`. CLI output must be byte-identical, proven by the
    existing CLI tests plus one new test.
- **B: fully static.** It needs no `src/delivery` change, but it re-introduces the regex fragility
  the prototype had for commander chains.
- **C: fully runtime**, desktop included. Root CI would then need desktop deps, or the check would
  only run in `desktop.yml` (path-filtered, so it would miss drift on `src/` PRs). Rejected.

### D-4. How `npm run docs` executes TypeScript (only matters if D-3 has a runtime part)
- **A (default): a dedicated `tsup` build entry/config** that outputs to a git-ignored folder, and
  `docs` / `docs:check` run that build first. It adds no new dependency and reuses the existing
  `.js` → `.ts` resolution. Native modules stay external, as in `tsup.config.ts`.
- **B: add `tsx` as a dev dependency.** It is simpler to invoke, but it is a new dependency.
- **C: run the check as a vitest test.** It would be covered automatically by `npm test` and the
  advance ritual, but "regenerate the guide" through a test runner is awkward, and failures read
  as test failures.

### D-5. Where the check runs
- **A (default):** `npm run docs:check` as a step in `ci.yml`'s existing job, on **all matrix
  entries**. That proves the output is byte-identical on Windows/macOS/Linux, which a
  single-runner check cannot. Oscar may also want CLAUDE.md's per-slice command to become
  `npm run typecheck && npm run lint && npm run test && npm run docs:check`. **That edit is
  Oscar's** (CLAUDE.md), so the main agent proposes it and does not make it.
- **B:** a single ubuntu/Node 22 step. It is cheaper, but OS-dependent nondeterminism would go
  unnoticed until someone regenerates on Windows.
- **C:** fold it into `npm run lint`. Every existing habit would then run it automatically, but
  lint would become slower, and with D-3 = A it would need native modules loaded.

### D-6. TSDoc coverage scope
- **A (default):**
  - **In:** `src/**` excluding tests and `src/testing/`, plus **all of `desktop/src/**`** excluding
    tests (main, preload, shared, renderer). About 265 symbols to backfill.
  - **Why desktop is in:** flows cite desktop handlers and screens, and surface parity treats
    desktop as a peer.
  - **Why `src/testing/` is out:** fixtures, as Oscar suggested. It is only 7 symbols if he wants
    it in anyway.
- **B:** `src/**` plus `desktop/src/{main,shared,preload}`, leaving the renderer (screens, state,
  components) for later. About 60% of the desktop work, but it leaves a documented/undocumented
  split inside one app.
- **C:** `src/**` only (about 139). This is the smallest option, but a flow citing a desktop symbol
  would link to undocumented code.

### D-7. What "has TSDoc" means
- **Default:**
  - Top-level exported declarations only.
  - An exported class's doc covers its public methods.
  - Interface members are not required.
  - The doc block must contain a non-empty summary sentence that is **not just the symbol's name
    restated** (cheap guard against `/** UnlockVault. */`).
  - No `@param` / `@returns` requirement.
  - Re-export statements (`export { x } from`) are exempt. The original declaration is what gets
    checked.
- **Alternative:** also require docs on public members of exported classes and interfaces. This is
  much larger (DTO fields, port methods) and arguably the next advance.

### D-8. Which kinds must be referenced by ≥ 1 flow
- **A (default):** use cases (fixed) **plus every CLI command, MCP tool, MCP prompt and IPC
  channel.**
  - **For:** entry points are what onboarding readers actually look for, and this rule is what
    keeps parity visible.
  - **Cost:** flow #20 (preferences) must exist.
- **B:** use cases only, which is exactly Oscar's stated rule. Entry points would still appear in
  the reference, just not be enforced.

### D-9. Reference syntax in flows
- **Default: typed references** for public names and plain references for code symbols:
  - `{{UnlockVault}}` for code symbols
  - `{{cli:unlock}}`, `{{mcp:save_context}}`, `{{prompt:load-context}}`, `{{ipc:vault:unlock}}`,
    `{{err:VAULT_LOCKED}}`

  Each kind resolves against its extractor. A name exported from two files is **ambiguous**, and
  the check fails until the reference is qualified (`{{vault/UnlockVault}}` or a path form; the
  planner picks the exact form).
- **Alternative:** symbols only. It is simpler, but renaming a CLI command or channel would not
  break any flow, so the guide could silently cite a dead entry point.

### D-10. Flow source vs output layout
- **A (default, as in the prototype):** hand-written sources in `docs/flows/*.md` produce generated
  pages in `docs/guide/flows/*.md`. A short `docs/flows/README.md` says "readers go to
  `docs/guide/`".
  - **For:** sources stay clean, and generated pages are fully owned by the tool.
  - **Against:** the prose appears twice in the repo, and someone may edit the generated copy (the
    staleness check catches that).
- **B: in-place.** A single file per flow, where the generator only rewrites marked regions (the
  diagram, links, error table). There is no duplication, but authors and readers see raw `{{…}}`
  outside the regions, and region bookkeeping is easy to break.

### D-11. Error catalogue content
- **A (default):** every member of every `XErrorCode` union carries a one-line doc comment, which
  becomes the catalogue description. This is enforced by the coverage check (36 lines to write).
  The catalogue lists code, module, description, raising sites (links), and the flows that cite it
  (back-links).
- **B:** list code, module and raising sites only. It needs no new docs, but the catalogue becomes
  a lookup table with no meaning.
- **Sub-decision:** a code that is declared but never raised is *shown* as such, and **does not
  fail** the check (default). Failing on it is possible, but some codes may be raised only through
  shared paths that the static scanner cannot see.

### D-12. CLI ↔ desktop parity table
- **A (default):**
  - Entry points are **paired automatically when they reach the same use case** (for example
    `init` ↔ `vault:init` through `createVault`, including one hop through delivery helpers).
  - Capabilities with no use case (`install` ↔ `tools:connect`, `doctor` ↔ `diagnostics:run`,
    `mcp`, `dialog:*`, `preferences:*`) are paired in a small **hand-maintained, Valija-side
    mapping**.
  - `docs:check` **fails** on any CLI command or channel that is neither paired nor declared as an
    intentional asymmetry or known gap with a reason. Relocate is declared as the known gap from
    CLAUDE.md; `mcp` and `preferences:*` are declared surface-specific.
  - This makes CLAUDE.md's surface-parity rule mechanically visible.
- **B:** an informational table only, with no failure. Less friction, but parity drift stays
  silent.
- **C:** no parity table. Rejected, because surface parity is a standing rule.

### D-13. Language of the guide, flows and TSDoc
- **A (default): English everywhere.** The repo, specs, docs and code are English, and the stated
  future is an open-source package. The business sections are written in plain English for
  non-developers.
- **B:** flows in neutral Spanish (business and technical), TSDoc in English. This suits Oscar, but
  it splits the repo's language and limits contributors.
- **C:** bilingual flows (EN + ES). This is the most inclusive option, but it doubles the authoring
  and the drift surface, and the staleness check cannot verify that the translations agree.

### D-14. Shape of the extractor contract (the seam)
- **A (default): data-only.** An extractor returns structured facts: symbols (name, kind, file,
  summary), catalogues (generic rows and columns), coverage requirements ("these items of kind K
  must be referenced"), and optional pairings. **The core renders everything.** This is the most
  portable option, and output stays consistent.
- **B:** extractors may also return Markdown fragments. It is quicker for odd sections, but
  rendering leaks across the seam and a future package would carry Valija formatting.

### D-15. Flow page structure enforcement
- **Default: yes.** Each flow source must contain the business headings (Who / Why / Business rules
  / What can go wrong) and the technical headings (Entry points / Steps / Errors). Missing sections
  fail `docs:check`. Entry points must list both CLI and desktop, or state why one is absent.
- **Alternative:** a free-form body with only steps validated. It is easier to write, but the
  two-level contract (F-1) would erode.

### D-16. Which diagrams are generated
- **Default:**
  - a per-flow `sequenceDiagram` (fixed)
  - a module dependency `flowchart` from real imports
  - a composition `flowchart` (use case → port → adapter) from the container

  Layer-by-layer class diagrams are out.
- **Alternative:** sequence diagrams only. Smaller, but the architecture page loses its main
  visual.

---

## 6. Acceptance criteria (reviewer checklist)

**Generation and determinism (§3.1, §3.3)**
- [ ] `npm run docs` writes `docs/guide/README.md` (two entry points), `architecture.md`, reference
      page(s), and one page per flow. Every generated file carries a do-not-edit banner.
- [ ] Running `npm run docs` twice produces no diff. Output has no timestamps, absolute paths, or
      OS-specific separators, and is identical on the CI matrix (D-5).
- [ ] Generated Markdown passes `npm run lint` unchanged (or is explicitly excluded, with the reason
      stated, §2.3).
- [ ] Each flow page has the business section above the technical section, a Mermaid sequence
      diagram whose participants and messages match the numbered steps, and links that resolve to
      real files in the repo.

**Reference content (§3.1 step 5, §3.2)**
- [ ] The reference lists all 12 CLI commands (with descriptions, arguments and options), the 5 MCP
      tools and 2 prompts, all 29 IPC channels, and all 13 use cases with their TSDoc summary, each
      use case showing back-links to the flows citing it.
- [ ] Per-module error catalogue covering all 36 codes (with descriptions if D-11 = A).
- [ ] Architecture page: module × layer map, module dependency diagram, port → adapter wiring (all
      adapters constructed in `buildContainer`, including those not exposed on `Container`, such as
      `ImportItems`'s wiring).
- [ ] Parity table per D-12. Relocate is shown as the known gap.
- [ ] A reviewer adds a throwaway CLI command, use case, and error code on a scratch branch: after
      `npm run docs` all three appear without hand-editing any guide file.

**Checks: each one demonstrably fails (§3.2, §3.3)**
- [ ] An export without TSDoc → `docs:check` exits non-zero and names the file and symbol.
- [ ] A use case (and, under D-8 = A, a command, tool, prompt or channel) cited by no flow →
      non-zero.
- [ ] A flow citing a renamed or deleted symbol, command, tool, channel or error code → non-zero,
      with `file:line`.
- [ ] An ambiguous symbol reference → non-zero (D-9).
- [ ] A hand-edited or stale `docs/guide/**` file → non-zero, with a hint to run `npm run docs`.
- [ ] A flow missing a required section → non-zero (D-15).
- [ ] An unscannable source file → non-zero, never a silent pass (D-2 fail-closed).
- [ ] Each failure mode above is covered by an automated test against fixtures.
- [ ] On the real repo at merge time, `npm run docs:check` passes, so the check is strict from day
      one (F-3).

**Backfill (F-2, F-3)**
- [ ] Every export in the D-6 scope has TSDoc meeting D-7, including the 9 listed use cases.
- [ ] One flow per row of §4.3 exists (rows 20–21 conditional), and every one of the 13 use cases is
      cited by at least one.
- [ ] Flow content matches actual behaviour. Spot-check against `specs/*.md`: for example, `unlock`
      on a fork still unlocks and prints a notice, and imported items are excluded from packs.

**Seam (strategic constraint)**
- [ ] The core and the Valija extractors are in visibly separate folders (D-1). An automated test
      fails if any core file imports an extractor, `delivery`, `vault`, `context`, `importers`,
      commander, the MCP SDK, or Electron.
- [ ] Extractors are listed explicitly in one Valija configuration point. There is no dynamic
      discovery or plugin loading.
- [ ] The extractor contract is documented with TSDoc and is the only thing extractors implement.

**Wiring and docs (§3.3, §4.1 item 8)**
- [ ] `package.json` has `docs` and `docs:check`. CI runs `docs:check` per D-5.
- [ ] If D-3 = A: `valija --help` and every command's output are byte-identical to before the
      `program.ts` refactor, and existing CLI tests are green.
- [ ] README, SPEC §10, `specs/README.md`, `docs/gui.md` and `docs/sync.md` link to the guide or the
      relevant flows. Each guide module section links to `specs/<module>.md`.
- [ ] CONTRIBUTING has "How to add or update a flow" and the corrected module list.
- [ ] `npm run typecheck && npm run lint && npm run test && npm run docs:check` is green at the root,
      and `typecheck`/`test` are green in `desktop/` (TSDoc-only edits there).
- [ ] No new runtime dependency. Any new dev dependency is the one Oscar chose at D-2/D-4.

---

## 7. Security-sensitive surfaces: what must not weaken

- **The generator never opens a vault, derives a key, or touches the keychain.** Under runtime
  introspection (D-3 = A), any `Container` it builds must point at an isolated, temporary vault root
  **and** state root, never `~/.valija`, `VALIJA_HOME`, or `~/.valija-state`. It may list
  registrations, but it must **never call `.execute()`** or an MCP tool handler. A test should prove
  that a run leaves no files in the real home and state locations.
- **No vault content, passphrase, key, recovery kit, or device id appears in generated docs.** Only
  source-level facts (names, descriptions, file paths, error codes) are extracted. Examples written
  in flows must be visibly fake.
- **No network, no telemetry, no AI service**, at generation or in CI. This is consistent with
  SPEC §9's "no network calls".
- **The MCP surface is unchanged.** Tool descriptions are *read* for the reference, never edited.
  The guide must not suggest new tools (SPEC §7: "5 — resist adding more").
- **TSDoc on security-relevant code must not leak secrets or weaken invariants.** Comments in
  `vault/infra/*`, the IPC handlers and `schemas.ts` must restate existing guarantees accurately
  (keys only in the keychain, errors cross IPC as `{ code }` only, no path from the renderer). A
  reviewer reading new TSDoc in `vault/**` and `desktop/src/main/ipc/**` checks that the docs match
  the code and do not invite a weaker usage.
- **The `program.ts` refactor (D-3 = A) is the only runtime-code change.** It must not change
  argument parsing, exit codes, or error printing (`error [CODE]: message`).
- **Process gate:** if D-1 = B, the implementation gate does not cover the generator's folder. Oscar
  must decide whether to extend `guard-implementation.sh` before implementation starts.

---

## 8. Architecture notes (clean architecture / DDD / hexagonal)

- **Core domain:** documentation concepts. These include flow, step (actor → actor, text,
  references), reference (kind + name), symbol, catalogue, coverage requirement, and coverage /
  link / staleness findings. All of it is pure and has no I/O.
- **Core application:** use cases such as "generate guide" and "check guide" (exact naming is the
  planner's). Ports cover reading source files, reading flow files, reading and writing the guide,
  and **the extractor port** (D-14).
- **Core infra:** generic adapters only (filesystem, the lexical scanner if D-2 = A, Markdown and
  Mermaid renderers).
- **Valija extractors** are adapters implementing the extractor port, grouped under one clearly
  named folder. They are the *only* code that knows commander, the MCP SDK, `Container`,
  `CHANNELS`, or Valija's module names. The Valija composition (which extractors run, the parity
  overrides, the coverage kinds, the paths) is one explicit configuration point. **No bare files**:
  extractors, renderers, checks and values each sit in kind-named subfolders.
- **Determinism is a domain property, not an afterthought.** Sorting and normalisation belong where
  catalogues are built, so every renderer inherits them.
- **Testability:** the core is tested with in-memory fixtures (no repo access). Extractors are
  tested against tiny fixture trees plus one smoke run over the real repo. The architecture test
  enforces the seam.
- Keep the core small. The prototype was about 200 lines. The goal is robustness and a clean seam,
  not a framework.

---

## 9. Affected areas (for the planner, not a plan)

New generator module (D-1) · `docs/flows/*.md` (new, hand-written) · `docs/guide/**` (new,
generated) · `package.json` scripts (and a dev dependency only if D-2/D-4 choose one) · possibly a
tsup config/entry for the tool (D-4) · `.github/workflows/ci.yml` (D-5) ·
`src/delivery/cli/program.ts` (D-3 = A, behaviour-identical refactor) · TSDoc-only edits across
`src/**` and, per D-6, `desktop/src/**` · `src/*/domain/errors.ts` union-member docs (D-11) ·
`README.md`, `CONTRIBUTING.md`, `docs/SPEC.md`, `docs/gui.md`, `docs/sync.md`, `specs/README.md` ·
possibly a new `specs/` entry for the tool, if D-1 = A makes it a module (planner's call, consistent
with "one spec per module").

**Suggested slicing** (each slice green before the next; the CI step lands in the last slice, so
`main` is strict from the moment it merges):
1. Core: flow parser, references, symbol index, scanner, renderers, checks, determinism, with
   fixture tests.
2. Seam + Valija extractors (and the `program.ts` refactor if D-3 = A), then architecture and
   reference generation.
3. TSDoc backfill for `src/**`, one commit per module (shared, vault, context, importers,
   delivery), plus the error-code docs.
4. TSDoc backfill for `desktop/src/**` per D-6 (main/preload/shared, then renderer).
5. Flows: vault lifecycle (1–7, 19) → content (8–14) → import / connect / MCP / doctor (15–18) →
   conditional (20–21).
6. Cross-links, CONTRIBUTING, CI wiring, final `docs:check` green.

---

## 10. Biggest risk

**Volume turning into checkbox documentation.** Strict-from-day-one means writing roughly 265
TSDoc blocks (plus 36 error descriptions) and about 20 flows in one advance, and a presence check
cannot tell a useful sentence from `/** Handles the thing. */`. If the backfill is rushed, CI goes
green while the stated goal (a newcomer understands the business and the code) is not met, and the
mandate then makes bad docs permanent. Mitigations the plan should carry: D-7's "not just the name"
guard, D-15's required business sections, slicing per module so each slice is reviewable, and an
explicit reviewer spot-check of flow accuracy against `specs/*.md`. The close second risk is
**mechanism**. TS 7 may expose no compiler API (D-2), so the scanner must fail closed. Otherwise a
parser gap shows up as either a false green (the mandate is silently unenforced) or a false red
(CI blocked on valid code).
