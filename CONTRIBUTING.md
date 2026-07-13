# Contributing to valija

Thanks for your interest. valija is early — the best contribution right now is trying it and opening issues.

## Ground rules

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`…).
- **Module-first layout.** Code lives under `src/<module>/{domain,application,infra}` where module is `shared`, `vault`, `context`, or `delivery`. Within a module, `domain` holds pure types + invariants, `application` holds use cases + ports, `infra` holds adapters.
- **Dependency rule (no exceptions):** `shared ←` everyone · `vault → shared` · `context → shared, vault` · `delivery →` all. `context` may touch `vault` only through the `VaultSessionFactory` bridge.
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
