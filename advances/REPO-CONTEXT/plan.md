Approved: Oscar 2026-10-20

# REPO-CONTEXT — Fast-track plan

> Fast-track (Oscar, 2026-10-20). Nothing under `package.json`, `.github/**` or build config
> changes until Oscar approves this plan. The `Approved:` line at the top is his.

**Goal.** Apply [easy-repo-context](https://github.com/Akiles94/easy-repo-context) 0.1.0 to Valija.
It adds a short, always-loaded `AGENTS.md` index plus `.context/` flows and gotchas for AI agents:
cross-module behavior and invariants that break silently. Validation is deterministic and never
calls a model.

**Relationship to LIVING-DOCS.** These are different readers. `docs/guide/` (LIVING-DOCS) is for
people. `.context/` is for agents and stays short (≤ ~25 lines per flow). It links
`docs/flows/*.md`, the guide, SPEC and CONTRIBUTING by path instead of repeating them.

## Decisions (Oscar, 2026-10-20)
- Fast-track.
- Install as a pinned devDependency (`easy-repo-context@0.1.0`). Hooks call it with
  `npx --no-install`, so commits need no network.
- Validate with local hooks **and** CI.

## Steps
1. Branch `feat/REPO-CONTEXT`. Add the devDependency and a `context:check` script
   (`easy-repo-context check`).
2. Run `easy-repo-context plan`, then `candidates`. Follow `prompt init`:
   - choose about 5 flows from the candidates, with distinct mechanisms;
   - expected flows: unlock + schema upgrade, save-context (`session.write()` + lineage bump),
     multi-device sync / fork detection, import, MCP context pack.
3. Write `.context/overview.md`, `.context/gotchas.md` and `.context/flows/*.md`, all in English.
   Every ref is validated by `check`.
4. Run `easy-repo-context index`. This writes the managed block in `AGENTS.md`, a one-line
   pointer in `CLAUDE.md` and `.context/presentation.md`. Then run `stamp`.
5. Run `easy-repo-context hooks install`:
   - it adds a `PreToolUse` edit hook to `.claude/settings.json`; the existing guard hook stays;
   - it adds a git `pre-commit` hook. That file lives in `.git/hooks`, so only this clone gets it.
     CI is the versioned guarantee.
6. CI: add `npm run context:check` after `npm run docs:check` in `.github/workflows/ci.yml`.
7. Docs: add one line to CONTRIBUTING (keep `.context/` true when you change a covered flow;
   `npm run context:check`) and to the CHANGELOG.
8. Gates: run `npm run typecheck && npm run lint && npm run test && npm run docs:check && npm run
   context:check`. Self-review the diff. Show the push and merge commands (`--no-ff`) before
   running them.

## Repo structure after execution
```
AGENTS.md                      (new — managed index block)
CLAUDE.md                      (+1 pointer line to AGENTS.md)
.context/
  overview.md  gotchas.md  presentation.md  manifest.yaml
  flows/<~5 flows>.md
.claude/settings.json          (+ easy-repo-context edit hook)
.github/workflows/ci.yml       (+ context:check step)
package.json / package-lock.json (+ devDependency, + context:check script)
CONTRIBUTING.md, CHANGELOG.md  (+ a line each)
advances/REPO-CONTEXT/plan.md
```

## Out of scope
- No `src/**` or `desktop/**` changes.
- No edits to the generated `docs/guide/`.
