Approved: Oscar 2026-10-19

# LIVING-DOCS — Execution plan

> Implementation must **not** begin until Oscar has reviewed this file and added an
> `Approved: Oscar <date>` line at the very top. `.claude/hooks/guard-implementation.sh` blocks
> every edit under `src/**`, `desktop/**`, `package.json`, `tsup.config.ts` and `tsconfig*.json`
> until that line exists. Slice 0 extends that gate to `tools/**` (D-1b) **before** any file under
> `tools/` is created. The branch is created only after the approval line exists. **This planner
> does not write that line.**

**Spec:** `advances/LIVING-DOCS/refined.md`. Gate R was approved by Oscar on 2026-10-19. Its table
"Gate R resolutions" is authoritative and overrides §5 wherever they disagree. Nothing in D-1…D-16 is
reopened here. The resolutions this plan implements:

| Decision | What the plan implements |
|---|---|
| **D-1 = B** | The generator lives in `tools/living-docs/{core,valija}/`. `tsconfig.json` and `vitest.config.ts` gain `tools/**`. Biome already covers `**`, so no change is needed there. |
| **D-1b** | Slice 0 extends `guard-implementation.sh` so it also gates `tools/**`. This is Oscar's explicit instruction. |
| **D-2 = A** | A dependency-free, fail-closed lexical scanner in the core: `core/infra/typescript-scanner.ts`. |
| **D-3 = A** | Hybrid discovery. CLI commands and MCP tools/prompts are read at **runtime** (`buildProgram(container)` and `InMemoryTransport`). Desktop channels, use cases, errors, wiring and call sites are read **statically**. `program.ts` is split into a side-effect-free `buildProgram` plus a thin entry, and the CLI output stays byte-identical. |
| **D-4 = A** | A dedicated `tsup` config builds the tool into a git-ignored folder. `docs` and `docs:check` build first, then run. |
| **D-5 = A** | `npm run docs:check` runs on every `ci.yml` matrix entry (3 OS × Node 22/24). The proposed change to CLAUDE.md's per-slice command is **Oscar's edit**. This plan only proposes it (see "Note for Oscar"). |
| **D-6 = A** | Coverage scope is `src/**` minus tests and `src/testing/`, plus all of `desktop/src/**` minus tests. See P-D14 for `desktop/src/renderer/testing/`. |
| **D-7** | Top-level exports only. The summary sentence must not just restate the name. A class doc covers its methods. No `@param`/`@returns`. Re-exports are exempt. |
| **D-8 = A** | Use cases, CLI commands, MCP tools, MCP prompts and IPC channels must each be cited by ≥ 1 flow. |
| **D-9** | Typed references `cli:`, `mcp:`, `prompt:`, `ipc:`, `err:`. Ambiguous symbol names fail until qualified. The exact qualifier form is in P-D6. |
| **D-10 = A** | Sources live in `docs/flows/`. Generated pages go to `docs/guide/`. |
| **D-11 = A** | Every error code carries a one-line doc, enforced. Codes that are never raised are shown, not failed. |
| **D-12 = A** | The parity table is enforced. A declared gap needs a reason, and relocate is the known gap. |
| **D-13 = A** | English everywhere. |
| **D-14 = A** | The extractor contract is data-only. The core does all rendering. |
| **D-15** | Required business and technical headings in every flow, enforced. |
| **D-16** | One sequence diagram per flow, a module-dependency flowchart, and a composition (wiring) flowchart. |

**Consequence of D-1 = B for §4.3.** Row 21 ("Keep the guide current") only existed if the generator
became a `src/` module with its own use cases. Under D-1 = B it does not, so row 21 drops out. Row 20
(preferences) is **in**, because D-8 = A requires every IPC channel to be cited. That makes **20
flows**.

---

## Branch

`feat/living-docs`, cut from `main`.

- The checkout is a detached HEAD at `2687da7`, and `main` is the only local branch.
- `desktop/` is present in this tree, so the GUI work this advance documents is already on the base.
  Unlike IMPORT-FEEDBACK, there is no stacked base to choose. See P-D1.
- The name follows CONTRIBUTING's `<type>/<short-descriptive-name>` and matches the earlier lowercase
  slugs (`feat/import-feedback`).

---

## Plan summary

There are fifteen slices, numbered 0–14. Each one is green on
`npm run typecheck && npm run lint && npm run test` at the root. Slices that touch `desktop/src/**`
must also pass `cd desktop && npm run typecheck && npm run test`.

`npm run docs:check` exists from Slice 5. It is **expected to be red** until Slice 14, because
strictness is the point and the backfill is still in progress. Each slice from 5 to 13 has a
**scoped exit criterion** instead: zero findings under the paths that slice owns. P-D10 describes
how that is measured. The CI step lands in Slice 14, so `main` is strict from the moment it merges.

| # | Slice | Proves |
|---|---|---|
| 0 | Process gate + build plumbing | `tools/**` is gated. tsconfig, vitest and the tsup config cover the tool. An empty tool builds. |
| 1 | Core domain: flows, references, catalogues, rules | Flow parsing, reference resolution, coverage rules and staleness are pure functions with fixture tests. |
| 2 | Core scanner + generic exports extractor | The fail-closed lexical scanner passes golden fixtures, including one over every real `src/**` and `desktop/src/**` file. |
| 3 | Core application + renderers + workspace + seam test | `GenerateGuide` renders a deterministic guide from in-memory facts. The seam test enforces "core imports nothing outside core". |
| 4 | `program.ts` → `buildProgram(container)` | `valija --help` and the help of all 12 commands are byte-identical before and after. |
| 5 | Valija extractors + composition + `docs` / `docs:check` | The tool runs over the real repo, the reference and architecture pages appear, and the list of findings is the backlog. |
| 6 | TSDoc: `shared` + `vault` (+ 20 vault error codes) | No findings under `src/shared`, `src/vault`. |
| 7 | TSDoc: `context` + `importers` (+ 16 error codes) | No findings under `src/context`, `src/importers`. |
| 8 | TSDoc: `delivery` | No findings under `src/delivery`. |
| 9 | TSDoc: `desktop/src/{main,preload,shared}` | No findings there. |
| 10 | TSDoc: `desktop/src/renderer` | No TSDoc findings remain anywhere. |
| 11 | Flows 1–7, 19 (vault lifecycle + multi-device) | Those flows are valid, and their use cases, commands and channels are covered. |
| 12 | Flows 8–14 (content) | Same, for those flows. |
| 13 | Flows 15–18, 20 (import, connect, MCP, doctor, preferences) | **No coverage findings remain.** |
| 14 | Cross-links, CONTRIBUTING, CI wiring, final green | `npm run docs:check` exits 0. CI runs it on the whole matrix. |

---

## Ground truth verified against HEAD (2026-10-19)

These anchors were read before planning. If any of them differs when implementation starts, the file
moved under this plan. Stop and re-anchor rather than editing by line number.

**Build and test plumbing**
- `tsup.config.ts` has a single entry, `{ program: "src/delivery/cli/program.ts" }`. It builds ESM for
  node22 with `clean: true` and keeps `better-sqlite3-multiple-ciphers`, `argon2` and
  `@napi-rs/keyring` external. `package.json` `bin.valija = "dist/program.js"`. **Consequence:**
  `program.ts` must stay the CLI entry file. The refactor moves the command definitions *out* of it
  (P-D3), so neither tsup nor `bin` changes.
- `tsconfig.json` has `include: ["src/**/*.ts"]` and `noEmit`. `desktop/tsconfig.json` and
  `desktop/tsconfig.web.json` both `extend` it but **override `include`**, so adding `tools/**/*.ts`
  at the root does not leak into the desktop typecheck.
- `vitest.config.ts` has `include: ["src/**/*.test.ts"]`. It must gain `"tools/**/*.test.ts"`.
- `biome.json` has `files.includes: ["**", "!dist", …]` and `vcs.useIgnoreFile: true`. `tools/**` is
  **already** linted. `.gitignore`'s `dist/` (no leading slash) matches any nested `dist/`, so
  `tools/living-docs/dist/` is git-ignored and Biome-ignored with **no** new ignore line.
- **Biome and `.md`: not verifiable here.** `node_modules` is not installed in this checkout. The repo
  already holds about 20 hand-written `.md` files with unaligned tables, and `npm run lint` is green on
  them. That strongly suggests Biome 2.5 does not process Markdown. Slice 5 verifies this (assumption
  A3) and adds `"!docs/guide"` to `biome.json` only if Biome turns out to touch it.
- `.github/workflows/ci.yml` has one job, `test`, over `os: [ubuntu, windows, macos] × node: [22, 24]`.
  Its steps are `npm ci → lint → typecheck → test → build`. `desktop.yml` is path-filtered to
  `desktop/**` and is not touched.
- `.gitattributes` sets `* text=auto eol=lf`.
- `.claude/hooks/guard-implementation.sh` line 37 gates
  `*/src/*|src/*|*/package.json|package.json|*/tsup.config.ts|*/tsconfig*.json|*/desktop/*|desktop/*`.
  It does **not** gate `tools/`, `vitest.config.ts`, `biome.json` or `.github/`.

**`program.ts` refactor surface**
- `src/delivery/cli/program.ts` (126 lines) has three module-scope side effects: `new Command()`,
  `const container = buildContainer()`, and `program.parseAsync().catch(…)`.
- `container` is touched **only inside `.action(...)` closures**. Building the command tree never
  reads it.
- No test or other file imports `program.ts`. The only references are `package.json` `bin` and
  `tsup.config.ts`.

**MCP surface**
- `buildMcpServer(c)` in `src/delivery/mcp/server.ts` registers 5 tools and 2 prompts. It touches `c`
  **only inside handler closures**, which is the same property `program.ts` has.
- `server.test.ts` already proves `InMemoryTransport.createLinkedPair()` plus `client.listTools()`
  works.

**Composition root**
- `src/delivery/container.ts` is shaped as recorded in refined §2.1: 15 `Container` keys, adapters
  built as `const x = new Adapter(...)` or passed inline, and `ImportItems` built but not exposed.
- Use-case constructor parameters are typed by **port names**, for example
  `private readonly store: VaultStore`. Wiring edges can therefore be computed as
  *use case →(port type)→ adapter* by matching argument position.

**Desktop IPC**
- `desktop/src/shared/ipc/channels.ts` holds `CHANNELS` (29 entries, `as const`) and `ChannelMap`.
  Only 1 of the 29 `ChannelMap` members has a doc comment.
- Handlers are object literals keyed by `"channel:name":` inside `create*Handlers(getContainer, …)`
  in `desktop/src/main/ipc/handlers/*-handlers.ts`.
- Use cases are reached as `getContainer().<key>.execute(` or `container.<key>.execute(`. Some go one
  hop through `src/delivery` helpers (`exportProjectMarkdown`, `exportProjectJson`, `runDiagnostics`).
  Some go through **non-exported, same-file** functions (for example `relocation-handlers.ts`).
- Some channels reach **no** use case: `sync:status` reads `folder.inspect()`, and so do `tools:*`,
  `preferences:*`, `dialog:*` and `vault:readRecoveryKit`.

**Error codes**
- `VaultErrorCode` has 20 codes, `ContextErrorCode` 8 and `ImporterErrorCode` 8, so 36 in total. No
  code appears in two unions, so `{{err:CODE}}` is never ambiguous today.
- Raise sites use `vaultErr(`, `vaultError(`, `contextErr(`, `importerErr(`, and in desktop
  `new DomainError("STORAGE_ERROR", …)`.

**Source-scanning tests the TSDoc backfill can break.** These are real tripwires, not hypothetical
ones:

| Test | What it forbids or parses | What it means for new comments |
|---|---|---|
| `desktop/src/shared/i18n/error-copy.test.ts` | Parses each `src/*/domain/errors.ts` union with `/type\s+\w*ErrorCode\s*=([\s\S]*?);/` and then `/"([A-Z0-9_]+)"/g`. | **An error-code doc comment must not contain `;`**, which would truncate the union. **It must not contain a double-quoted UPPER_CASE token**, which would invent a code. Write codes in backticks. |
| `desktop/src/main/infra/no-network-surface.test.ts` | Scans every non-test `.ts`/`.tsx`/`.css` in `desktop/src` for `http://`, `https://`, `fetch(`, `setInterval`, `XMLHttpRequest`, `crashReporter`. Comments are included. | No URL and none of those words in desktop TSDoc. |
| `desktop/src/main/ipc/handlers/import-no-reimplementation.test.ts` | Runs a substring check over the whole file, comments included, for `importers/infra/parsers/`, `importers/domain/services/`, `context/infra/item-repo`, and others. | Desktop TSDoc must not name those paths. |
| `desktop/src/renderer/screens/diagnostics.no-auto-run.test.ts` | `diagnostics.tsx` must not contain `useEffect` anywhere. | The comment on that screen must not say "useEffect". |
| `desktop/src/renderer/app.shell.test.ts` | `app.tsx` must not contain `NavBar` / `nav-bar`. | Same restriction for its TSDoc. |
| `desktop/src/renderer/screens/import-entry-points.test.ts` | `dashboard.tsx` must not contain `setView` / `workspace-nav`. | Same restriction for its TSDoc. |
| `desktop/src/main/infra/child-process-node-probe.test.ts` | The adapter must not contain `process.versions`. | Same restriction for its TSDoc. |

---

## Slice 0 — process gate and build plumbing

**Goal.** Before any file exists under `tools/`, the implementation gate covers it. The toolchain
(typecheck, test, build) can see an empty `tools/living-docs`.

**Order matters.** Do step 0.1 first, in its own commit, before creating anything under `tools/`.

0.1 **`.claude/hooks/guard-implementation.sh`** (D-1b, Oscar's explicit say-so):
   - Line 37 becomes
     `*/src/*|src/*|*/package.json|package.json|*/tsup.config.ts|*/tsconfig*.json|*/desktop/*|desktop/*|*/tools/*|tools/*)`.
   - The comment at lines 34–35 gains "`tools/**` (living-docs generator, LIVING-DOCS D-1b)".
   - **Manual check** (`.claude/` has no automated test). Run from a scratch directory that contains
     `advances/X/plan.md` **without** an `Approved:` line:
     `printf '{"tool_input":{"file_path":"tools/living-docs/x.ts"}}' | bash <repo>/.claude/hooks/guard-implementation.sh; echo $?`
     It must print `2`. Run it again with `file_path` set to `docs/x.md`. It must print `0`.
     Record both runs in `review.md`.
   - Whether `vitest.config.ts`, `biome.json` and `.github/workflows/**` should be gated too is
     **P-D15**. They are not gated by default.
0.2 **`tsconfig.json`**: `include: ["src/**/*.ts", "tools/**/*.ts"]`.
0.3 **`vitest.config.ts`**: `include: ["src/**/*.test.ts", "tools/**/*.test.ts"]`.
0.4 **New `tools/living-docs/tsup.config.ts`** (P-D4):
   ```ts
   import { defineConfig } from "tsup";

   /** Builds the living-docs generator (never shipped: output is git-ignored, see .gitignore `dist/`). */
   export default defineConfig({
     entry: { "living-docs": "tools/living-docs/valija/composition/main.ts" },
     outDir: "tools/living-docs/dist",
     format: ["esm"],
     target: "node22",
     platform: "node",
     clean: true,
     // Same native externals as the product build: loaded from node_modules, never bundled.
     external: ["better-sqlite3-multiple-ciphers", "argon2", "@napi-rs/keyring"],
   });
   ```
   Paths are relative to the repo root, because npm scripts run from there. `clean: true` only
   cleans its own `outDir`, so it can never touch the product's `dist/`.
0.5 **New `tools/living-docs/valija/composition/main.ts`**, as a stub that prints
   `living-docs: not wired yet` and exits 2. It exists only so the tsup config has an entry to build
   in this slice. Slice 5 replaces it.

**Tests.** No new automated test. The exit check is
`npx tsup --config tools/living-docs/tsup.config.ts --silent && node tools/living-docs/dist/living-docs.js`,
which must print the stub line. `git status` must show `tools/living-docs/dist/` as ignored.

**Est. production lines:** ~25 (config, stub, hook).

---

## Slice 1 — core domain: flows, references, catalogues, rules

**Goal.** Every documentation concept is a pure value or function with no I/O, and the tests use
in-memory fixtures. Determinism is a property of how values are **created**: every factory sorts
with a code-unit comparator (`a < b`), **never** `localeCompare`, because that one is locale- and
OS-dependent.

**Files** (all new, under `tools/living-docs/core/domain/`, each `x.ts` with a co-located
`x.test.ts`):

- `result.ts` is the core's own minimal `Result` / `ok` / `err` (about 6 lines). It deliberately
  mirrors `src/shared/domain/result.ts` without importing it, because the seam forbids the core from
  importing `src/`. It follows the same single-file exception the repo already has.
- `values/finding.ts`
  - `FindingRule` is a string union: `"undocumented-export" | "trivial-doc" | "broken-reference" |
    "ambiguous-reference" | "unknown-reference-kind" | "unreferenced-item" | "missing-section" |
    "malformed-flow" | "unscannable-source" | "stale-page" | "orphan-page" | "extractor-failure"`.
  - `Finding = { rule, file, line?, subject, message }`.
  - `createFinding(...)` is a total factory.
  - `compareFindings` gives a stable order: file, then line, then rule.
- `values/reference.ts`
  - `Reference = { kind: string | null; qualifier: string[]; name: string; raw: string }`.
  - `parseReference(raw, knownKinds): Result<Reference, string>` reads `{{kind:name}}`,
    `{{qualifier/…/Name}}` and `{{Name}}`.
  - Only a prefix listed in `knownKinds` counts as a kind. Everything else is a symbol. A colon in a
    symbol reference is an `unknown-reference-kind`.
- `values/documented-symbol.ts`
  - `DocumentedSymbol = { name, declaration: "class"|"function"|…, file, line, doc: string | null,
    requiresDoc: boolean }`.
- `values/catalogue.ts`
  - `ItemKey = { kind, name, label }`.
  - `Cell = { text; href?: string /* repo-relative path */; ref?: Reference }`.
  - `CatalogueRow = { key?: ItemKey; cells: Cell[] }`.
  - `Catalogue = { id, page, title, intro?, columns, rows }`.
  - `createCatalogue(...)` sorts the rows by key name, or by the first cell when there is no key. The
    extractor never has to remember to sort.
- `values/graph.ts`
  - `Graph = { id, page, title, direction: "LR"|"TD", nodes, edges }`.
  - `createGraph(...)` removes duplicate nodes and edges, then sorts them.
- `values/guide-page.ts`: `GuidePage = { path /* posix, relative to guide dir */; content }`.
- `values/guide-settings.ts`: `GuideSettings = { title, flowsDir, guideDir, themeOrder: string[] }`.
- `entities/flow.ts`
  - `FLOW_SECTIONS` defines the two levels (D-15):
    - **business:** `Who`, `Why`, `Business rules`, `What can go wrong`
    - **technical:** `Entry points`, `Steps`, `Errors`
  - `Flow = { slug, title, theme, sections: ReadonlyMap<string, SectionText>, steps: FlowStep[],
    references: LocatedReference[] }`.
  - `FlowStep = { number, from, to, text, references, line }`.
  - `parseFlow(path, text, knownKinds): Result<Flow, Finding[]>`. It does the following:
    - normalises `\r\n` to `\n`;
    - reads a minimal front matter with exactly two keys, `title:` and `theme:`, between `---` lines
      (P-D16);
    - splits the body on `## ` headings;
    - parses each step `N. [A → B] text` (both `→` and `->` are accepted), with steps numbered
      consecutively from 1;
    - collects every `{{…}}` in the file **with its line**.
  - It returns *every* problem it finds as findings, not just the first one.
- `entities/guide.ts` holds only the assembled read model the renderer consumes:
  `Guide = { settings, flows: ResolvedFlow[], catalogues, graphs, findings, stats }`.
- `services/reference-index.ts`
  - `buildReferenceIndex(symbols, catalogues)` indexes two things: symbols by name, and catalogue
    rows by `kind:name`.
  - `resolveReference(index, ref): Resolution | Finding` returns one of:
    - `broken-reference` when nothing matches;
    - `ambiguous-reference` when the name is exported from more than one file and the qualifier
      does not narrow it to one. The finding lists the candidate files, so the author knows what to
      write.
  - Qualifier rule (P-D6): the qualifier segments must appear **in order** among the declaring
    file's directory segments.
- `services/guide-rules.ts` holds three named rules, one per D-decision:
  - `findUndocumentedSymbols(symbols)` (D-7): when `requiresDoc` is set, the doc must be missing →
    `undocumented-export`, or trivial → `trivial-doc`. A doc is trivial when its first sentence,
    once tags are removed, is empty, or when lowercasing and dropping non-alphanumerics leaves it
    equal to the name or to the name split on camel case ("UnlockVault." and "Unlock vault." are both
    trivial).
  - `findUnreferencedItems(requirements, resolutions)` (D-8).
  - `findMissingSections(flow)` (D-15). It also enforces "Entry points names both CLI and desktop, or
    says why one is absent". The concrete check is that the `Entry points` section contains a
    `CLI:` line and a `Desktop:` line. Each line holds either a reference or prose explaining the
    absence (for example `Desktop: none — MCP-only flow`).
- `services/guide-assembly.ts`: `assembleGuide(facts, flows, settings): Guide`.
  - It merges all extractor facts and builds the index.
  - It resolves every flow reference.
  - It computes **back-links**: each keyed catalogue row gets a "Cited by" cell, listing the flows in
    slug order.
  - It runs the three rules and collects the findings and `stats` (exports documented, use cases
    covered, flows, broken references).
- `services/stale-pages.ts`: `findStalePages(expected: GuidePage[], actual: GuidePage[]): Finding[]`.
  - A page that differs → `stale-page`.
  - A page that is missing → `stale-page`.
  - An extra file in `docs/guide/**` → `orphan-page`.
  - All messages end in "run `npm run docs`".

**Tests.** Each file has its own co-located test. The cases that matter:
- `parseFlow`:
  - a missing section → a finding, and the line is reported;
  - steps out of order;
  - `->` and `→` are equivalent;
  - CRLF input parses the same as LF;
  - a step with no references is still a valid message.
- `parseReference`: `ipc:vault:unlock` gives kind `ipc` and name `vault:unlock`; an unknown kind is
  rejected.
- `resolveReference`:
  - an ambiguous name fails and lists both files;
  - `{{vault/UnlockVault}}` disambiguates;
  - a renamed symbol fails with `file:line`.
- `findUndocumentedSymbols`: `/** UnlockVault. */` and `/** Unlock vault */` are trivial; a real
  sentence passes.
- `createCatalogue` and `createGraph`: the output is identical for any input permutation (a
  property-style loop over shuffles).
- `findStalePages`: changed, missing and orphan pages are each reported.

**Est. production lines:** ~520.

---

## Slice 2 — the fail-closed lexical scanner and the generic exports extractor

**Goal.** D-2 = A, proven against golden fixtures **and against every real source file in scope**.
That proof is what turns the scanner's fail-closed rule into a demonstrated property instead of a
hope.

**Files** (new, under `tools/living-docs/core/infra/`):

- `typescript-scanner.ts`: `scanTypeScript(text, { jsx: boolean }): Result<ScannedFile, ScanFailure>`.
  - **States:** code, line comment, block comment, `'`/`"` string, template literal (with a stack of
    `${` depths), and regex literal. A regex is recognised when `/` follows an operator, an opening
    bracket, `,`, `;`, `=`, `:`, `!`, `?`, `&`, `|`, `return` or `typeof`. After an identifier,
    number, `)` or `]`, `/` is division.
  - **JSX rule:** a `'` or `"` string can never cross a newline in TypeScript. In `.tsx` mode, a quote
    that reaches a newline is treated as JSX text and the state resets. In `.ts` mode the same
    situation is an **error**. This keeps `<p>Don't…</p>` from desynchronising the scan.
  - **Depth tracking** covers `{}`, `()` and `[]`. Code tokens are recognised **only at depth 0**:
    - `import … from "x"` and `export … from "x"` give the import specifiers used by the module graph.
    - `export [default] [declare] [abstract] [async] (class|function[*]|interface|type|const|let|var|enum|namespace) Name`
      declares an export.
    - `export { … }` and `export * from` are **re-exports**. They are recorded as such and are exempt
      from the doc rule (D-7).
    - Non-exported top-level `function` and `const` declarations are recorded too, because the Valija
      call-reach service needs same-file helpers.
  - **Doc attachment:** the doc is the last `/** … */` block before the declaration, with only
    whitespace between them. Overloads that share a name are merged, and the doc of the first one
    counts.
  - **Output:** `ScannedFile = { declarations: ScannedDeclaration[]; imports: string[] }`.
    `ScannedDeclaration = { name, declaration, exported, reexport, line, doc, span }`. `span` holds
    two strings with identical offsets:
    - `source`, the verbatim declaration text;
    - `code`, the same text with comment and string *contents* blanked to spaces. Regex users can
      match on `code` without false hits from comments, and read string literals back from `source`.
  - **Fails closed** with a `ScanFailure { line, reason }` in five cases: end of file reached inside a
    comment, string, template or regex; a closing bracket with no opener; nonzero depth at the end;
    an `export` keyword at depth 0 followed by an unrecognised form; a newline inside a quote in
    `.ts` mode.
- `typescript-exports-extractor.ts`: `TypeScriptExportsExtractor implements Extractor`. Its
  constructor is `{ repoRoot, roots: string[], exclude: (posixPath) => boolean, docRequired: (posixPath) => boolean }`.
  - It walks the roots with `readdirSync` and **sorts** the entries.
  - It reads `.ts` and `.tsx` files, excluding `*.test.ts(x)`, `*.d.ts`, `__dom-tests__` and
    `**/testing/**` (configurable).
  - It scans each file:
    - a scan failure → an `unscannable-source` finding (`file:line`, never a silent pass);
    - otherwise, each export (re-exports excluded) → a `DocumentedSymbol`, with
      `requiresDoc = docRequired(path)`.
  - Paths are always posix and repo-relative, so Windows produces the same output.
  - It has **no Valija knowledge**. Roots and predicates come from the composition.

  Why this generic extractor lives in the core: TSDoc coverage over exports is meaningful in any
  TypeScript repo, and the extraction story (refined §1) wants it reusable.

**Tests** (`typescript-scanner.test.ts`, inline-string golden fixtures with no fixture files on disk,
see P-D17):
- **Template literals:**
  - `` `a ${ {b: `c ${d}`} } e` `` followed by `export const X`;
  - a template containing `export function`, which must **not** be found.
- **Regex literals:**
  - `/[{]/`, `/\/}/g`, and division chains `a / b / c`;
  - `x = y / 2; z = /}/` (division, then a regex).
- **Comments and strings:**
  - `// export const fake` and `/* { */`;
  - a string `"{"` that must not change depth.
- **Multi-line exports:** `export const f = (\n a,\n) => {\n …\n}`, `export type U =\n | "A"\n | "B";`,
  overloads, `export default function`, `export abstract class`, `export async function`,
  `export declare const`, generics such as `export function f<T extends Record<string, () => void>>()`.
- **JSX:** `<p>Don't close</p>` inside a component, `{'{'}` and JSX attributes containing `}`.
- **Re-exports:** they are recorded as such and exempt from the doc rule.
- **Fail-closed cases, each asserted to return `ScanFailure` with the line:**
  - an unterminated template;
  - an unterminated block comment;
  - one stray `}`;
  - `export =` (an unsupported form);
  - a `.ts` string broken by a newline.
- **Real-repo proof.** `typescript-scanner.repo.test.ts` scans **every** non-test `.ts`/`.tsx` under
  `src/` and `desktop/src/`. It asserts there are **zero failures**, and that the export count is
  within ±5% of a naive `^export ` line count, which catches silent under-counting. If any real file
  fails, the scanner is fixed in this slice. The real file is not edited to suit the scanner.

`typescript-exports-extractor.test.ts` builds a temp-dir tree with `mkdtemp`. It checks five things:
sorted output, posix paths, exclusions, `requiresDoc` driven by the predicate, and an unscannable
file turning into a finding.

**Est. production lines:** ~300 (scanner ~230, extractor ~70).

---

## Slice 3 — core application, renderers, workspace, seam test

**Goal.** The core is complete and Valija-free. Given in-memory facts and flows, it produces a
deterministic guide, and `check` mode reports staleness.

**Files:**

- `core/application/ports/extractor.ts` — **the seam (D-14)**, documented with TSDoc:
  ```ts
  /** Everything one extractor learned about a repository — data only, never Markdown (D-14). */
  export interface ExtractedFacts {
    readonly symbols: readonly DocumentedSymbol[];
    readonly catalogues: readonly Catalogue[];
    readonly graphs: readonly Graph[];
    /** "Every item of this kind/name must be cited by ≥ 1 flow" (D-8). */
    readonly requirements: readonly CoverageRequirement[];
    /** Problems only this extractor can see (e.g. parity gaps, undocumented error codes). */
    readonly findings: readonly Finding[];
  }

  /** The only contract a repository-specific extractor implements. No discovery, no plugins. */
  export interface Extractor {
    readonly name: string;
    extract(): Promise<ExtractedFacts>;
  }

  export interface CoverageRequirement { kind: string | null; names: readonly string[]; reason: string }

  /** Total factory: omitted parts are empty, so extractors only spell out what they found. */
  export function createExtractedFacts(parts: Partial<ExtractedFacts>): ExtractedFacts { … }
  ```
- `core/application/ports/guide-workspace.ts`: `GuideWorkspace` with three methods:
  `readFlowSources(): Promise<FlowSource[]>`, `readGuidePages(): Promise<GuidePage[]>` and
  `writeGuidePages(pages): Promise<void>`.
- `core/application/ports/guide-renderer.ts`: `GuideRenderer { render(guide: Guide): GuidePage[] }`.
- `core/application/dto/guide-report.ts`:
  `GuideReport = { findings: Finding[]; stats; pagesWritten: number }` plus
  `formatGuideReport(report): string[]`. That function produces the lines in §3.2 of the spec:
  `✗ <message>  <file>:<line>`, then either `N problems. Guide not up to date.` or the `✓ …` summary.
- `core/application/use-cases/generate-guide.use-case.ts`: `GenerateGuide`, a single use case with a
  mode (P-D8, following the `ImportConversations` precedent):
  ```ts
  async execute(input: { mode: "write" | "check" }): Promise<GuideReport> {
    const facts = await this.extractAll();              // each extractor isolated: a throw becomes an `extractor-failure` finding
    const flows = this.parseFlows(await this.workspace.readFlowSources());
    const guide = assembleGuide(facts, flows.parsed, this.settings);
    const pages = this.renderer.render(guide);
    const syncFindings = await this.syncPages(input.mode, pages); // check: findStalePages · write: writeGuidePages
    return createGuideReport([...flows.findings, ...guide.findings, ...syncFindings], guide.stats, …);
  }
  ```
  Extractors run **sequentially in their listed order**. That is deterministic, and the cost is
  small.
- `core/infra/file-guide-workspace.ts`: `FileGuideWorkspace implements GuideWorkspace`. Its
  constructor takes `{ repoRoot, flowsDir, guideDir }`.
  - **Reads:**
    - flow sources are `*.md` files in `flowsDir`, **excluding** `README.md` and files starting with
      `_` (P-D16), sorted;
    - guide pages are read recursively and sorted, and `\r\n` is normalised to `\n`.
  - **Writes, refusing anything unsafe:**
    1. A page path that is absolute, contains `..`, or does not end in `.md` → the write throws.
    2. Each file is written with `\n` endings and one trailing newline.
    3. An orphan is deleted **only** if it is a `.md` file under `guideDir` whose first line is the
       generated banner. Anything without the banner is left in place and reported as `orphan-page`.
  - It never writes outside `guideDir`.
- `core/infra/mermaid-diagrams.ts`:
  - `renderSequenceDiagram(steps)`:
    - participants appear in first-use order, each as `participant P1 as "User"`;
    - messages are `P1->>P2: 1. text`;
    - references are reduced to their labels;
    - Mermaid-breaking characters (`;`, `#`, `"`, `<`, `>`) are escaped as `#59;`-style entities.
  - `renderFlowchart(graph)`: `flowchart LR|TD`, nodes with sanitized ids, and edges with optional
    labels.
- `core/infra/markdown-guide-renderer.ts`: `MarkdownGuideRenderer implements GuideRenderer`. Its
  constructor takes `(settings)`.
  - **Every page:**
    - starts with the banner
      `<!-- Generated by tools/living-docs — do not edit. Run \`npm run docs\`. -->`;
    - has no timestamps and no absolute paths;
    - builds every link as a posix relative path from the page's own location.
  - **Pages it emits:**
    - `README.md`: the title, the overview (from the `_overview.md` source), "Understand the
      product" (flows grouped by `themeOrder`, business sections only, as links), and "I'm going to
      touch code" (architecture → reference pages → flows).
    - `flows/<slug>.md`, in this order:
      1. the business sections, verbatim, with references turned into links;
      2. `## How it works` with entry points, the Mermaid sequence diagram and a numbered step list
         with symbol links;
      3. the errors section, with each `err:` reference linked to its catalogue row.
    - one page per distinct `catalogue.page` / `graph.page`. Catalogues become tables. Keyed rows get
      `<a id="<kind>-<slug>"></a>` in their first cell and a trailing "Cited by" column.
  - **Symbol links point at the file, without a `#Lnn` anchor** (P-D5).
  - **Table cells** escape `|` and turn newlines into spaces.
- `core/seam.architecture.test.ts` — **the seam guard** (refined §6 "Seam"). Using `scanTypeScript`,
  it checks every `.ts` file under `tools/living-docs/core/` (tests included):
  - every import specifier is either relative **and resolves inside `core/`**, or starts with
    `node:`;
  - test files may also import `vitest`;
  - this single rule already rules out `src/**`, `../valija/**`, `commander`, the MCP SDK and
    `electron`. The failure message names the file and the specifier;
  - no `fetch(`, `node:http`, `node:https` or `node:net` appears in `core/` or `valija/`, which is
    the "no network" rule in refined §7.

**Tests:**
- `generate-guide.use-case.test.ts` uses in-memory fakes for the workspace, the extractors and the
  renderer. It covers:
  - `check` with a fresh guide → no findings;
  - `check` with a hand-edited page → `stale-page`;
  - `write` → pages written;
  - an extractor that throws → an `extractor-failure` finding, while the other extractors still run.
- `markdown-guide-renderer.test.ts`:
  - **golden output** for a tiny guide (one flow, one catalogue, one graph);
  - **determinism**: rendering twice gives identical bytes, and shuffled inputs give identical bytes;
  - the banner is on every page;
  - no page contains `\\`, `C:` or the temp dir path;
  - business sections come before `## How it works`.
- `mermaid-diagrams.test.ts`: the participants and message numbers match the steps exactly, and
  escaping works.
- `file-guide-workspace.test.ts` (temp dir):
  - a `..` path is refused;
  - an orphan without the banner is never deleted;
  - CRLF is normalised.

**Est. production lines:** ~520 (ports and DTO ~90, use case ~80, workspace ~80, Mermaid ~70, Markdown
renderer ~200).

---

## Slice 4 — `program.ts` → side-effect-free `buildProgram(container)` (D-3 = A)

**Goal.** Commander's registry can be built without parsing `process.argv` or building a real
container. The CLI is **byte-identical**. This is the only runtime-code change in the advance
(refined §7).

**Order of operations (do not reorder):**

4.1 **Capture before touching anything.**
   - Run `npm run build`.
   - For each argument in `--help`, `--version`, `init --help`, `unlock --help`, `lock --help`,
     `status --help`, `projects --help`, `show --help`, `search --help`, `export --help`,
     `import --help`, `install --help`, `mcp --help` and `doctor --help`, run
     `node dist/program.js <arg>` and store stdout and the exit code under the session scratchpad.
   - Also capture three error paths: `node dist/program.js install nope` (stderr and exit 1),
     `node dist/program.js bogus` (commander's unknown-command error) and
     `node dist/program.js show` (missing argument).
4.2 **New `src/delivery/cli/build-program.ts`.** It holds `export function buildProgram(container: Container): Command`
   with TSDoc. The body moves **verbatim** from `program.ts`: `new Command()`, `.name/.description/.version`
   and all 12 `.command(...)` chains, including the `install` action's
   `console.error` / `process.exit(1)`. The function returns `program`. It **never** calls `parseAsync`.
4.3 **`src/delivery/cli/program.ts`** becomes the thin entry. It keeps the shebang, and the file stays
   at the same path, so `tsup.config.ts` and `bin` are unchanged:
   ```ts
   #!/usr/bin/env node
   import { buildContainer } from "../container.js";
   import { buildProgram } from "./build-program.js";

   buildProgram(buildContainer())
     .parseAsync()
     .catch((error: unknown) => {
       console.error(`error: ${(error as Error).message}`);
       process.exit(1);
     });
   ```
   The original order was `new Command()`, then `buildContainer()`, then the chains. The new order is
   `buildContainer()`, then `new Command()`, then the chains. `new Command()` has no observable side
   effect, so the two orders are equivalent.
4.4 **Rebuild and diff** all of 4.1's captures. **Every** byte and exit code must match. Record the
   diff result (empty) in `review.md`.

**Tests.** New `src/delivery/cli/build-program.test.ts`:
- It builds with an **inert container**. That is a local `new Proxy({}, { get() { throw … } }) as Container`.
  The test does not import `tools/` from `src/`, which would invert the dependency.
- **The test asserts:**
  - building does not throw, which proves that construction never touches the container;
  - `program.commands.map(c => c.name())` equals the 12 names in their current order;
  - `program.helpInformation()` and each command's `helpInformation()` equal inline snapshots
    **pasted from 4.1's captures**, so the snapshot is the pre-refactor truth and not whatever the
    new code prints;
  - importing `build-program.js` does not parse argv. The test runs under vitest's own argv, and it
    would explode if parsing happened.

**Stays green.** The existing CLI tests (`vault-commands.test.ts`, `doctor.test.ts`,
`installer.test.ts`, `render.test.ts`) call the command functions directly, and none of them touch
`program.ts`.

**Est. production lines:** ~10 net (about 115 lines move, the entry shrinks to 9 lines, and the TSDoc
is about 6 lines).

---

## Slice 5 — Valija extractors, composition, npm scripts

**Goal.** `npm run docs` produces `docs/guide/**` from the real repo, and `npm run docs:check` lists
the backlog. After this slice, `docs/guide/reference/*` and `docs/guide/architecture.md` are
complete and correct. Only TSDoc, flows and error docs are missing.

**`valija/` is an adapter package.** It does not need a domain/application/infra stack of its own,
so its folders name kinds directly: `composition/`, `extractors/`, `surfaces/`, `services/`. That
follows the "no bare files" rule.

**Files** (new, under `tools/living-docs/valija/`, each with a co-located test):

- `surfaces/inert-container.ts`: `createInertContainer(): Container`.
  - It returns a `Proxy` whose `get` throws
    `living-docs never runs use cases (touched "<key>")`.
  - It is used for both `buildProgram` and `buildMcpServer`.
  - **It replaces "a container on a temp vault root" (P-D2).** No adapter is ever constructed, so
    there is nothing that *could* reach `~/.valija`, the keychain or the state root.
- `surfaces/cli-surface.ts`: `readCliCommands(): CliCommand[]`, at **runtime**.
  - It calls `buildProgram(createInertContainer())` and reads `program.commands` → `name()`,
    `description()`, `registeredArguments` (`name()`, `description`, `required`) and `options`
    (`flags`, `description`).
  - It is **static** for the link to use cases:
    - it scans `src/delivery/cli/build-program.ts`;
    - it segments `buildProgram`'s `span.source` at each `.command("<name>")`;
    - it gives each segment's code to `reachContainerKeys`.
  - If a runtime command has no matching static segment, or the reverse, that produces an
    `extractor-failure` finding (fail closed).
- `surfaces/mcp-surface.ts`: `readMcpSurface(): Promise<{ tools; prompts }>`, at **runtime**.
  - It calls `buildMcpServer(createInertContainer())` and connects through
    `InMemoryTransport.createLinkedPair()`.
  - It calls `client.listTools()` and `client.listPrompts()` to get the name, title, description and
    argument names/descriptions/required. Then it closes both ends.
  - **It never calls `callTool` or `getPrompt`.**
  - It is **static** for the use-case links: it segments `server.ts` at
    `registerTool(` / `registerPrompt(`.
- `surfaces/ipc-surface.ts`: `readIpcChannels(repoRoot): IpcChannel[]`. This one is **static only**,
  because root CI has no desktop dependencies.
  - It reads the string members of `CHANNELS` from `desktop/src/shared/ipc/channels.ts`, and the
    member doc (if any) plus the request/response type names from `ChannelMap`.
  - In `desktop/src/main/ipc/handlers/*-handlers.ts` it finds the object-literal key
    `"<channel>":` and segments the handler body.
  - **Fail closed:** a channel found in zero handler files, or in more than one, produces an
    `extractor-failure` finding.
- `services/use-case-reach.ts`: `reachContainerKeys(code, callables, depth = 2): string[]`.
  - It collects `\.(\w+)\.execute\(` hits in `code`, the masked text, so comments never match.
  - It follows calls to known callables for up to `depth` hops. A callable is either a same-file
    top-level function, or an exported function from `src/delivery/**`. Repeated callables are
    skipped, so cycles terminate.
  - `depth = 2` covers the deepest real chain, `export` → `exportCommand` → `exportProjectMarkdown`
    → `getContextPack`.
  - It also returns `containerKeyToUseCase` (for example `createVault` → `CreateVault`), read from
    `container.ts`'s `key: new Class(`.
- `services/surface-parity.ts`: `pairSurfaces(cli, ipc, declarations): { catalogue; findings }`
  (D-12).
  - **Automatic pairing:** a CLI command and a channel pair when they reach ≥ 1 common use case.
  - **Declared entries win over automatic pairing.** There are three kinds:
    `{ pair: [cli, ipc[]] }`, `{ surfaceSpecific: name, reason }` and `{ knownGap: names, reason }`.
  - A command or channel that is neither paired nor declared → a finding:
    `CLI command "x" has no desktop counterpart; pair it or declare it in valija-guide.ts`.
  - The MCP surface is excluded (CLAUDE.md).
- `extractors/use-cases.extractor.ts`: `UseCasesExtractor`.
  - It scans `src/*/application/use-cases/*.use-case.ts` for `export class X implements (Async)?UseCase<`.
  - It emits the `use-cases` catalogue: name (symbol-keyed), module, summary (the TSDoc first
    sentence) and file link.
  - It emits a requirement `{ kind: null, names: [all 13], reason: "use case" }`.
- `extractors/entry-points.extractor.ts`: `EntryPointsExtractor`. It composes the three surfaces,
  use-case reach and parity, and emits:
  - catalogues `cli`, `mcp-tools`, `mcp-prompts`, `ipc` and `parity`;
  - keyed rows of kind `cli`, `mcp`, `prompt` and `ipc`, with the columns description,
    arguments/options, handler file and "Reaches" (use-case symbol references);
  - requirements for all four kinds (D-8);
  - the parity findings;
  - the knowledge of which use cases each entry point reaches.
- `extractors/architecture.extractor.ts`: `ArchitectureExtractor`. It emits three things.
  - **Module map catalogue.** It walks `src/<module>/<layer>/<kind>/`. The table has one row per
    module, columns `domain | application | infra`, and lists the kind folders in each cell. Each
    module row links to `specs/<module>.md` when that file exists. `desktop` is included too
    (P-D13).
  - **Module dependency graph.** It is built from the scanner's import specifiers, resolved to their
    module. Type-only imports count. **Edges are shown as they are, without judgement.** This
    includes the `vault/application → vault/infra` observation in refined §2.3.
  - **Wiring graph plus table.** It reads `buildContainer`'s `span.source`:
    - `const x = new Adapter(` maps a variable to its adapter;
    - each `new UseCase(args)` gives argument positions, which are matched with the parameter types
      the scanner reads from that use case's `constructor(private readonly p: Port, …)`;
    - the result is edges `UseCase →|Port| Adapter`;
    - `ImportItems` → `ImportConversations` appears, even though it is not exposed on `Container`
      (AC);
    - non-class arguments (`parserRegistry`, `systemClock`, `ttlMinutes`) appear as plain nodes.
- `extractors/error-codes.extractor.ts`: `ErrorCodesExtractor`.
  - For each `src/*/domain/errors.ts`, it reads the `type XErrorCode =` declaration.
  - For each `"CODE"` member, it takes the description from the nearest `/** */` comment between the
    previous member and this one. That rule works whether Biome puts the comment before or after
    the `|`.
  - It emits **missing descriptions as `undocumented-export` findings** (D-11), with subject
    `VaultErrorCode › VAULT_LOCKED`.
  - **Raise sites:** it scans non-test files in `src/**` and `desktop/src/**` for
    `(vaultErr|vaultError|contextErr|importerErr)\("CODE"` and `new DomainError\("CODE"` on masked
    code with the string read back (P-D12). Sites are listed as **file links without lines** and
    deduplicated.
  - A code with no raise site is labelled "declared, never raised (statically)". It **does not**
    fail.
  - It emits one catalogue per module on page `reference/errors`, keyed `err:CODE`, and the known
    kinds list.
- `composition/valija-guide.ts` is **the single configuration point** (refined §6 "Seam"). It holds:
  - `VALIJA_GUIDE_SETTINGS`: title "Valija developer guide", `flowsDir: "docs/flows"`,
    `guideDir: "docs/guide"`, and `themeOrder`:
    `["Vault lifecycle", "Working with context", "Bringing history in", "Connecting AI tools", "Health and devices", "Desktop app"]`.
  - `VALIJA_PARITY`, the declarations, with an initial content based on the code read so far:

    | Declaration | Entry points |
    |---|---|
    | known gap: "`valija relocate` is owed to a future advance (CLAUDE.md)" | `relocation:preflight`, `relocation:move`, `relocation:retryClient`, `relocation:pointAtExisting`, `dialog:chooseVaultFolder` |
    | surface-specific: "AI tools spawn it; humans never run it" | `mcp` |
    | surface-specific: "desktop-only UI state" | `preferences:read`, `preferences:write` |
    | surface-specific: "the CLI takes a file path argument" | `dialog:chooseImportFile` |
    | pair | `install` ↔ `tools:status`, `tools:connect`, `tools:nodeStatus` |
    | pair | `doctor` ↔ `diagnostics:run`, `diagnostics:copyReport` |
    | pair | `init` ↔ `vault:readRecoveryKit` |
    | pair | `status` ↔ `sync:status` |
    | pair | `export` ↔ `content:copy` |

    The **final** list is whatever the first `docs:check` run proves is needed. Every entry needs a
    `reason` string.
  - `createValijaExtractors(repoRoot): Extractor[]`, which lists **explicitly**, in order:
    - `new TypeScriptExportsExtractor({ roots: ["src", "desktop/src"], exclude: tests/testing/__dom-tests__, docRequired: () => true })`
    - `UseCasesExtractor`
    - `EntryPointsExtractor`
    - `ArchitectureExtractor`
    - `ErrorCodesExtractor`
- `composition/main.ts` replaces the Slice 0 stub. In order, it:
  1. reads `process.argv[2]`, which must be `write` or `check`, else prints usage and exits 2;
  2. sets `repoRoot = process.cwd()` and checks that `tools/living-docs` exists there, else exits 2
     with "run from the repo root";
  3. wires `GenerateGuide(createValijaExtractors(repoRoot), new FileGuideWorkspace(…), new MarkdownGuideRenderer(settings), settings)`;
  4. prints `formatGuideReport`;
  5. exits with `findings.length === 0 ? 0 : 1`, or **2** on an unexpected throw. The throw prints
     its message only and never dumps the environment.
- **`package.json` scripts:**
  ```json
  "docs": "tsup --config tools/living-docs/tsup.config.ts --silent && node tools/living-docs/dist/living-docs.js write",
  "docs:check": "tsup --config tools/living-docs/tsup.config.ts --silent && node tools/living-docs/dist/living-docs.js check"
  ```
  No dependency is added.
- **New hand-written `docs/flows/README.md`** for authors. It says "Readers: go to
  [`docs/guide/`](../guide/README.md). This folder holds the sources." It also gives the syntax
  cheat-sheet.
- **New `docs/flows/_overview.md`**, the one-paragraph product summary rendered at the top of the
  guide's `README.md` (P-D16).
- **Run `npm run docs`** and commit `docs/guide/**`. At this point the flows are absent, so the guide
  has a README, the architecture page and the reference pages, and no flow pages.
- **Biome verification (A3).** Run `npx biome check docs/guide`.
  - If Biome reports that it processed `.md` and wants changes, add `"!docs/guide"` to
    `biome.json` `files.includes`, with a comment that the folder is generated and checked by
    `docs:check`.
  - Otherwise leave `biome.json` untouched, and record which case applied in `review.md`.

**Tests:**
- Each extractor and service has fixture tests built in temp dirs, for example: a 3-command
  `build-program.ts`, a handlers file with a same-file helper, a `container.ts` with an unexposed use
  case, an `errors.ts` with a missing description and with comments on both sides of `|`.
- `use-case-reach.test.ts`:
  - two hops are followed and a third is not;
  - a cycle terminates;
  - `.x.execute(` inside a comment is ignored.
- `surface-parity.test.ts`:
  - automatic pairing;
  - a declaration overrides automatic pairing;
  - an undeclared orphan → a finding;
  - a declaration without a reason is a type error, because `reason: string` is required.
- `cli-surface.test.ts` and `mcp-surface.test.ts` run against the **real** `buildProgram` and
  `buildMcpServer`. The MCP test asserts the tool names are **exactly** `get_context`,
  `list_projects`, `save_context`, `save_handoff`, `search_context` and the prompts are
  `load-context`, `save-context`. Adding an MCP tool then becomes a conscious test change
  (SPEC §7).
- `composition/valija-guide.smoke.test.ts`:
  - **Real-repo smoke.** It runs all extractors over the real repo, then asserts:
    - no `extractor-failure` or `unscannable-source` findings;
    - the catalogues *contain* (this is not an exact count, see A9) `cli:init`…`cli:doctor`, all 29
      `ipc:` keys, the 13 use cases and the 36 `err:` keys;
    - the wiring graph has an `ImportItems` node;
    - the parity catalogue shows relocate as a known gap.
  - **No-home-writes test (refined §7).**
    1. Set `VALIJA_HOME`, `VALIJA_STATE_HOME`, `HOME` and `USERPROFILE` to fresh, empty temp dirs.
    2. Run every extractor.
    3. Assert all four dirs are still empty, and that the inert container's `get` was never hit.
    4. Restore the environment in `finally`.
  - A static check asserts that no file under `tools/living-docs/valija/` contains `buildContainer`
    or `.execute(` outside string and comment text. The masked code from the scanner is what makes
    that check possible.

**Scoped exit criterion.** `npm run docs:check` reports **no** `extractor-failure`,
`unscannable-source`, `broken-reference` or `stale-page` findings. It is expected to report
`undocumented-export`, `trivial-doc` and `unreferenced-item` findings. Record their counts in the
commit message. That is the backlog the next eight slices pay down.

**Est. production lines:** ~950. The surfaces are ~200, the services ~140, the extractors ~420, and
the composition ~190, of which ~70 is parity and settings data. Docs: ~40 (flows README, overview).

---

## Slices 6–10 — TSDoc backfill (F-2, F-3, D-6, D-7, D-11)

**Shared rules for every backfill slice.** Reviewers check these.

1. **Write the doc a newcomer needs, not a restatement of the name.** The `trivial-doc` rule catches
   the worst cases, and review catches the rest.
   - **Use cases:** what the actor achieves, and the one invariant that matters most. Example:
     "Unlocks the vault: derives the key from the passphrase (or takes the recovery key), stores it
     in the OS keychain for this session, and reports a fork if another device wrote since."
   - **Ports:** what capability the port abstracts, and who implements it.
   - **Values:** what the value guarantees once parsed.
2. **Security-relevant comments restate existing guarantees exactly** (refined §7). This covers
   `vault/**`, `desktop/src/main/ipc/**`, `schemas.ts` and `preload/`.
   - Keys live only in the OS keychain.
   - Errors cross IPC as `{ code }` only.
   - No filesystem path originates in the renderer.
   - No comment suggests a weaker usage, such as "you can also pass the key directly". A reviewer
     reads every new comment in those folders against the code.
3. **Mind the tripwire table** in "Ground truth" above. In particular, error-code comments contain
   no `;` and no `"UPPER_CASE"` string, and desktop comments contain no URL.
4. **Comments only.** The diff of each slice is `/** … */` lines plus `docs/guide/**`. Check it with
   `git diff -U0 -- src desktop/src | grep '^[+-]' | grep -v '^[+-]\s*\(/\*\*\|\*\|\*/\)'`, which must
   print only file headers. Slice 8 is the exception: `build-program.ts` already gained its doc in
   Slice 4.
5. Biome may reflow comments. Run `npm run format`, then re-check.
6. At the end of each slice, run `npm run docs` and commit the regenerated guide (P-D11).

| Slice | Scope (non-test, D-6) | Approx. missing | Also in this slice |
|---|---|---|---|
| **6** | `src/shared/**`, `src/vault/**` | ~55 | 20 `VaultErrorCode` member docs. Use-case docs for CreateVault, LockVault, UnlockVault and VaultStatus. |
| **7** | `src/context/**`, `src/importers/**` | ~55 | 8 `ContextErrorCode` + 8 `ImporterErrorCode` member docs. Use-case docs for GetContextPack, ListProjects, SaveContext, SearchContext and ShowProject. |
| **8** | `src/delivery/**` | ~29 | `Container` and `buildContainer`, the MCP `buildMcpServer`/`runMcpServer`, the CLI command functions, `installer.ts` and `render.ts`. |
| **9** | `desktop/src/{main,preload,shared}/**` | ~70 | `shared/ipc/messages.ts` (~38), `register-handlers.ts`, and the handler factories. If P-D9 = A, also the 29 `ChannelMap` member one-liners. |
| **10** | `desktop/src/renderer/**` | ~56 | `components/icons.tsx` (~11), the screens, and `state/**`. |

The error-code doc format, Biome-stable:

```ts
export type VaultErrorCode =
  /** No vault exists at the resolved root — run `valija init` or point `VALIJA_HOME` at one. */
  | "VAULT_NOT_FOUND"
  /** The vault is locked: no key for it is in the OS keychain for this session. */
  | "VAULT_LOCKED"
  …
```

**Scoped exit criterion** for each slice: `npm run docs:check` lists **no** `undocumented-export` or
`trivial-doc` finding under that slice's paths (P-D10). For slices 9–10, also run
`cd desktop && npm run typecheck && npm run test`. That command is what catches a tripwire hit.

**Est. lines:** 0 production code. About 265 TSDoc blocks of roughly 2–3 lines each, plus 36
error-code one-liners, plus 29 channel one-liners if P-D9 = A, for **~650–750 comment lines**.

---

## Slices 11–13 — business flows (F-1, F-3, D-8, D-15)

**Flow source format.** This is the contract that `parseFlow` enforces:

```markdown
---
title: Unlock the vault
theme: Vault lifecycle
---

## Who
Anyone with the passphrase, or with the recovery kit, on a device where the vault lives.

## Why
…

## Business rules
- The key lives in the OS keychain, never on disk. …

## What can go wrong
- Wrong passphrase ({{err:WRONG_PASSPHRASE}}) …

## Entry points
- CLI: {{cli:unlock}}
- Desktop: {{ipc:vault:unlock}}

## Steps
1. [User → CLI] runs `valija unlock` and types the passphrase — {{cli:unlock}}
2. [CLI → UnlockVault] asks to unlock with the passphrase — {{UnlockVault}}
3. [UnlockVault → OS keychain] stores the derived key for this session — {{OsKeychain}}
…

## Errors
- {{err:WRONG_PASSPHRASE}} — the passphrase did not decrypt the vault header.
```

**Authoring rules:**
- Business sections are written in plain English, for non-developers.
- Every claim is checked against `specs/<module>.md` and the code. The reviewer spot-checks this
  (refined §6 "Backfill"). Two examples: `unlock` on a fork still unlocks and prints a notice, and
  imported items are excluded from packs.
- **Any example data is visibly fake**, for example `project: demo-project` or
  `passphrase: correct-horse-example`. No real key-hex, device id or path from anyone's machine.

| Slice | Flow sources (`docs/flows/<slug>.md`) | Covers (refined §4.3 rows) |
|---|---|---|
| **11** | `create-vault`, `unlock-vault`, `upgrade-vault-on-unlock`, `lock-vault`, `check-vault-status`, `idle-auto-lock`, `relocate-vault`, `multi-device-sync` | 1–7, 19 |
| **12** | `save-context`, `hand-off-conversation`, `load-context-pack`, `export-context-pack`, `search-context`, `list-projects`, `browse-project` | 8–14 |
| **13** | `import-chat-history`, `connect-ai-tool`, `serve-mcp`, `check-setup`, `desktop-preferences` | 15–18, 20 |

- **Row 6 (idle auto-lock)** has no entry point of its own. Its `Entry points` section says:
  `CLI: none — happens on the next command after the TTL` and
  `Desktop: none — the next IPC call refuses`.
- **Row 7 (relocate)** says `CLI: none — known gap, owed to a future advance (see parity table)`.
- **Row 20 (preferences)** says `CLI: none — desktop-only UI state`.

**Scoped exit criteria:**
- **After each slice:** no `broken-reference`, `ambiguous-reference`, `missing-section` or
  `malformed-flow` findings.
- **After Slice 11:** the 6 vault use cases and the vault commands and channels have no
  `unreferenced-item` findings.
- **After Slice 13:** **zero `unreferenced-item` findings overall.** At this point `docs:check`
  should be green apart from staleness, which goes away after `npm run docs`.

**Est. lines:** 0 production code. About 20 flows × ~55 lines, for **~1,100 hand-written Markdown
lines**. Generated `docs/guide/flows/*.md` are not counted.

---

## Slice 14 — cross-links, CONTRIBUTING, CI wiring, final green

**Files:**
- **`.github/workflows/ci.yml`:** add `- run: npm run docs:check` after `- run: npm test` and before
  `- run: npm run build`. Every matrix entry runs it (D-5). That is the cross-OS byte-stability
  proof.
- **`README.md` "Docs":** a new first bullet,
  `**[docs/guide/](docs/guide/README.md)** — developer guide: how Valija works, business flows and code map (generated).`
- **`docs/SPEC.md` §10:** one sentence after the dependency rule: "The generated
  [architecture page](guide/architecture.md) shows the current module map, dependency graph and
  composition wiring." The stale module tree at lines 157–162, which is missing `importers`, is
  **left alone**. It is out of scope, and see P-D18.
- **`specs/README.md`:** one sentence under "Module layout & dependency rule" pointing at
  `../docs/guide/architecture.md`.
- **`docs/gui.md`:**
  - one "How it works" link line in each of these sections: "Unlocking, and vault upgrades",
    "Browsing, searching, and taking a pack", "Connecting your AI tools", "Importing your chat
    history", "Diagnostics", "Moving your vault" and "Settings";
  - each line points at the matching `guide/flows/<slug>.md`.
- **`docs/sync.md`:** links to `guide/flows/multi-device-sync.md` and `guide/flows/idle-auto-lock.md`
  in the matching sections.
- **`CONTRIBUTING.md`:**
  - the module list becomes `shared`, `vault`, `context`, `importers` or `delivery`;
  - the dependency rule gains `importers → shared, context`, copied from `specs/README.md`;
  - a new section, **"How to add or update a flow"**, covers:
    - the source location and front matter;
    - the required sections;
    - step syntax and the reference kinds `{{Symbol}}`, `{{qualifier/Symbol}}`, `cli:`, `mcp:`,
      `prompt:`, `ipc:`, `err:`;
    - how to declare a parity gap;
    - `npm run docs` / `npm run docs:check`;
    - what CI checks;
    - "never edit `docs/guide/` by hand";
  - the quality-gates line gains `npm run docs:check`.
- **New `tools/living-docs/README.md`** (about 40 lines). It describes the core/valija seam, the
  extractor contract, the fact that there are no plugins and no network, and how a future extraction
  would lift `core/` out.
- **`CHANGELOG.md` `[Unreleased]`:** one `### Added` line (P-D19).
- **Final:** `npm run docs`, then `npm run typecheck && npm run lint && npm run test && npm run docs:check`
  must all exit 0. In `desktop/`, `npm run typecheck && npm run test` must pass.

**Est. lines:** ~1 YAML line, ~6 production lines in total. Docs: ~110 (CONTRIBUTING ~50, tools
README ~40, links ~20).

---

## Note for Oscar (D-5, not an edit this plan makes)

CLAUDE.md's per-slice command would become
`npm run typecheck && npm run lint && npm run test && npm run docs:check`. **That edit is Oscar's**,
and the main agent should propose it at the end of the advance. During Slices 5–13 that command would
be red by design (see P-D10). That is why the change belongs *after* Slice 14 merges.

---

## Test plan by layer, tied to `refined.md` §6

| Acceptance criterion (§6) | Proven by | Layer |
|---|---|---|
| `npm run docs` writes README (two entry points), architecture, reference, flow pages, each with a banner | `markdown-guide-renderer.test.ts` (golden + banner on every page); smoke run in Slice 5; committed `docs/guide/**` | core infra + real repo |
| Running `docs` twice gives no diff; no timestamps, no absolute paths, no OS separators | renderer determinism test (shuffled inputs, `\\`/`C:`/tmp-path absent); `createCatalogue`/`createGraph` permutation tests; `docs:check` on **all** 6 CI matrix entries (Slice 14) | core + CI |
| Generated Markdown passes `lint` unchanged (or is excluded with a reason) | Slice 5 Biome verification, recorded in `review.md` | process |
| Flow page: business before technical; sequence diagram matches steps; links resolve | renderer golden test (section order); `mermaid-diagrams.test.ts` (participants and numbers = steps); resolution through `reference-index.test.ts`; `broken-reference` = 0 at Slice 14 | core |
| Reference lists 12 commands, 5 tools + 2 prompts, 29 channels, 13 use cases with summaries + back-links | `valija-guide.smoke.test.ts` (contains-assertions); `guide-assembly.test.ts` (back-links); exact MCP set in `mcp-surface.test.ts` | Valija + core |
| Error catalogue covers all 36 codes with descriptions | smoke test (36 `err:` keys); `error-codes.extractor.test.ts` (missing description → finding; comment on either side of `\|`) | Valija |
| Architecture page: module × layer map, dependency diagram, wiring including `ImportItems` | `architecture.extractor.test.ts` (fixture with an unexposed use case); smoke (`ImportItems` node) | Valija |
| Parity table; relocate = known gap | `surface-parity.test.ts`; smoke (known-gap row) | Valija |
| Throwaway command + use case + error code appear after `docs` without hand edits | **Manual**, by the reviewer on a scratch branch (refined §6), plus fixture tests that add a 4th command / new use case / new code and see them in the catalogues | manual + Valija |
| Export without TSDoc → non-zero, names file and symbol | `typescript-exports-extractor.test.ts` + `guide-rules.test.ts` (`undocumented-export`, `trivial-doc`); `main.ts` exit code 1 | core |
| Uncited use case / command / tool / prompt / channel → non-zero | `guide-rules.test.ts` (`findUnreferencedItems`); requirements emitted by both Valija extractors (fixture tests) | core + Valija |
| Renamed/deleted cited symbol, command, tool, channel or code → non-zero with `file:line` | `reference-index.test.ts` (`broken-reference` carries the flow line) | core |
| Ambiguous symbol reference → non-zero | `reference-index.test.ts` (candidate files listed; qualifier resolves) | core |
| Hand-edited or stale guide → non-zero with a hint | `stale-pages.test.ts`; `generate-guide.use-case.test.ts` (check mode) | core |
| Flow missing a required section → non-zero | `flow.test.ts` + `guide-rules.test.ts` (`missing-section`) | core |
| Unscannable source → non-zero, never silent | `typescript-scanner.test.ts` fail-closed cases; exports extractor → `unscannable-source` | core |
| Each failure mode tested against fixtures | all of the above use inline or temp-dir fixtures | — |
| `docs:check` passes on the real repo at merge | Slice 14 final run; CI step | real repo |
| Every D-6 export has D-7 TSDoc, including the 9 use cases | `docs:check` = 0 `undocumented-export`/`trivial-doc`; reviewer reads the use-case docs | real repo + review |
| One flow per §4.3 row (1–20); all 13 use cases cited | `docs:check` = 0 `unreferenced-item` | real repo |
| Flow content matches behaviour | **Reviewer spot-check** against `specs/*.md` (fork-unlock notice; imported items excluded from packs) | review |
| Core and extractors in separate folders; core imports nothing else | `core/seam.architecture.test.ts` | architecture |
| Extractors listed in one configuration point; no discovery | `createValijaExtractors` is the only list; reviewer greps for `readdirSync` / `import(` in `composition/` (there are none) | review |
| Contract documented with TSDoc and the only thing extractors implement | `extractor.ts` TSDoc; every class under `valija/extractors/` `implements Extractor` (typecheck) | typecheck + review |
| `docs` / `docs:check` scripts; CI runs `docs:check` | `package.json`, `ci.yml` diff | review |
| `valija --help` and every command byte-identical after refactor | Slice 4.1/4.4 capture-and-diff (recorded in `review.md`); `build-program.test.ts` snapshots pasted from the pre-refactor capture | delivery + manual |
| README, SPEC §10, `specs/README.md`, `gui.md`, `sync.md` link to guide/flows; module sections link to specs | Slice 14 diff; renderer emits spec links (architecture extractor test) | docs |
| CONTRIBUTING has the flow how-to and the corrected module list | Slice 14 diff | docs |
| Root `typecheck/lint/test/docs:check` green; `desktop` `typecheck/test` green | final run of Slice 14 | gates |
| No new runtime or dev dependency | `package.json` diff touches `scripts` only | review |
| Generator never touches vault, keychain, home or state | `createInertContainer` (throws on any access); smoke no-home-writes test; static "no `buildContainer` / `.execute(` in `valija/`" | Valija |
| No network | seam test (no `fetch(` / `node:http(s)` / `node:net` in the tool) | architecture |

---

## Security-sensitive surfaces — the order that keeps them closed

1. **The gate comes first (Slice 0.1).** The hook is extended, and checked by hand, *before* the
   first file under `tools/` exists. No file in the tool can ever be written while it is ungated.
2. **Build the inert container before anything imports `src/delivery`** (Slice 5 order:
   `inert-container.ts` and its test, then `cli-surface.ts` and `mcp-surface.ts`).
   - The generator never calls `buildContainer`, so no adapter is ever constructed.
   - No `FileVaultStore`, `OsKeychain`, `FileDeviceIdentity` or `SqliteVaultSessions` exists in a
     docs run, and so no keychain access, key derivation or file under `~/.valija` or
     `~/.valija-state` is possible.
   - The static check in the smoke test keeps it that way.
3. **Introspection never invokes behaviour.** Commander actions are never triggered: there is no
   `parse`, `parseAsync` or `action` call. MCP use stops at `listTools` and `listPrompts`, never
   `callTool` or `getPrompt`. The inert Proxy is the tripwire: any accidental use-case call throws
   `living-docs never runs use cases`.
4. **Read-only on code. Writes are confined to `docs/guide/`.** `FileGuideWorkspace` refuses
   absolute paths, `..` and non-`.md` paths, and deletes only banner-carrying `.md` files inside
   `guideDir`.
5. **Only source-level facts are extracted:** names, descriptions, repo-relative file paths, error
   codes and TSDoc text.
   - There is no environment variable, home path or `process.cwd()` in output. The renderer test
     asserts that no absolute path appears.
   - `main.ts` prints only finding messages and, on a crash, `error.message`. It never prints
     `process.env`.
6. **Flows use visibly fake examples.** The reviewer checks that no key-hex, recovery text, real
   device id or real path appears in `docs/flows/**`. The repo already has a 64-hex detector idiom
   (`diagnostics-report.test.ts`). P-D20 proposes reusing it on the guide.
7. **No network, telemetry or AI service.** The seam test forbids the network APIs in `tools/`, and
   CI needs no secret.
8. **The MCP surface is unchanged.** `mcp-surface.test.ts` pins the exact 5 tools and 2 prompts.
   Descriptions are read, never edited, and `server.ts` gains only TSDoc (Slice 8).
9. **The `program.ts` refactor is behaviour-identical.** Capture before, diff after (4.1/4.4). The
   `install` action's `process.exit(1)` and the `error: <message>` printer keep their exact strings.
10. **TSDoc on security code** (rule 2 of the backfill): `vault/**`, `desktop/src/main/ipc/**`,
    `schemas.ts` and `preload/` comments are reviewed line by line against the code.
11. **After the last slice**, check `git diff --name-only main` against the tree below.
    - Any non-comment change under `src/` **other than** `src/delivery/cli/{program,build-program,build-program.test}.ts`
      means scope crept.
    - Any non-comment change under `desktop/src/` means scope crept.

---

## Architecture, naming and placement review

- **The seam is visible in the tree.** `tools/living-docs/core/` holds generic code and
  `tools/living-docs/valija/` holds Valija-specific code. The seam test makes that a rule, not a
  convention.
- **Core layering and the "no bare files" rule.**
  - Domain files sit in `values/`, `entities/` and `services/`.
  - Application files sit in `ports/`, `dto/` and `use-cases/`.
  - The only file at a layer root is `core/domain/result.ts`. It is the same well-known
    single-file exception as `shared/domain/result.ts`, and it exists because the core may not import
    `src/shared` (seam). See P-D7 if Oscar prefers `values/result.ts`.
  - The files at `core/infra/` are tech-named adapters: `typescript-scanner.ts`,
    `typescript-exports-extractor.ts`, `file-guide-workspace.ts`, `markdown-guide-renderer.ts` and
    `mermaid-diagrams.ts`. That is the CLAUDE.md exception.
- **The Valija package** has no domain of its own. It is adapters plus composition, so it uses kind
  folders directly: `extractors/`, `surfaces/`, `services/`, `composition/`. No file sits loose at
  `valija/`.
- **Tests at a folder root.** `core/seam.architecture.test.ts` and
  `valija/composition/valija-guide.smoke.test.ts` are cross-cutting tests, placed like
  `desktop/src/main/infra/no-network-surface.test.ts`. Neither is a production file.
- **Naming against repo conventions:**
  - **Use-case naming follows the code, not CLAUDE.md's wording.** CLAUDE.md says "`XUseCase`
    classes", but every real use case is named without the suffix (`LockVault`, `UnlockVault`) and
    lives in `*.use-case.ts`. So the new one is `GenerateGuide` in `generate-guide.use-case.ts`. The
    inconsistency is CLAUDE.md's and is flagged, not fixed.
  - **Extractors** are named `UseCasesExtractor` and so on, in `*.extractor.ts` files. That mirrors the
    `*.use-case.ts` suffix convention, so a folder listing tells you the kind.
  - **Adapters** are tech-named: `FileGuideWorkspace` (like `FileVaultStore`), `MarkdownGuideRenderer`
    and `TypeScriptExportsExtractor`.
  - **Parsing and factories:** `parseFlow` and `parseReference` return `Result` (parse, don't
    validate). `createCatalogue`, `createGraph`, `createFinding` and `createExtractedFacts` are total
    factories.
  - **Rules** are `findX` functions returning `Finding[]`, so each line reads as a sentence:
    `findUndocumentedSymbols(symbols)`, `findStalePages(expected, actual)`.
  - `buildProgram` matches the existing `buildContainer` and `buildMcpServer`.
- **Ubiquitous language of the tool:**
  - *flow*, *step*, *reference*, *symbol*, *catalogue*, *item key*, *requirement*, *finding*,
    *guide*, *page*, *extractor*, *facts*, *surface*, *parity*, *reach*.
  - The spec says "catalogue", so the code says `Catalogue`, not `Table`.
  - Valija's own terms (*use case*, *container*, *channel*, *command*, *error code*) appear **only**
    under `valija/`.
- **Readability.**
  - `GenerateGuide.execute` is a five-line narrative.
  - Every rule is a named function.
  - The largest files are the scanner (~230 lines) and the Markdown renderer (~200 lines). If the
    renderer grows past ~250, split the flow-page rendering into `markdown-flow-page.ts` rather
    than adding classes.
  - There are three classes in the core (the use case and two adapters, plus the exports extractor)
    and four in `valija/`. Everything else is functions and types.

---

## Assumptions — every one a place this plan could be wrong

- **A1 — Commander 15 exposes `registeredArguments`, `options[].flags` and `options[].description`.**
  This is true since commander 11. `node_modules` is absent here, so it is unverified. If the shape
  differs, `cli-surface.ts` adapts and the smoke test catches the mismatch.
- **A2 — The MCP SDK `^1.29` `Client.listPrompts()` returns `arguments[]` with name, description and
  required.** This matches the protocol, and `listTools` is already used in `server.test.ts`.
- **A3 — Biome 2.5 does not process `.md`.** The evidence is indirect: hand-written docs with
  unaligned tables pass `lint` today. Slice 5 verifies it, and the fallback is `"!docs/guide"`.
- **A4 — esbuild/tsup resolves `.js` specifiers to `.ts` for files under `tools/`, the same way it
  already does for `src/`.** If it does not, the fallback is the same tsup option the product build
  uses implicitly. No new dependency is needed.
- **A5 — Biome keeps a `/** … */` comment attached to the union member it precedes.** The
  error-code extractor is written to be indifferent to the comment's side of `|`, so this matters
  only for readability.
- **A6 — Nothing in `src/**` performs I/O at import time** besides `program.ts`, which this plan
  removes. This was verified for `src/delivery/**` (module-scope declarations are constants only).
  For the rest it is inferred from the conventions. The no-home-writes smoke test is the check.
- **A7 — GitHub honours `<a id="…">` row anchors in rendered Markdown.** It does, through its
  `user-content-` rewriting, but a GitHub sanitizer change would degrade only in-page jumps. Links
  still reach the right page.
- **A8 — The 12 / 5 + 2 / 29 / 13 / 36 inventory in refined §2.1 is current.** The counts were
  re-checked here for CLI, MCP, channels and error codes.
- **A9 — The smoke test asserts *contains*, not exact counts**, except for the MCP set, which is pinned
  on purpose. Otherwise every new command would need a smoke-test edit, and the `unreferenced-item`
  rule already forces a flow for it.
- **A10 — `desktop/src/renderer/testing/vitest-setup.ts` is test scaffolding**, excluded like
  `src/testing/` (P-D14).
- **A11 — The initial parity declarations are an informed guess.** They come from reading the
  handlers. The first `docs:check` run is authoritative, and each final entry carries a reason that
  the reviewer reads.
- **A12 — The ~265 / 36 / 20 volumes are from refined §2.2 heuristics.** Slice 5's first run gives
  the real backlog. If it is more than ~25% larger, the orchestrator should tell Oscar before
  Slice 6, because the slicing may need one more backfill slice.
- **A13 — Root CI keeps installing root dependencies only.** The tool never imports `desktop/**` at
  runtime, not even as types, so the root job works without `desktop/node_modules`.
- **A14 — `process.cwd()` is the repo root when `npm run docs` runs.** npm guarantees this for root
  scripts, and `main.ts` checks it.

---

## Decisions to confirm at Gate P

`refined.md`'s Gate R resolutions D-1…D-16 are closed and are **not** reopened here. Below is every
choice this plan had to make on its own. **P-D2, P-D3, P-D5, P-D9 and P-D10 are the ones that
matter.** The rest are low-stakes defaults.

- **P-D1 — Branch base.**
  - *Recommended:* `feat/living-docs` from `main`.
  - *Trade-off:* none known, since `desktop/` is already on `main` in this tree.
  - *Alternative:* if the session is again scoped to push a single pre-existing branch (the
    IMPORT-ENTRY precedent), commit there. The diff is identical.

- **P-D2 — How runtime introspection gets a `Container`.**
  - *Recommended:* an **inert Proxy container** that throws on any property access. `buildProgram`
    and `buildMcpServer` touch the container only inside action/handler closures, so construction
    succeeds and nothing real is ever built.
  - *Trade-off:* the type is a cast (`as Container`). It is safe only because those two builders
    never read the container eagerly, and the tests prove that.
  - *Alternative:* refined §7's literal wording, `buildContainer({ vaultRoot: tmp })` with
    `VALIJA_STATE_HOME=tmp`. That still constructs `OsKeychain`, `Argon2VaultCrypto` and
    `FileDeviceIdentity`. It is weaker, because it relies on no adapter doing I/O in its
    constructor.

- **P-D3 — Where `buildProgram` lives.**
  - *Recommended:* the new `src/delivery/cli/build-program.ts`, with `program.ts` reduced to the
    9-line entry. `tsup.config.ts` and `bin` stay untouched.
  - *Trade-off:* one more file in `cli/`.
  - *Alternative:* keep everything in `program.ts`, export `buildProgram`, and guard the
    `parseAsync` call with a "this module is the entry point" check (`import.meta.url` vs
    `process.argv[1]`). That check is brittle under `npx`, symlinked `bin`s and Windows paths, and
    those are exactly the places a byte-identical CLI matters.

- **P-D4 — Where the tool's build config and output live.**
  - *Recommended:* `tools/living-docs/tsup.config.ts` → `tools/living-docs/dist/`. The output is
    already git-ignored and Biome-ignored through `.gitignore`'s `dist/`, and everything stays inside
    the tool folder (good for extraction).
  - *Alternative:* root `tsup.docs.config.ts` → `.cache/living-docs/`. That keeps all tsup configs
    together, but needs a new `.gitignore` line, and the gate pattern `*/tsup.config.ts` would not
    match the new name.

- **P-D5 — Symbol links without line anchors.**
  - *Recommended:* link to the **file only**. A `#L42` anchor changes whenever someone edits lines
    above the export, so every unrelated edit would make `docs:check` fail and force a
    regeneration. That turns "guide stale" into noise.
  - *Trade-off:* the reader opens the file and searches for the symbol.
  - *Alternative:* line anchors, accepting the churn.

- **P-D6 — Qualified-reference syntax (D-9 left the form to the planner).**
  - *Recommended:* `{{seg/…/Name}}`, where the segments must appear in order among the declaring
    file's directories. Examples: `{{vault/UnlockVault}}` and `{{desktop/renderer/ImportScreen}}`.
    It is short, readable, and survives file renames inside a folder.
  - *Alternative:* the full repo path, `{{src/vault/application/use-cases/unlock-vault.use-case.ts#UnlockVault}}`.
    It is exact but long, and it breaks on every file move.

- **P-D7 — The core's `Result` type.**
  - *Recommended:* the core's own `core/domain/result.ts` (~6 lines), mirroring
    `src/shared/domain/result.ts`. The seam forbids importing `src/`.
  - *Trade-off:* two copies of a 4-line contract.
  - *Alternatives:* (a) place it at `core/domain/values/result.ts` to avoid a layer-root file;
    (b) no `Result`, with parsers returning `{ value, findings }`. Option (b) departs from the
    repo's `parseX → Result` convention.

- **P-D8 — One use case with a mode, or two.**
  - *Recommended:* a single `GenerateGuide.execute({ mode: "write" | "check" })`, following the
    `ImportConversations` `list | dry-run | import` precedent. It has one pipeline and cannot drift.
  - *Alternative:* `GenerateGuide` plus `CheckGuide` sharing an application service. Each has a
    clearer intent, but the pipeline is either duplicated or one use case depends on the other, which
    CONTRIBUTING forbids.

- **P-D9 — Descriptions for IPC channels.**
  - *Recommended:* **add a one-line doc to each of the 29 `ChannelMap` members and enforce it**, as
    D-11 does for error codes. Without it, the IPC reference is names and type names only. That is
    the "lookup table with no meaning" argument D-11 already accepted.
  - *Trade-off:* 29 more lines in Slice 9, and one requirement the spec did not spell out.
  - *Alternative:* show the doc when present (1 of 29 today) and enforce nothing. This is strictly
    within spec.

- **P-D10 — How slices 5–13 are "green" while `docs:check` is red by design.**
  - *Recommended:* no extra code. Each slice's exit criterion is "`npm run docs:check` prints no
    finding under this slice's paths", checked with `npm run docs:check | grep -E '<paths>'` returning
    nothing. The usual three commands must still pass. The finding count is written in each commit
    message, so progress shows.
  - *Trade-off:* the criterion is a grep, not an exit code.
  - *Alternative:* a `--scope <path-prefix>` flag on `check` (~10 lines) that turns that grep into a
    real exit code. It is more code in a tool that should stay small.

- **P-D11 — When the regenerated guide is committed.**
  - *Recommended:* at the end of **every** slice from 5 onwards, so each slice's diff shows its
    effect on the guide and review stays incremental.
  - *Alternative:* commit `docs/guide/**` only in Slice 14. That gives smaller intermediate diffs, but
    no slice before 14 can be reviewed as a reader would see it.

- **P-D12 — Which call patterns count as error "raise sites".**
  - *Recommended:* `vaultErr(`, `vaultError(`, `contextErr(`, `importerErr(` and
    `new DomainError("CODE"`. The last one is needed because desktop handlers raise
    `STORAGE_ERROR` that way.
  - *Alternative:* only the `xxxErr(` constructors, as refined §2.1 literally says. Desktop raise
    sites would then be invisible, and `STORAGE_ERROR` would under-report.

- **P-D13 — `desktop` in the module map and dependency graph.**
  - *Recommended:* include it as one node or row. It is a peer surface, and its edges into `src/`
    are the most important ones for a newcomer.
  - *Alternative:* `src/` modules only, as SPEC §10 frames them.

- **P-D14 — `desktop/src/renderer/testing/` coverage.**
  - *Recommended:* exclude it, mirroring D-6's exclusion of `src/testing/`. The rule is "any
    `testing/` folder".
  - *Alternative:* include it. It has 0–1 exports today, so this costs nothing either way.

- **P-D15 — Gate scope beyond `tools/**`.**
  - *Recommended:* gate **only** `tools/**`, exactly what Oscar ordered in D-1b.
  - *Alternative:* also gate `vitest.config.ts`, `biome.json` and `.github/workflows/**`. This
    advance edits all three, and none is gated today. It is Oscar's config call.

- **P-D16 — Flow metadata and the guide's product summary.**
  - *Recommended:* a two-key front matter (`title:`, `theme:`) parsed line by line, with no YAML
    dependency. `docs/flows/_overview.md` holds the summary paragraph for the guide `README.md`, and
    files starting with `_` plus `README.md` are not flows.
  - *Alternative:* an H1 title with a `Theme:` line, and the summary as a string in
    `valija-guide.ts`. That puts prose in TypeScript.

- **P-D17 — Test fixtures.**
  - *Recommended:* inline strings and `mkdtemp` trees only, with **no fixture `.ts` files on disk**.
    Intentionally broken fixture files under `tools/` would fail the repo's own `typecheck` and
    `lint`.
  - *Alternative:* fixture files under a folder excluded from tsconfig and Biome. That means more
    config edits.

- **P-D18 — SPEC §10's stale module tree.** It lists `shared`, `vault`, `context` and `delivery`,
  without `importers`.
  - *Recommended:* leave it. Refined §4.1 item 8 asks only for a pointer to the guide, and the
    generated architecture page becomes the source of truth.
  - *Alternative:* add the `importers/` line too. It is one line, but it is a SPEC edit beyond the
    spec's scope.

- **P-D19 — CHANGELOG.**
  - *Recommended:* one line under `[Unreleased] → Added`: "A generated developer guide
    (`docs/guide/`) checked in CI by `npm run docs:check`." `[Unreleased]` already records repo-level
    changes such as Desktop.
  - *Alternative:* no entry, because nothing user-facing or in the npm package changes.

- **P-D20 — A secret-shape tripwire on the guide.**
  - *Recommended:* yes. `valija-guide.smoke.test.ts` asserts that no committed
    `docs/guide/**` or `docs/flows/**` file matches `/[0-9a-f]{64}/i` (the existing key-hex idiom).
    It costs ~6 test lines.
  - *Alternative:* rely on the reviewer alone.

---

## Repo structure after execution

`NEW` marks new files and `CHANGED` marks changed ones. Unchanged anchors are shown only for
orientation. `(comments)` means TSDoc-only edits.

```
valija/
├── .claude/hooks/
│   └── guard-implementation.sh                CHANGED (Slice 0: also gates tools/** — D-1b)
├── .github/workflows/
│   ├── ci.yml                                 CHANGED (Slice 14: `npm run docs:check` on all 6 matrix entries)
│   └── desktop.yml                            UNCHANGED
├── advances/LIVING-DOCS/
│   ├── refined.md                             UNCHANGED
│   ├── plan.md                                this file (gains Oscar's `Approved:` line)
│   └── review.md                              later (records hook check, help diff, Biome/md result)
├── biome.json                                 CHANGED only if A3 fails ("!docs/guide")
├── package.json                               CHANGED (scripts: docs, docs:check — no dependency)
├── tsconfig.json                              CHANGED (include += tools/**/*.ts)
├── vitest.config.ts                           CHANGED (include += tools/**/*.test.ts)
├── tsup.config.ts                             UNCHANGED (entry still src/delivery/cli/program.ts)
├── README.md                                  CHANGED (Docs: developer guide link)
├── CONTRIBUTING.md                            CHANGED (module list + importers rule, "How to add or update a flow", docs:check gate)
├── CHANGELOG.md                               CHANGED (P-D19)
├── specs/README.md                            CHANGED (link to guide architecture)
├── docs/
│   ├── SPEC.md                                CHANGED (§10: one sentence linking the architecture page)
│   ├── gui.md                                 CHANGED ("How it works" links to flows)
│   ├── sync.md                                CHANGED (links to multi-device-sync, idle-auto-lock flows)
│   ├── vault-format.md                        UNCHANGED
│   ├── flows/                                 NEW — hand-written sources (D-10)
│   │   ├── README.md                          NEW (for authors: syntax; readers → docs/guide/)
│   │   ├── _overview.md                       NEW (product summary for the guide index)
│   │   ├── create-vault.md · unlock-vault.md · upgrade-vault-on-unlock.md · lock-vault.md
│   │   ├── check-vault-status.md · idle-auto-lock.md · relocate-vault.md · multi-device-sync.md   (Slice 11)
│   │   ├── save-context.md · hand-off-conversation.md · load-context-pack.md · export-context-pack.md
│   │   ├── search-context.md · list-projects.md · browse-project.md                               (Slice 12)
│   │   └── import-chat-history.md · connect-ai-tool.md · serve-mcp.md · check-setup.md
│   │       · desktop-preferences.md                                                             (Slice 13)
│   └── guide/                                 NEW — GENERATED, committed, never hand-edited
│       ├── README.md                          (two entry points)
│       ├── architecture.md                    (module map, dependency flowchart, wiring flowchart + table)
│       ├── reference/
│       │   ├── cli.md · mcp.md · ipc.md · use-cases.md · errors.md · parity.md
│       └── flows/
│           └── <the 20 slugs above>.md
├── tools/                                     NEW top-level (gated by the hook from Slice 0)
│   └── living-docs/
│       ├── README.md                          NEW (seam, contract, no plugins/network)
│       ├── tsup.config.ts                     NEW (→ tools/living-docs/dist/, git-ignored)
│       ├── dist/                              (build output, git-ignored, never committed)
│       ├── core/                              NEW — generic, imports only itself + node:*
│       │   ├── seam.architecture.test.ts
│       │   ├── domain/
│       │   │   ├── result.ts
│       │   │   ├── values/
│       │   │   │   ├── finding.ts (+test) · reference.ts (+test) · documented-symbol.ts
│       │   │   │   ├── catalogue.ts (+test) · graph.ts (+test) · guide-page.ts · guide-settings.ts
│       │   │   ├── entities/
│       │   │   │   ├── flow.ts (+test)
│       │   │   │   └── guide.ts
│       │   │   └── services/
│       │   │       ├── reference-index.ts (+test) · guide-rules.ts (+test)
│       │   │       └── guide-assembly.ts (+test) · stale-pages.ts (+test)
│       │   ├── application/
│       │   │   ├── ports/
│       │   │   │   ├── extractor.ts           (THE SEAM — Extractor, ExtractedFacts, CoverageRequirement)
│       │   │   │   ├── guide-workspace.ts
│       │   │   │   └── guide-renderer.ts
│       │   │   ├── dto/
│       │   │   │   └── guide-report.ts (+test)
│       │   │   └── use-cases/
│       │   │       └── generate-guide.use-case.ts (+test)
│       │   └── infra/
│       │       ├── typescript-scanner.ts (+test, +repo.test)
│       │       ├── typescript-exports-extractor.ts (+test)
│       │       ├── file-guide-workspace.ts (+test)
│       │       ├── markdown-guide-renderer.ts (+test)
│       │       └── mermaid-diagrams.ts (+test)
│       └── valija/                            NEW — the only code that knows commander/MCP/Container/CHANNELS
│           ├── composition/
│           │   ├── valija-guide.ts            (THE configuration point: settings, parity, extractor list)
│           │   ├── valija-guide.smoke.test.ts (real repo, no-home-writes, secret-shape tripwire)
│           │   └── main.ts                    (entry: write | check → exit 0/1/2)
│           ├── extractors/
│           │   ├── use-cases.extractor.ts (+test)
│           │   ├── entry-points.extractor.ts (+test)
│           │   ├── architecture.extractor.ts (+test)
│           │   └── error-codes.extractor.ts (+test)
│           ├── surfaces/
│           │   ├── inert-container.ts (+test)
│           │   ├── cli-surface.ts (+test)     (runtime: buildProgram)
│           │   ├── mcp-surface.ts (+test)     (runtime: InMemoryTransport, list only)
│           │   └── ipc-surface.ts (+test)     (static: channels.ts + handlers)
│           └── services/
│               ├── use-case-reach.ts (+test)
│               └── surface-parity.ts (+test)
├── src/
│   ├── delivery/
│   │   ├── cli/
│   │   │   ├── program.ts                     CHANGED (Slice 4: thin entry — shebang, buildProgram(buildContainer()).parseAsync())
│   │   │   ├── build-program.ts               NEW (Slice 4: buildProgram(container) — the 12 commands, moved verbatim)
│   │   │   ├── build-program.test.ts          NEW (inert container; help snapshots from pre-refactor capture)
│   │   │   └── *.ts                           CHANGED (comments, Slice 8)
│   │   ├── mcp/server.ts                      CHANGED (comments only — MCP surface unchanged)
│   │   └── container.ts · diagnostics.ts · context-pack-*.ts · version.ts   CHANGED (comments)
│   ├── shared/**                              CHANGED (comments, Slice 6)
│   ├── vault/**                               CHANGED (comments, Slice 6; domain/errors.ts: 20 code docs)
│   ├── context/**                             CHANGED (comments, Slice 7; domain/errors.ts: 8 code docs)
│   ├── importers/**                           CHANGED (comments, Slice 7; domain/errors.ts: 8 code docs)
│   └── testing/**                             UNCHANGED (out of scope, D-6)
└── desktop/
    ├── package.json · tsconfig*.json · vitest.config.ts       UNCHANGED
    └── src/
        ├── main/** · preload/** · shared/**   CHANGED (comments, Slice 9; channels.ts: 29 member docs if P-D9 = A)
        ├── renderer/**                        CHANGED (comments, Slice 10)
        └── renderer/testing/**                UNCHANGED (P-D14)
```

**Reviewer's file-scope check.** Outside `tools/`, `docs/`, root config and the doc files listed
above, `git diff --stat main` may show changes only in the following places:
- `src/delivery/cli/{program,build-program,build-program.test}.ts`, with code changes;
- every other `src/**` and `desktop/src/**` file, with **comment-only** changes (backfill rule 4).

---

## Estimated line count and risks

### Lines

| Slice | Production TS | Tests | Comments (TSDoc) | Hand-written docs |
|---|---|---|---|---|
| 0 — gate + plumbing | ~25 | — | — | — |
| 1 — core domain | ~520 | ~450 | — | — |
| 2 — scanner + exports extractor | ~300 | ~350 | — | — |
| 3 — core application + infra + seam | ~520 | ~400 | — | — |
| 4 — `buildProgram` refactor | ~10 net | ~70 | ~6 | — |
| 5 — Valija extractors + composition | ~950 | ~550 | — | ~40 |
| 6–10 — TSDoc backfill | 0 | 0 | ~650–750 | — |
| 11–13 — flows | 0 | 0 | — | ~1,100 |
| 14 — links, CI, CONTRIBUTING | ~6 | — | — | ~110 |
| **Total** | **≈2,330 production lines** | **≈1,820** | **≈700** | **≈1,250** |

`docs/guide/**` is generated and committed, an estimated ~3,000 lines, and is not counted. The tool
is ≈2,330 lines against the ~200-line prototype. The growth is the fail-closed scanner, the seam,
determinism, the safety rails and the D-12 parity logic, all of which the prototype lacked.

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Checkbox documentation.** About 265 TSDoc blocks plus 20 flows get written to turn CI green, not to teach (refined §10). | **Highest** | `trivial-doc` rule; backfill rule 1 with examples; one module per slice so review stays readable; reviewer spot-check of flows against `specs/*.md`; A12's "tell Oscar if the backlog is >25% larger" checkpoint |
| **The scanner mis-reads valid code.** That gives a false red, or a silent false green on under-counting. | High | Fail-closed design; golden fixtures for every tricky construct; `typescript-scanner.repo.test.ts` scans **every real file** with zero failures plus a ±5% export-count cross-check; scanner fixed in Slice 2, real code never bent to it |
| **The TSDoc backfill trips an existing source-scanning test.** Examples: a `;` in an error-code doc truncating `error-copy.test.ts`'s union regex, or a URL in a desktop comment. | High (silent until the desktop suite runs) | Tripwire table in "Ground truth"; backfill rule 3; `cd desktop && npm run test` mandatory for slices 9–10 **and** 6–7 (error codes are parsed by a desktop test) |
| **Output differs across OS** (separators, `readdir` order, CRLF, locale sort) and only Windows CI notices. | Medium | Posix paths everywhere; every directory listing sorted; `\r\n` normalised on read; `<` comparator, never `localeCompare`; `docs:check` on all 6 matrix entries |
| **The `program.ts` refactor changes CLI output subtly.** Examples: help wrapping, the order of `buildContainer` and `new Command()`. | Medium | Capture-before / diff-after over 13 help outputs plus 3 error paths; snapshots pasted from the pre-refactor capture |
| **`docs:check` stays red for 9 slices**, and someone "fixes" it by loosening a rule. | Medium | P-D10's scoped criterion; the finding count in every commit message; no rule may change after Slice 5 without going back to Gate P |
| **Line-anchor or summary churn makes "guide stale" a constant chore.** | Medium | P-D5 (no line anchors); only TSDoc *first sentences* and catalogue facts reach the guide |
| **Biome processes `.md`** and fights the generator. | Low | Slice 5 verification; `"!docs/guide"` fallback with its reason |
| **Commander or MCP SDK API shape differs from A1/A2.** | Low | Smoke tests fail loudly in Slice 5; adapt the two surface files only |
| **The parity declarations grow into a dumping ground.** | Low | `reason` is required; reviewer reads each; relocate is the only *known gap* |
| **The orphan-page deleter removes something a human put in `docs/guide/`.** | Low | Only banner-carrying `.md` files are deleted; anything else is reported, never removed |

---

**Gate P.** Implementation must not begin until Oscar has reviewed this plan and recorded approval as
an `Approved: Oscar <date>` line at the top of this file. The branch (`feat/living-docs`, P-D1) is
created only after that line exists. Slice 0.1 (the hook) is the first edit.
