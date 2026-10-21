# living-docs

Generates Valija's developer guide ([`docs/guide/`](../../docs/guide/README.md)) from the code and
from hand-written flow sources ([`docs/flows/`](../../docs/flows/README.md)), and fails CI when they
drift apart.

```
npm run docs        # regenerate docs/guide/
npm run docs:check  # report every way the guide, the code and the flows disagree (exit 1)
```

Both commands build the tool with its own tsup config into `tools/living-docs/dist/` (git-ignored,
never shipped) and run it from the repository root. No network, no LLM.

## Layout: the `living-docs` package and a Valija adapter

The generic engine — flow parsing and rules, reference resolution, TSDoc coverage, the fail-closed
TypeScript scanner, the Markdown + Mermaid renderer and the file workspace — is the
[`living-docs`](https://github.com/Akiles94/living-docs) package (a devDependency). This folder holds
only what knows Valija:

```
valija/   commander, the MCP SDK, Container, desktop channels
  surfaces/     CLI and MCP read at runtime with an inert container; IPC read statically
  services/     which use cases an entry point reaches; CLI ↔ desktop parity
  extractors/   use cases, entry points, architecture, error codes
  composition/  valija-guide.ts (the one configuration point) and main.ts (calls runGuide)
```

Valija's extractors import its own TypeScript sources (`buildProgram`, the MCP server), so instead
of the package's `living-docs` CLI it bundles `main.ts` with its own tsup config and calls
`runGuide` from the library.

## The extractor contract

An extractor returns **data only** (`ExtractedFacts`): documented symbols, catalogues (tables),
graphs, coverage requirements ("every item of kind K must be cited by a flow") and findings. The
package resolves flow references against them, adds "Cited by" back-links, applies the rules and
renders every page. There is no discovery and no plugin loading: `valija-guide.ts` lists the
extractors explicitly.

## Safety

- Introspection never builds a real container or runs a use case: `buildProgram` and
  `buildMcpServer` receive a container that throws on access, and a test proves no vault, keychain
  or home folder is touched.
- The scanner fails closed: a file it cannot read with confidence is a finding, never a silent pass.
- The workspace writes only `.md` files inside `docs/guide/`, and deletes only files that carry the
  generated banner.
