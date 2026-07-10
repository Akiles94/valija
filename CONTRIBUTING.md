# Contributing to valija

Thanks for your interest. valija is early — the best contribution right now is trying it and opening issues.

## Ground rules

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`…). Scope by advance when applicable: `feat(a04): …`.
- **Clean architecture dependency rule:** `domain` imports nothing internal; `application` imports domain; `infrastructure` and `interfaces` import inward. No exceptions.
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
