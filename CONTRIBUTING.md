# Contributing to valija

Thanks for your interest. valija is early — the best contribution right now is trying it and opening issues.

## Ground rules

- **Branch per advance.** Every feature/fix/refactor lives on its own branch named `<type>/<short-descriptive-name>` (e.g. `feat/m2-importers`, `refactor/narrative-use-cases`), merged to `main` with `--no-ff` after review. Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…).
- **Module-first layout.** Code lives under `src/<module>/{domain,application,infra}` where module is `shared`, `vault`, `context`, or `delivery`. Within a module, `domain` holds pure types + invariants (`entities/`, `values/`, and `services/` for logic spanning entities), `application` holds `ports/` (interfaces), `use-cases/` (`*.use-case.ts`), and `dto/` (the shapes use cases return), `infra` holds adapters.
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
- **Dependency rule (no exceptions):** `shared ←` everyone · `vault → shared` · `context → shared, vault` · `delivery →` all. `context` may touch `vault` only through the `VaultSessions` bridge.
- **Spec-driven:** behavior changes update the matching file in [`specs/`](specs/) in the same PR. Tests are co-located (`foo.ts` + `foo.test.ts`).
- **No new dependencies** without discussion in an issue first.
- **Security-sensitive code** (crypto, keychain, SQL) requires tests and gets extra review scrutiny.
- Quality gates must pass: `npm run lint && npm run typecheck && npm test`.

## Development

```
npm install
npm test            # vitest
npm run build       # tsup → dist/
npm run lint        # biome
npm run typecheck   # tsc --noEmit
```

## Non-goals (please don't PR these)

Embeddings/semantic search, telemetry of any kind, cloud sync, auto-capture of conversations. See §2 of [docs/SPEC.md](docs/SPEC.md).
