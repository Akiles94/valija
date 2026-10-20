# Contributing to valija

Thanks for your interest. valija is early — the best contribution right now is trying it and opening issues.

## Ground rules

- **Branch per advance.** Every feature/fix/refactor lives on its own branch named `<type>/<short-descriptive-name>` (e.g. `feat/m2-importers`, `refactor/narrative-use-cases`), merged to `main` with `--no-ff` after review. Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- **Module-first layout.** Code lives under `src/<module>/{domain,application,infra}` where module is `shared`, `vault`, `context`, `importers`, or `delivery`. Within a module, `domain` holds pure types + invariants (`entities/`, `values/`, and `services/` for logic spanning entities), `application` holds `ports/` (interfaces), `use-cases/` (`*.use-case.ts`), and `dto/` (the shapes use cases return), `infra` holds adapters.
- **Narrative use cases.** `execute()` must read as a short narrative of ubiquitous-language steps; the "how" lives in small named private methods (`findOrCreateProject`, `resolveKey`…) or a domain service. Extract when a method mixes ≥2 concerns; don't fragment single-action code. A use case implements `UseCase<In, Out>`/`AsyncUseCase<In, Out>`, takes a single input object, and **never depends on another use case** — share a domain service instead.
- **Domain owns decisions; delivery owns formatting.** Anything that picks, orders, or validates is domain. Anything that turns it into markdown/JSON/table text is `delivery`. A use case returning a formatted string is a bug.
- **Parse, don't validate.** Values arrive as branded types from `domain/values/` (`ProjectName`, `Tag`, `Content`, `Passphrase`…). Parse at the use-case boundary *before* touching infrastructure, so entity factories can be total and bad input never opens a vault session.
- **No helper/util files.** Every piece of code has exactly one home:
  - used by one use case → private method on it, no file;
  - names a module concept → that module's `domain/values/` (e.g. `vault/domain/values/key-hex.ts`);
  - domain logic spanning entities, or needed by ≥2 use cases → that module's `domain/services/` (e.g. `context/domain/services/context-pack.ts`);
  - plumbing every use case of a module needs → a method on the port that owns the resource's lifecycle (e.g. `VaultSessions.withSession`), injected and composed — never an abstract base class shared by use cases;
  - used by ≥2 modules and owned by none → `shared/`. Litmus test: nothing moves to `shared/` unless two modules import it *today*.
- **One test file per source file**, co-located (`foo.ts` + `foo.test.ts`; use cases: `foo.use-case.ts` + `foo.use-case.test.ts`). New behavior ships with its test in the same commit.
- **Dependency rule (no exceptions):** `shared ←` everyone · `vault → shared` · `context → shared, vault` · `importers → shared, context` · `delivery →` all. `context` may touch `vault` only through the `VaultSessions` bridge; `importers` writes items only through context's `ImportItems` use case.
- **Spec-driven:** behavior changes update the matching file in [`specs/`](specs/) in the same PR. Tests are co-located (`foo.ts` + `foo.test.ts`).
- **No new dependencies** without discussion in an issue first.
- **Security-sensitive code** (crypto, keychain, SQL) requires tests and gets extra review scrutiny.
- Quality gates must pass: `npm run lint && npm run typecheck && npm test && npm run docs:check && npm run context:check`.
- **Every exported symbol has TSDoc** that says what it does or why (not just its name), and every use case, CLI command, MCP tool or prompt and desktop IPC channel is cited by a flow. `npm run docs:check` enforces both — see [How to add or update a flow](#how-to-add-or-update-a-flow).

## Development

```
npm install
npm test            # vitest
npm run build       # tsup → dist/
npm run lint        # biome
npm run typecheck   # tsc --noEmit
npm run docs        # regenerate docs/guide/ from the code and docs/flows/
npm run docs:check  # fail if the guide, the code and the flows disagree (runs in CI)
npm run context:check  # fail if .context/ (agent docs) points at a file or symbol that is gone (runs in CI)
```

## How to add or update a flow

The developer guide in [`docs/guide/`](docs/guide/README.md) is **generated** by
`tools/living-docs` from the code and from hand-written flow sources in
[`docs/flows/`](docs/flows/README.md). Never edit `docs/guide/` by hand: edit the code or a flow
source, then run `npm run docs` and commit both.

- **One file per business flow**, `docs/flows/<slug>.md`, with front matter `title:` and `theme:`
  (a theme listed in `tools/living-docs/valija/composition/valija-guide.ts`).
- **Seven required sections**: business first — `## Who`, `## Why`, `## Business rules`,
  `## What can go wrong` — in plain language, then technical — `## Entry points` (a `CLI:` and a
  `Desktop:` line, each a reference or the reason there is none), `## Steps`, `## Errors`.
- **Steps** read `N. [From → To] text — {{Reference}}`, numbered from 1; the sequence diagram is
  drawn from them.
- **References**: `{{Symbol}}` (an exported code symbol), `{{folder/Symbol}}` when the name is
  exported from several files, `{{cli:unlock}}`, `{{mcp:save_context}}`, `{{prompt:load-context}}`,
  `{{ipc:vault:unlock}}`, `{{err:VAULT_LOCKED}}`.
- **Surface parity**: a CLI command and a desktop channel pair automatically when they reach the
  same use case. Anything else must be declared in `VALIJA_PARITY` (in `valija-guide.ts`) as a
  pair, a surface-specific entry, or a known gap — always with a reason.

`npm run docs:check` (in CI on every OS and Node version) fails when:

- an exported symbol, an error code or an IPC channel has no doc, or one that only restates its name;
- a use case, CLI command, MCP tool or prompt, or IPC channel is not cited by any flow;
- a flow cites something that no longer exists, or misses a required section;
- a CLI command or desktop channel has no counterpart and no parity declaration;
- `docs/guide/` is not what `npm run docs` would produce.

## Context for AI agents

[`AGENTS.md`](AGENTS.md) and [`.context/`](.context/) hold short, agent-facing notes: cross-module
flows and the invariants that break silently. They are maintained with
[easy-repo-context](https://github.com/Akiles94/easy-repo-context) and are separate from the human
guide above.

- If your change makes a `.context/` doc false, fix it in the same commit.
  `npx easy-repo-context context <file>` lists the docs that cover a file.
- `npm run context:check` (in CI) fails when a doc references a file or symbol that no longer
  exists. `npx easy-repo-context update` lists docs whose code changed since they were verified.
  After you check them, run `npx easy-repo-context stamp`.
- `npx easy-repo-context hooks install` adds the same check as a local pre-commit hook.

## Non-goals (please don't PR these)

Embeddings/semantic search, telemetry of any kind, cloud sync, auto-capture of conversations. See §2 of [docs/SPEC.md](docs/SPEC.md).
