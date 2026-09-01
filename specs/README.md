# specs/ — behavior specifications

valija follows **spec-driven development**: every module's observable behavior is documented here *before* it changes. The spec is the contract; the tests co-located with each source file (`*.test.ts`) are the executable proof; the code is the implementation.

## Rules

1. **Change the spec first.** A PR that changes behavior updates the matching spec file in the same commit.
2. **Specs describe behavior, not implementation** — inputs, outputs, invariants, error codes. Behavior-preserving refactors don't touch specs.
3. **One spec per module**, mirroring `src/`:

| Spec | Module | Covers |
|---|---|---|
| [shared.md](shared.md) | `src/shared/` | Result/DomainError, Clock, SQLite engine, migrations, paths |
| [vault.md](vault.md) | `src/vault/` | passphrase, key, keychain, header, recovery kit, lock/unlock |
| [context.md](context.md) | `src/context/` | project, item, tag, the context-pack algorithm, search |
| [importers.md](importers.md) | `src/importers/` | conversation IR, parsers, chunking, `valija import` |
| [delivery.md](delivery.md) | `src/delivery/` | CLI commands, MCP tools/prompts, composition root |

## Module layout & dependency rule

Each bounded context is a top-level folder owning its full stack:

```
src/<module>/domain/        entities, values, module errors (no I/O)
src/<module>/application/    use cases + ports (interfaces)
src/<module>/infra/          adapters implementing the ports
```

Dependencies point one way only: **`shared ←` everyone · `vault → shared` · `context → shared, vault` · `importers → shared, context` · `delivery →` all**. `context` depends on `vault` solely through the `VaultSessions` bridge (a locked vault refuses a session); `importers` writes items solely through context's `ImportItems` use case and never touches `vault`. The product-level spec (scope, decisions, security model) lives in [../docs/SPEC.md](../docs/SPEC.md).
