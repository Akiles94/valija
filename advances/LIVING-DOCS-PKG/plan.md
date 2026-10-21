Approved: Oscar 2026-10-21

# LIVING-DOCS-PKG — Fast-track plan

> Fast-track (Oscar, 2026-10-21). Nothing under `tools/**`, `package.json` or build config changes
> until Oscar approves this plan. The `Approved:` line at the top is his.

**Goal.** Make the living-docs generator reusable in any TypeScript repo. Its generic `core/` moves
out of Valija into its own package, `living-docs`, in `github.com/Akiles94/living-docs`. A repository
then installs it, runs `npx living-docs prompt init`, and has an agent write the flows (and, when
needed, its own extractors). Valija becomes the first consumer and keeps only its adapter.

## Decisions (Oscar, 2026-10-21)
- Fast-track.
- 0.1.0 ships the core, a CLI (`living-docs write | check | prompt init`), a config file and the
  generic TSDoc extractor.
- Valija switches to the package in this same advance.
- Valija depends on the **npm-published** package (`living-docs@0.1.0`), so its switch merges only
  after Oscar runs `npm publish`. No GitHub-URL dependency in between.

## Part A — the `living-docs` package (repo `Akiles94/living-docs`)
1. **Move the core as-is.** `tools/living-docs/core/{domain,application,infra}` → `src/{domain,
   application,infra}` with every test. No behavior change, and the seam test keeps guarding that
   `src/` imports only itself and `node:` built-ins (now for the whole package except `src/cli/`).
   Valija-specific tests stay in Valija; `typescript-scanner.repo.test.ts`, which scans Valija's own
   sources, is one of them.
2. **Public API, `src/index.ts`.** It exports exactly what a repository adapter needs. That is what
   Valija's adapter imports today: the `Extractor` port and `createExtractedFacts`; the catalogue,
   finding, graph, result and settings values; `TypeScriptExportsExtractor` and `SourceFile`;
   `scanTypeScript`; `GenerateGuide`, `FileGuideWorkspace`, `MarkdownGuideRenderer` and
   `formatGuideReport`. On top of those it adds `runGuide({ repoRoot, settings, extractors, mode })`,
   which bundles the composition every consumer repeats.
3. **CLI, `src/cli/`** (bin `living-docs`):
   - `write` / `check` load `living-docs.config.{js,mjs,ts}` from the current directory. `.ts` needs
     Node ≥ 22.18, which strips types natively. The default export is
     `defineConfig({ settings, extractors(repoRoot) })`.
   - With no config file, it falls back to `docs/flows` → `docs/guide` and TSDoc coverage over `src/`.
   - Exit codes stay as today: 0 clean, 1 findings, 2 misuse.
   - `prompt init` prints the agent instructions. They cover the flow source format (required
     headings, one sequence diagram, `{{kind:name}}` references), how to choose 10–20 flows, when a
     repo needs its own extractor (entry surfaces such as CLI commands, HTTP routes or handlers that
     every flow must cover), and how to wire `docs` / `docs:check` into npm scripts and CI.
   - Repos whose extractors import their own TypeScript sources (Valija does: `buildProgram`, the MCP
     server) build a small entry with their bundler and call `runGuide`. The README documents both
     paths.
4. **Repo tooling**, mirroring easy-repo-context:
   - `package.json`: `type: module`, `engines.node >= 22`, `bin`, `exports` with types, and
     `files: [dist]`. No runtime dependencies.
   - tsup, TypeScript, Vitest and Biome.
   - CI on Node 22/24: typecheck, lint, test, build, and a smoke run of the CLI against a fixture repo.
   - README, CHANGELOG, MIT LICENSE (already there).
   - A `CLAUDE.md` carrying the Authorship rule.
5. **Release, Oscar's step.** Tags and `npm publish` happen on his machine: this session's proxy
   refuses tag pushes, and there is no npm token here.

## Part B — Valija consumes it (branch `refactor/LIVING-DOCS-PKG`)
1. Delete `tools/living-docs/core/`.
2. Point `tools/living-docs/valija/**` at `living-docs` imports; `main.ts` calls `runGuide`. Keep
   `typescript-scanner.repo.test.ts` under `tools/living-docs/valija/`, importing `scanTypeScript`
   from the package.
3. Add `devDependencies: { "living-docs": "0.1.0" }`. Leave the `docs` / `docs:check` scripts and
   the tsup config as they are; tsup bundles the package into the git-ignored `dist/`.
4. **Verification before merge.** Install the package from a local `npm pack` tarball (never
   committed), then run the gates. `docs:check` must print exactly what it prints today
   ("20 flows, 268 citations, 449/449 exports documented"), and `npm run docs` must produce a
   byte-identical `docs/guide/`.
5. Docs: update `tools/living-docs/README.md` ("the core is the `living-docs` package"),
   `.context/overview.md`, CONTRIBUTING if it mentions the core, the CHANGELOG, then
   `context:check` and `stamp`.
6. **Merge gate.** Commit the `package.json` / lockfile change only after `living-docs@0.1.0` exists
   on npm, so `npm ci` resolves it from the registry. Until then the branch stays unmerged, and I
   show the push and merge commands before running them.

## Repo structure after execution
```
Akiles94/living-docs (new content)
  package.json  tsconfig.json  tsup.config.ts  vitest.config.ts  biome.json
  README.md  CHANGELOG.md  CLAUDE.md  LICENSE
  .github/workflows/ci.yml
  src/
    domain/ application/ infra/      (moved from valija tools/living-docs/core, with tests)
    cli/                             (living-docs write | check | prompt init, config loading)
    index.ts                         (public API + runGuide)
    seam.architecture.test.ts
  test/fixtures/sample-repo/         (CLI smoke test)

valija
  tools/living-docs/
    core/                            (deleted)
    valija/                          (imports from "living-docs"; + typescript-scanner.repo.test.ts)
    README.md  tsup.config.ts        (README updated)
  package.json / package-lock.json   (+ living-docs 0.1.0, after publish)
  .context/overview.md, CHANGELOG.md (+ a line each)
  advances/LIVING-DOCS-PKG/plan.md
```

## Out of scope
- No new extractors beyond the generic TSDoc one; no languages other than TypeScript.
- No change to the flow format, the rules or the rendered output.
- No `src/**` or `desktop/**` change in Valija.
