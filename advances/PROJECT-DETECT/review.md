Verdict: PASS

# PROJECT-DETECT — Change review

**Reviewed:** `git diff feat/curation-CURATION...HEAD` on `feat/project-detect-PROJECT-DETECT`
(11 commits, a31905a … 040085e; base `a2b9301`).
**Against:** `advances/PROJECT-DETECT/refined.md` (Gate R approved, D-A…D-S defaults) and
`advances/PROJECT-DETECT/plan.md` (`Approved: Oscar 2026-10-19`, P-1…P-16 defaults).
**Reviewer runs (this session):**
- Root: `npm run typecheck && npm run lint && npm run test` gave 79 files and **627 tests passed**.
  The lint run's one `info` is the pre-existing `biome.json` "recommended deprecated" notice. This
  diff does not touch `biome.json`.
- Desktop: `cd desktop && npm run typecheck && npm run lint && npm run test` gave 70 files and
  **1097 tests passed**.
- Plan Slice 9 checks:
  - `git diff --exit-code` on `expected-pack.md`, `expected-export.md`, `expected-search.json`,
    `context-pack-markdown.ts`, `context-pack.ts` and `item-repo.ts` is **empty**.
  - No `console.*` in `src/context`.
  - `VALIJA_PROJECT` is not read anywhere in `desktop/src` (it appears in catalog copy only).
  - No `valija-state`/`state.json` reference in detection code.

## Ritual evidence

| Step | Evidence | OK |
|---|---|---|
| refined.md, Gate R | `refined.md:3-4` "Gate R approved by Oscar, 2026-10-18"; commit a31905a | yes |
| plan.md with `Approved:` | `plan.md:1` `Approved: Oscar 2026-10-19 — …`; commit f3d3f7d precedes every `src/**` commit | yes |
| spike (Slice 0) | `spike.md` commit 58fc9fe, before any code | yes |
| review.md | this file | yes |

## Acceptance criteria (refined.md §12)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| R1 | An explicit project behaves byte-identically, auto-create included | **met** | `src/delivery/project-detection.ts:34` returns at once (no session, probe or env read). `server.ts` `projectFor` skips roots when `explicit !== undefined`. `detectionNote` is `""` with no `detectedBy`. Tests: `server.detection.test.ts` case 2 (exact text, roots handler never called, auto-create); `binding-commands.test.ts:294` |
| R2 | Precedence is exactly D-E; a sub-folder folder binding beats the repo | **met** | `project-resolution.ts` `bindingFor` (deepest folder, then repository). `resolve-project.use-case.ts` puts env ahead of bindings. Tests: `project-resolution.test.ts`, `resolve-project.use-case.test.ts`, `binding-commands.test.ts:161`, `server.detection` 6/6b |
| R3 | No match gives `PROJECT_NOT_DETECTED`; two roots give `PROJECT_AMBIGUOUS` with slugs only | **met** | `project-detection.ts:43-51`. `server.detection` cases 4, 4b, 5 and the privacy sweep (case 9) |
| R4 | Detection never creates a project; a name-match only produces a hint | **met** | `resolve-project.use-case.ts` `existingHint` (only `findByName`). `LinkWorkspace` returns `PROJECT_NOT_FOUND` and the test checks the project is still absent (`bindings-handlers.test.ts:134` as well) |
| R5 | A locked vault gives `VAULT_LOCKED` for detected calls and every binding verb | **met** | Every new use case calls `withSession` before the probe. Tests: link `:168`, unlink `:105`, resolve `:197` (with and without env, probe never called), list `:60`, CLI `binding-commands.test.ts:238`, MCP `server.detection` case 8. Roots are requested before the session (plan A2, accepted) |
| C1 | `which`/`link`/`unlink`/`links` follow §5.2 with all six error codes | **met** | `src/delivery/cli/binding-commands.ts`, `program.ts:126-163`. `binding-commands.test.ts:112-248` covers each rejection code and the "not both" guard |
| C2 | `link` makes one lineage bump; re-linking the same target makes none | **met** | `link-workspace.use-case.ts` has one `session.write` and `alreadyBound` returns before any write. Tests `link-workspace.use-case.test.ts:66-79` (`before + 1`) and `:50-52` (unchanged); `binding-commands.test.ts:152` |
| C3 | `show`/`export` with no project resolve by detection; `search`/`import` unchanged | **met** | `content-commands.ts` `projectFor`. `program.ts` diff leaves `search -p` and `import -p` untouched. Tests `binding-commands.test.ts:257-305` (byte-equal show/export, vault-wide search) |
| M1 | Still 5 tools and 2 prompts; `project` optional on the three tools; no other schema change | **met** | `server.test.ts:241-251` pins the `required` arrays. The existing property-key assertion is unchanged. `search_context` is untouched |
| M2 | A detected save names project and kind, with no path or remote; explicit text unchanged | **met** | `server.ts` `detectionNote`. `server.detection` cases 1, 2, 6 and the sweep (case 9: temp root, repository, `github.com`, `file:`, token) |
| M3 | Detected `get_context` equals the explicit call byte for byte | **met** | `server.detection.test.ts:156` (case 3) |
| M4 | Discovery follows D-C, with and without declared roots | **met** | `workspace-directories.ts`. `workspace-directories.test.ts` (each rule on linux/darwin/win32; declared/empty/failing/undeclared roots). `server.detection` cases 1, 3, 4, 4b |
| M5 | `spike.md` records cwd/roots for 3 clients, and the docs reflect it | **met (as ASSUMED, per orchestrator/P-1)** | `spike.md` §2 marks each cell `ASSUMED`. README ("**not yet confirmed** … expected to"), `specs/delivery.md` ("assumed, not yet observed") and CHANGELOG ("assumed until observed") all present the rows as assumptions. See W3 |
| D1 | The project screen lists, links via the native dialog (repository or folder, showing the current resolution), and unlinks | **met** | `components/bindings-section.tsx`, `project.tsx:221`. Tests: `project-bindings.dom.test.tsx`, `bindings-handlers.test.ts` |
| D2 | Channels are in CHANNELS/SCHEMAS/ChannelMap/bridge; closed-set and no-path tests pass unmodified | **met** | `channels.ts`, `schemas.ts` (`satisfies Record<Channel, …>`), `preload/index.ts`, `bridge.ts`. `schemas.test.ts` diff is append-only. `register-handlers.test.ts` changes only its `FilePicker` stub |
| D3 | Every new string and code is in `en.ts` and `es.ts`; `catalogs.test.ts` passes | **met** | Both catalogs: 6 `errors.*` and 20 `bindings.*` keys. The desktop suite is green. Spanish copy is neutral (tú, no voseo) |
| D4 | CLI and desktop have parity for which/link/unlink/list | **met** | which maps to the inspect panel; link (repository/folder) maps to radios + Link; links maps to the per-project section; unlink maps to Unlink by id. The CLI-only `unlink --dir` and all-projects `links` are reachable on desktop through inspect and per-project lists (plan §4.2 parity table). Desktop has no auto-detection by design (spec §2.4, gui.md) |
| S1 | Credentials are stripped in storage and display (test) | **met** | `repository-target.ts` reads only `hostname`, and `PATH_SEGMENT` rejects `@`/`:`. Tests: `repository-target.test.ts`, `file-workspace-probe.test.ts:70`, `binding-commands.test.ts:145`, `bindings-handlers.test.ts:141`, `server.detection` case 9 |
| S2 | No detection code path spawns a process (test or lint guard) | **met** | `src/delivery/detection-no-spawn.test.ts`: a forbidden-API regex plus an allow-list of node built-ins over the 12 detection files. The accepted deviation (method-call `exec` exempted, import allow-list added) is *stricter* overall |
| S3 | Nothing binding-related goes to `~/.valija-state` or desktop prefs | **met** | `link-workspace.use-case.test.ts:178` (real `FileDeviceIdentity`, state file clean). `project-bindings.dom.test.tsx:221` (`preferences.write` never called). The handlers receive no prefs store (structural) |
| K1 | Migration 004 upgrades a real v3 vault transactionally; `LATEST_SCHEMA_VERSION` = 4 | **met** | `004-project-bindings.ts` (`IF NOT EXISTS`, F6). `migrations.ts:19` has `backup: true`. `004-project-bindings.test.ts`: v3 to v4 with data and FTS intact, backup removed, idempotent, F6 re-run, UNIQUE and CHECK |
| K2 | Fixture regenerated with vault-format §6/§7; `expected-*` byte-identical; conformance passes | **met** | Only `vault.db`, `manifest.json` (schemaVersion, fileSaltHex, cipher_salt; `keyHex` unchanged) and the fixture README changed. `expected-*` diff is empty. `vault-format.md` §6/§7/§12 updated. The bindings table is empty |
| K3 | SPEC §5–§9, specs, README, gui.md and CHANGELOG updated | **met** | All present in the diff (see the docs sections of `docs/SPEC.md`, `specs/{context,delivery,desktop,shared,vault}.md`, `README.md`, `docs/gui.md`, `CHANGELOG.md`). One gap is noted in W1 |
| K4 | typecheck, lint and test pass at the root and in `desktop/` | **met** | Reviewer runs above |

**All 25 criteria met. No hard gate breached.**

## Hard gates

| Gate | Result |
|---|---|
| Security surface (secrets logged, plaintext on disk, KDF/keychain, SQLCipher keying, MCP over-exposure) | **No breach.** Bindings live only in the SQLCipher vault. MCP handlers read only `project`/`detectedBy`. Every new error message is path-free (checked: `parseFolderTarget`, `canonicalDirectory`, `parseRepositoryTarget`, `chooseLinkTarget`, `parseEnvProject`, `chooseProject`). No KDF, keychain or cipher code is touched. MCP still has 5 tools and 2 prompts |
| Tests for new behaviour; suite passing | **Pass.** Tests exist for every layer (domain, migration, repository, probe, guard, use cases, delivery, CLI, MCP, IPC, view logic, DOM). Both suites are green. The one untested unit is the electron adapter (S4), which matches the pre-existing pattern |
| Ritual evidenced | **Pass** (see above) |
| Naming / placement | **Pass, with one warning (W2).** Use-case names have no suffix per repo convention (F2, approved). Every new file sits in a kind-named subfolder or is a tech-named `infra/` adapter (`SqliteProjectBindingRepository`, `FileWorkspaceProbe`) |
| Surface parity (CLAUDE.md) | **Pass** (D4) |

## Accepted deviations (reported by implementers): reviewed and safe

- **Remote path segments are parsed from the raw string with `[A-Za-z0-9._~%-]`.** This is safer
  than `URL.pathname`: `..` is rejected, not resolved, and nothing credential-shaped survives.
- **No-spawn guard narrowed to non-method calls, plus a node-module allow-list.** Net stricter: any
  real process API needs a non-allowed import.
- **A malformed or symlinked `.git` marks the repo root with no remote and stops the walk.** This is
  conservative: a symlinked `.git` is never followed.
- **`VALIJA_PROJECT` wins over an unreadable workspace dir.** This is consistent with D-E (env
  outranks bindings), and the session still opens first, so `VAULT_LOCKED` ordering holds.
- **`WorkspaceEnvironment.variables` replaces direct `process.env` reads.** This is injectable and
  tested.
- **Catalog split `resolvesNowFolder`/`resolvesNowRepository` and the extra `linkAs` key.** Better
  i18n (no interpolated kind word), and present in both catalogs.

## Line count

- Whole diff: 98 files, +8,105 / −118. About 2,640 of those lines are the three advance docs.
- Production (`src/**` + `desktop/src/**`, excluding tests, fixtures and `src/testing`): **+2,160 / −60**,
  including CSS (+76) and catalogs (+67). The plan estimated ~1,600 (range 1,550–1,700), so this is
  about 30% over (W4).

## Issues

### Critical
None.

### Warning

- **W1. The residual risk "planted `.git`" is not documented, although the plan said it would be.**
  - Plan §8 R2 / A5: "Documented in README's security note."
  - `README.md` §"Security model" has no such line, and no other doc mentions it.
  - Meanwhile README says detection uses "only … links you made — never from a folder's name". That
    is true, but it does not say that a downloaded archive containing a hand-made `.git/config` can
    claim a remote the user has linked. That is exactly the spec §14 worst case (a hostile repo
    streams a project's context).
  - *Fix:* add one bullet to README §"Security model", e.g. *"A repository link matches any folder
    whose `.git/config` names that remote. A downloaded archive that ships its own `.git` folder can
    therefore claim a remote you linked. Link by folder (`--by folder`) when that matters."*
    Mirror it in `docs/SPEC.md` §9.
  - Not a gate: the code behaves as approved. But it should land before merge.

- **W2. `src/context/infra/git/git-config.ts` sits in a subfolder named after a technology (`git/`),
  not a kind.**
  - CLAUDE.md asks for "a subfolder that names its kind". The plan's own precedent,
    `importers/infra/parsers/`, is kind-named.
  - *Proposal:* `src/context/infra/parsers/git-config.ts` (and its test), updating the
    `detection-no-spawn.test.ts` list and `specs/context.md`.
  - The plan approved `git/` explicitly, so this is not a fail.

- **W3. The P-1 loop is still open.**
  - `spike.md:3-5` and §5 say the rows become `OBSERVED` "before `change-reviewer` runs". They have
    not, and that sentence is now stale.
  - The docs correctly hedge everything as an assumption, so nothing user-facing is wrong.
  - Track the follow-up commit: probe, then `OBSERVED <date> <version>`, then README,
    `specs/delivery.md` and `docs/gui.md` adjusted. Reword the status line so it no longer promises
    a pre-review completion.

- **W4. Production size is about 30% over the estimate** (+2,160 vs ~1,600).
  - No single file is oversized: the largest new production file is `bindings-section.tsx` at 239
    lines.
  - Noted for future estimates. No action needed.

### Suggestion

- **S1. MCP efficiency when `VALIJA_PROJECT` is set.**
  - `projectFor(undefined)` still does a `roots/list` round-trip (up to 2 s) and a probe of every
    root, although env decides.
  - `ResolveProject.locateReadable` probes only to fill `locations`, which MCP never reads.
  - *Proposal:* in `server.ts` `projectFor`, skip `workspaceDirectories` when `c.envProject` is
    non-blank (pass `[]`). Lock-first ordering is unaffected, because `ResolveProject` still opens
    the session first.

- **S2. `list_projects` now costs a second session open and a roots round-trip on every call.**
  This is acceptable at today's scale (D-S: no cache). If `list_projects` latency becomes visible
  with slow clients, consider a shorter roots timeout for the marker-only path.

- **S3. Dotfiles-home footgun.**
  - If `~` is itself a git repo with a remote (a common dotfiles setup), `valija link p` from any
    unrepo'd folder under home defaults to *repository* and links the dotfiles remote.
  - Every folder under home would then resolve to `p`.
  - The confirmation line names the remote, so it is not silent.
  - *Proposal:* make `chooseLinkTarget` refuse the default repository kind (or require explicit
    `--by repository`) when `repositoryRoot` is the home folder. Reuse the existing `tooBroadToLink`
    logic for the root.

- **S4. The `pf-`/`fh-` map separation in `ElectronFilePicker` is only covered structurally.**
  - `bindings-handlers.test.ts` uses a fake picker.
  - A small test with `electron` mocked would pin P-10 directly: `resolveHandle` cannot redeem a
    `pf-` handle and `resolveProjectFolder` cannot redeem an `fh-` handle.
  - No such test exists for the adapter today, so this matches existing practice.

- **S5. `git-config.ts` misses `[remote "origin"] url = …` written on the header line.** Git accepts
  this form, though it is rare. Today the line is treated as a header and the URL is dropped. That
  is harmless (no remote, so no false match), but could be noted in the D-J limitation sentence.

- **S6. `valija which` on an unlinked folder prints nothing about the repository or remote.** The
  desktop inspect panel shows both (`isRepository`/`remote`). The spec designed it this way (§2.1 vs
  §2.4), but adding a line such as `Repository: github.com/oscar/valija (not linked)` to `which`
  would make the information symmetric too.

## What would change the verdict

Nothing outstanding blocks the merge. W1 is the one item I recommend fixing in this branch before
`git-ops` merges. It is documentation-only and would not by itself require re-review.
