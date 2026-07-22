# M2 — Importers · Ship report

**Branch:** feat/importers-M2 · **Merged into main:** 48f3a65 (`--no-ff`) · **Pushed:** origin/main bdd2553..48f3a65

## What was done

Added a new `importers` module (`importers → shared, context`) that parses ChatGPT, Claude, and a
generic-JSON export into a normalized conversation IR, chunks it into ≤28KB markdown bodies on
message boundaries, and persists it through context's `ImportItems` use case as a new `imported`
item type — searchable via FTS, excluded from context packs, and never creatable via an MCP tool
(`ITEM_TYPES` unchanged; storage uses the wider `STORABLE_ITEM_TYPES`). Deterministic ids make
re-import idempotent per project. Shipped `valija import <file> -p <project>` with list-first
safety, `--pick/--query/--since/--all/--from/--dry-run`, migration 002 (CHECK-constraint rebuild +
FTS reindex, with a ciphertext backup on first upgrade), and full docs (specs/importers.md,
README, CHANGELOG, docs/SPEC.md §10a). Released as 0.2.0.

Built in 5 slices, each committed separately: domain foundation, parsers + zip reader, imported
type + migration 002, use cases, CLI + wiring + docs. One review cycle (FAIL on lint → fixed →
re-reviewed PASS).

## Deferred (not in this ship)

- Gemini / Google Takeout parser (messy format).
- Claude Code session import, live watcher/daemon.
- Conversation reassembly by name — chunks carry a title/date/part-n-of-m header in their body,
  but there is no lookup that returns one imported conversation's chunks, in order, as a single
  document. Parked in docs/SPEC.md §10a per Oscar's explicit call, not folded into M2.

## Review summary

`advances/M2/review.md` — **Verdict: PASS**. All section-9 acceptance criteria and section-8
security items MET, zero gate breaches. Two non-blocking notes: W1 (`importedItemId` uses a space
separator instead of the plan's NUL separator — safe in practice), S3 (`fflate ^0.8.3` vs. plan's
`^0.8.2` — same minor line). Neither gates the merge.

## Ritual trail

`advances/M2/refined.md` → `advances/M2/plan.md` (`Approved: Oscar 2026-07-17`) → this ship.
