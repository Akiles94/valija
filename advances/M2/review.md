Verdict: PASS

# M2 — Importers · Change review

Reviewed feat/importers-M2 at HEAD cc16240 against advances/M2/refined.md (section 8 security,
section 9 acceptance) and advances/M2/plan.md (Approved: Oscar 2026-07-17). Diff base: bdd2553.

This is a re-review. My earlier verdict was FAIL on one hard gate (npm run lint red). Commit
cc16240 fixed it and the two non-blocking suggestions S1/S2. Every section-9 acceptance criterion
is met, no section-8 security surface is weakened, and the full gate chain is green — PASS.

## Verification run (re-run against HEAD cc16240)

| Gate | Result |
|---|---|
| npm run typecheck | PASS — exit 0 (tsc --noEmit, clean) |
| npm run lint | PASS — exit 0 (biome check; only a non-fatal biome.json deprecation info) |
| npm test | PASS — exit 0, 34 files, 158 tests |

## Resolution of the prior FAIL

- BLOCKING (now fixed). npm run lint exits 0. cc16240 ran biome check --write on the two files with
  out-of-order imports: src/importers/infra/parser-registry.ts (ConversationParser before
  ParserRegistry) and
  src/importers/application/use-cases/import-conversations.use-case.test.ts (shared imports and the
  two port imports re-sorted). Verified by inspecting the diff and re-running lint.
- S1 (fixed). program.ts:50 show --type help now reads
  (decision|progress|preference|fact|handoff|imported).
- S2 (fixed). import-command.ts now computes hasSelection from --all/--pick/--query/--since only;
  a bare --dry-run no longer demands -p and falls through to list mode (consistent with plan A5),
  while any real selection still requires -p. Change is confined to the delivery/CLI layer; all
  tests remain green.

The fix commit touched only 4 files (import-command.ts, program.ts, parser-registry.ts,
import-conversations.use-case.test.ts) — no security, domain, migration, or persistence code moved,
so every prior MET assessment still holds.

## Line count

- Production src (excl. tests and fixtures): +1398 / -29 (plan estimated ~965; higher, driven by the
  added ParserRegistry port and fuller adapters — acceptable).
- Tests src *.test.ts: +797. Total src: +2266 / -32. Whole diff: 66 files, +3208 / -52.

## Acceptance criteria (section 9)

Module and architecture
| Criterion | Verdict | Evidence |
|---|---|---|
| src/importers/ has domain/application/infra; no vault import under importers | MET | tree present; grep for vault under src/importers finds only testing/test-vault.js in a test helper |
| importers persists only via a context use case; no session.items.save or SQL in importers | MET | import-conversations.use-case.ts:121 calls injected importItems.execute; no repo/SQL access in importers |
| parser port detect+parse; 3 parsers; reader handles .zip(fflate)+.json | MET | application/ports/parser.ts:22; chatgpt/claude/generic parsers; infra/file-export-reader.ts:47 |

imported type and MCP non-widening
| Criterion | Verdict | Evidence |
|---|---|---|
| imported is a valid stored type (CHECK + rehydration) | MET | 002-imported-type.ts:18; item-repo.ts toItem cast to StorableItemType; item-type.ts:24 |
| save_context offers exactly 5 types; imported not selectable | MET | item-type.ts:4 ITEM_TYPES untouched; server.test.ts:69 (5 tools) + :142 (type imported rejected -> isError) |
| imported never pinned; never in a get_context pack (asserted) | MET | context-item.ts:94 pinned false; import-items.use-case.test.ts:50 asserts includedCount 0, sections empty |
| imported ARE returned by search | MET | import-items.use-case.test.ts:63 asserts a hit with type imported |

Import behaviour
| Criterion | Verdict | Evidence |
|---|---|---|
| ChatGPT/Claude import; each rejects the other export | MET | chatgpt-parser.test.ts:11, claude-parser.test.ts:11 assert cross-detect false; disjoint keys mapping vs chat_messages |
| generic envelope imports; unknown version -> UNSUPPORTED_GENERIC_VERSION | MET | generic-parser.ts:60; generic-parser.test.ts:29 |
| size-target split into (part n/m); every chunk <=32KB; oversize msg hard-split UTF-8-safe | MET | chunk-render.ts (packBodies/hardSplit); chunk-render.test.ts:34,48 assert parseContent ok + no replacement char |
| createdAt = conversation date; tags [imported,source]; provenance in body not tags | MET | import-conversations.use-case.ts:194-203; chunk-render.ts:91 header; import-items.use-case.test.ts:37-39 |
| re-import is idempotent (deterministic ids) | MET | context-item.ts:70 importedItemId; import-items.use-case.test.ts:42 (2 not 4). See Warning W1 |
| .zip processed without any plaintext file on disk | MET | file-export-reader.ts in-memory unzipSync; file-export-reader.test.ts:30 asserts dir listing unchanged |

CLI
| Criterion | Verdict | Evidence |
|---|---|---|
| no selection flag -> list, writes nothing | MET | import-conversations.use-case.ts:158 resolveMode; test :50 writer.calls length 0 |
| --all/--pick/--query/--since; --pick indexes printed order; bad pick -> INVALID_SELECTION | MET | selection.ts; selection.test.ts; import-conversations.use-case.test.ts:93 |
| --dry-run reports; opens no write session | MET | import-conversations.use-case.ts:111; test :64 writer.calls length 0 |
| locked -> VAULT_LOCKED; unreadable -> UNREADABLE_FILE; corrupt zip -> CORRUPT_ARCHIVE; empty -> NO_CONVERSATIONS_SELECTED | MET | import-items.use-case.test.ts:86; file-export-reader.test.ts:47,69; selection.ts:95 |
| summary reports imported/skipped/failed; per-conversation failure non-fatal | MET | import-conversations.use-case.ts:209; test :132 |

Migration 002
| Criterion | Verdict | Evidence |
|---|---|---|
| populated v1: rows/content identical; FTS intact; version -> 2; 2nd migrate no-op | MET | 002-imported-type.test.ts:70,106 (row equality, ftsHits, idempotent) |
| single transaction; forced mid-migration failure leaves v1 fully intact | MET | migrations.ts:50 db.transaction; test :115 rollback keeps v1, rows, FTS |
| ciphertext pre-migration backup created and cleaned up | MET | migrations.ts:59 checkpoint+copy; test :98 removed on success, :125 kept on failure |

Docs and specs
| Criterion | Verdict | Evidence |
|---|---|---|
| specs/importers.md added; specs/context.md + specs/delivery.md updated same change | MET | specs/importers.md (new); context.md/delivery.md diffs (imported type, ImportItems, import cmd) |
| README documents the MCP distillation path | MET | README.md Import your history -> Via a connected AI |

Security (section 8)
| Criterion | Verdict | Evidence |
|---|---|---|
| same encrypted path (context -> VaultSessions -> SQLCipher); no sidecar | MET | ImportItems.execute writes only via sessions.withSession |
| no plaintext to disk (zip in memory, no temp files) | MET | file-export-reader.ts + test dir-listing assertion |
| lock honoured (VAULT_LOCKED) | MET | import-items.use-case.test.ts:86 |
| MCP surface unchanged | MET | server.test.ts 5 tools + imported rejected |
| decompression-bomb cap | MET | file-export-reader.ts:63-68; test :69 -> CORRUPT_ARCHIVE |
| migration integrity (transactional, non-lossy, FTS rebuilt, ciphertext backup) | MET | 002-imported-type.ts:56 FTS rebuild; migration test suite |
| fflate the only new dependency | MET | package.json adds only fflate |

## Ritual and plan adherence

- Ritual trail present: refined.md -> plan.md (carries the line Approved: Oscar 2026-07-17 at the
  top) -> this review.md. MET.
- Plan deviations, each checked and found safe/spec-consistent:
  - ImportSource in domain/values/ — matches plan step 2; keeps domain purity (only imports shared
    result/errors). Safe.
  - ParserRegistry port added so the app use case depends on a port, not infra — improves layering,
    documented in specs/importers.md. Safe.
  - Slice 3/4 reorder (migration lands with the type) — migration is self-contained and fully
    tested; no behavioural impact. Safe.
  - importedItemId project-scoped (projectId, source, conversationId, chunkIndex) — a justified
    widening of D-C 2a: idempotency into one project still holds (project id is stable across
    re-imports via find-by-name), and the same conversation can now coexist in two projects instead
    of one silently overwriting the other. Safe (see W1 on the separator).
  - ImportItems(sessions, clock, idGen) — the extra IdGenerator is required to mint the auto-created
    project id, mirroring SaveContext. Safe.
- Naming/architecture conventions (parseX, total createX, importerErr, SqliteX/FileX adapters,
  *.use-case.ts, ports vs infra, one test per source, domain purity, one-way importers -> context
  edge) all honoured.

## Gate breaches

None. typecheck, lint, and test are all green; no security gate is breached.

## Remaining non-blocking notes (do not block the merge)

- W1. importedItemId (context-item.ts:77) joins components with a space separator (projectId, source,
  conversationId, chunkIndex), not the plan NUL separator (Assumption A2). With ulid project ids, an
  enum source, and a numeric chunk index a collision is practically impossible, but a conversationId
  containing spaces makes the concatenation theoretically ambiguous. Prefer a non-printable separator
  in a future touch. Not blocking.
- S3. package.json pins fflate ^0.8.3 vs the plan ^0.8.2 — same minor line, satisfies D5; no action.

Previously-raised S1 and S2 are resolved in cc16240 (see the Resolution section above).

## Verdict

PASS. All section-9 acceptance criteria are met, all section-8 security items hold, the advance
ritual trail is complete, and typecheck/lint/test are green at HEAD cc16240. Only the non-blocking
W1/S3 notes remain, neither of which gates the merge.
