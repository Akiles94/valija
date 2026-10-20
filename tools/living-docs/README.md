# living-docs

Generates Valija's developer guide ([`docs/guide/`](../../docs/guide/README.md)) from the code and
from hand-written flow sources ([`docs/flows/`](../../docs/flows/README.md)), and fails CI when they
drift apart.

```
npm run docs        # regenerate docs/guide/
npm run docs:check  # report every way the guide, the code and the flows disagree (exit 1)
```

Both commands build the tool with its own tsup config into `tools/living-docs/dist/` (git-ignored,
never shipped) and run it from the repository root. No network, no LLM, no dependency of its own.

## Layout: a generic core and a Valija adapter

```
core/     generic — imports only itself and node: built-ins (enforced by seam.architecture.test.ts)
  domain/       flows, references, catalogues, graphs, findings; the coverage and staleness rules
  application/  the Extractor port (the seam), GenerateGuide (write | check), the report
  infra/        fail-closed TypeScript scanner, TSDoc coverage extractor, Markdown + Mermaid
                renderer, file workspace
valija/   everything that knows Valija: commander, the MCP SDK, Container, desktop channels
  surfaces/     CLI and MCP read at runtime with an inert container; IPC read statically
  services/     which use cases an entry point reaches; CLI ↔ desktop parity
  extractors/   use cases, entry points, architecture, error codes
  composition/  valija-guide.ts (the one configuration point) and main.ts
```

## The extractor contract

An extractor returns **data only** (`ExtractedFacts`): documented symbols, catalogues (tables),
graphs, coverage requirements ("every item of kind K must be cited by a flow") and findings. The
core resolves flow references against them, adds "Cited by" back-links, applies the rules and
renders every page. There is no discovery and no plugin loading: `valija-guide.ts` lists the
extractors explicitly.

## Safety

- Introspection never builds a real container or runs a use case: `buildProgram` and
  `buildMcpServer` receive a container that throws on access, and a test proves no vault, keychain
  or home folder is touched.
- The scanner fails closed: a file it cannot read with confidence is a finding, never a silent pass.
- The workspace writes only `.md` files inside `docs/guide/`, and deletes only files that carry the
  generated banner.

## Extracting it later

`core/` has no knowledge of Valija, so lifting it into its own package means moving the folder and
publishing the `Extractor` port; a repository then writes its own `valija/`-style adapter.
