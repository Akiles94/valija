# LIVING-DOCS: Ship report

- Branch: `feat/living-docs` (tip 4b2df80), merged into `main` with `--no-ff` as 916ab7d.
- Verdict: PASS (re-review after fixes). Approved by Oscar 2026-10-19; push and merge approved 2026-10-20.

## What was done
- Living-docs generator and `docs:check`: generated reference pages (commands, use cases, error codes, IPC channels) and a cited guide (20 flows, 268 citations, 449/449 exports documented).
- CLI entry refactored into `buildProgram(container)`; output verified byte-identical across 17 invocations.
- Failure checks: undocumented-export, unscannable-source, stale-page, missing-section, broken-reference.
- Fix commit 011821c resolved review FAIL items C-1 (error-code extractor and D-11 tests; real parser bug fixed), C-2 (P-D9 and fail-closed entry-point tests), C-3 (module map: delivery, specs links).

## Review summary
Root typecheck, lint, test (388 tests) and docs:check pass; desktop typecheck and test (930 tests) pass. Mutation checks confirmed the new tests catch regressions.

## Lacking
Non-blocking warnings open for follow-up: W-2..W-6, W-8, W-9 (see review.md).
