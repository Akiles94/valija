Verdict: PASS

# SECRET-WARN — Change review

**Reviewed:** `git diff feat/project-detect-PROJECT-DETECT...HEAD` on `feat/secret-warning-SECRET-WARN`
(13 commits, `eae33a5` … `c845abe`), against `advances/SECRET-WARN/refined.md` (Gate R approved,
D-E option 2, D-F option 3) and `advances/SECRET-WARN/plan.md` (line 1: `Approved: Oscar 2026-10-20 …`).

**Suites (run by the reviewer):**
- root: `npm run typecheck && npm run lint && npm run test`, exit 0. 89 files, 826 tests passed. Biome
  reports 1 info, a pre-existing config-migration notice.
- `desktop/`: the same three commands, exit 0. 71 files, 1165 tests passed.

**Ritual:** `refined.md` (Gate R) → `plan.md` with `Approved:` on line 1 → this `review.md`. The branch
name matches `{feature}/{ADVANCE}`. Docs ship in the slice commits.

---

## 1. Acceptance criteria (refined.md §12)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| D1 | Every tier-1 kind fires on its positive case and stays silent on its negative case (prose, placeholders, example keys, public keys, certificates) | met | `known-formats.test.ts`: `it.each(PLANTED_TIER_ONE)`, private-key variants, 15 negative rows, public key / certificate / RSA public key blocks, bare header (P-16) |
| D2 | Tier-2 must-fire (6) → `credential-assignment`; must-not-fire (16) → nothing | met | `credential-assignment.test.ts:14-49`, verbatim from §8.4 |
| D3 | Tier-3 must-fire → `high-entropy-string`; every must-not-fire row → nothing | met | `high-entropy-string.test.ts:14-79` (all §8.4 rows, plus hash-context, URL, `./`, `~/` and >200 cases) |
| D4 | SPEC.md, `expected-pack.md` and the lockfile excerpt → zero findings | met | `detect-secrets.test.ts` "whole-document negatives" reads the live files |
| D5 | Overlapping spans reported once, under the highest precedence | met | `detect-secrets.ts` `isOutranked`/`outranks`. Tests: anthropic-not-openai, tier1-over-tier2, jwt-only, assignment-over-entropy, private-key block with no tier-3 body hits |
| D6 | Findings carry kind + lines only. One planted value per tier never appears in any finding, error, outcome or output | met | `SecretFinding`/`SecretMatch` have no text field. Sweeps: `detect-secrets.test.ts` (6-char fragments + exact key set), `save-context`, `import-items`, `blocking-chunks`, `curation-commands`, `import-command`, `server.secrets`, `content-handlers.curation`, `import-handlers` (`JSON.stringify`), and both DOM tests (`textContent`) |
| D7 | Adversarial 32 KB input finishes within a fixed bound | met | `detect-secrets.test.ts`: 6 shapes, < 250 ms, best of 3. Reviewer probes on other shapes ran in 1–23 ms |
| D8 | Final thresholds documented in `specs/context.md` | met | `specs/context.md` "Thresholds (final, SECRET-WARN): 32 / 200 / 4.3" |
| W1 | MCP `save_context`/`save_handoff` with a secret → `POSSIBLE_SECRET`; nothing saved, no project, `supersedes` live, no lineage bump | met | `save-context.use-case.ts:117-120` (in `parseInput`, before the session). `save-context.use-case.test.ts` covers generation, projects and supersedes. `server.secrets.test.ts` covers "writes nothing", supersedes and `save_handoff` |
| W2 | MCP refusal names kinds and lines, suggests a placeholder, mentions no override; 5 tools, 2 prompts, schemas unchanged | met | `server.ts:22-33`. `server.secrets.test.ts` pins the exact text, applies an `allow\|override\|anyway\|force` negative regex, and pins the exact input key sets. `server.test.ts` is unmodified |
| W3 | `valija edit --content-file f\|-` with a secret → exit 1, `POSSIBLE_SECRET`, item unchanged; `--allow-secrets` saves; tags-only / type-only edits never refused | met | `edit-item.use-case.ts:72-75`, `curation-commands.ts:51-55`, `program.ts:105`. Tests: `curation-commands.test.ts:152-190`, `edit-item.use-case.test.ts:136-180`. Stdin shares `readContent` (plan A8) |
| W4 | Desktop Edit: localized warning, draft kept, nothing saved; Save anyway saves; main refuses without the flag | met | `project.tsx`, `item-edit-dialog.tsx`, `secret-warning.tsx`, `schemas.ts:52`. Tests: `project.dom.test.tsx:512-610` (en + es, Save anyway, Edit text, P-18, fallback, Tab trap) and `content-handlers.curation.test.ts:118-150` |
| W5 | `import --dry-run` with flagged chunks exits 0 and lists every blocking chunk (`#n`, title, part, kinds, lines) | met | `import-command.ts` `renderWouldBeRefused`; `import-command.test.ts:96-112` |
| W6 | Real import with flagged chunks writes zero items, exits 1, prints the same list; `--allow-secrets` imports all; narrowing imports | met | `import-conversations.use-case.ts` returns early before `ImportItems`. `import-command.test.ts:114-147`, `import-conversations.use-case.test.ts:221-248` (the spy is never called) |
| W7 | Dry-run list equals the real-run list | met | One `findBlockingChunks` call serves both modes. Equality tests: `import-conversations.use-case.test.ts:228`, `import-command.test.ts:126`, `import-handlers.test.ts` "preview list equals the run list" |
| W8 | Desktop Preview shows the list; Import writes nothing and lists; Import anyway imports everything selected | met | `import-status.tsx`, `import-screen.tsx` (`refusedRequest`, P-11). `import.dom.test.tsx:517-660`, `import-handlers.test.ts:463-510` |
| P1 | Every human capability exists on both CLI and desktop | met | Refuse, override, list and narrow exist on both. The parity table is in plan §4.2 and is exercised by both suites |
| P2 | `POSSIBLE_SECRET`, all 12 kind labels and every new string exist in `en.ts` and `es.ts`; `catalogs.test.ts` passes | met | Both catalogs updated. `secret-findings.test.ts:17` checks enum ↔ catalog parity. The desktop suite is green |
| C1 | No migration, schema v4, golden fixture and conformance unchanged | met | The reviewer's `git diff --stat` over migrations, the golden vault, `vault-format.md` and the pack sources is empty |
| C2 | No new dependency, network call, IPC channel, or MCP tool/argument | met | The diff over `package*.json`, `channels.ts` and `preload/` is empty. `grep allowSecrets src/delivery/mcp` finds nothing. `register-handlers.test.ts` is unmodified |
| C3 | SPEC §12 Q2 resolved; §7/§8/§9 updated; `specs/*` ×4, README and CHANGELOG updated; "best effort" | met | All files are in the diff, and each surface's copy says "best effort" |
| C4 | No existing content-saving test weakened | met | The only removed lines in existing tests are the F8 typed literal and the `renderScreen` language parameter |
| C5 | Loops pass at root and in `desktop/` | met | See the Suites section above |

**Line count:**
- Production: +1,200 / −41 (`src/` and `desktop/src/`, including catalogs and CSS; tests, fixtures and test support excluded). The plan estimated about 1,000 (900–1,100), so this is a modest overrun. The largest new files are 120–128 lines each.
- Tests: +1,758.
- Test support and fixture: +218.
- Docs: +134 / −18.

## 2. Hard gates

| Gate | Result |
|---|---|
| Security surface (no secret echoed, no logging, no plaintext on disk, keying/keychain untouched, MCP not widened) | **No breach.** No `console.*` in `src/context` or `src/importers`. Messages are built only from labels, numbers and unflagged titles. IPC maps the import outcome field by field. An edit refusal crosses IPC as a code only. `SaveContextInput` has no override (`@ts-expect-error` test). Planted values are assembled at runtime: the reviewer's grep of the diff for realistic tier-1 shapes finds no literals |
| Tests for new behaviour; suite passing | **No breach** |
| Ritual evidenced | **No breach** |
| Naming / placement (CLAUDE.md Conventions) | **No breach.** `context/domain/values/secret-finding.ts`, `context/domain/services/secret-detection/*` (a feature folder inside `services/`, approved as P-1), `importers/domain/services/blocking-chunks.ts`, renderer `state/`, `components/`, `screens/import/`. No bare layer-root file, no new application-layer kind. Use-case names keep the repo's suffix-less convention (plan F2) |
| CLI/desktop parity | **No breach** |

## 3. Implementer-reported deviations

| Deviation | Judgement |
|---|---|
| Private-key body may start up to 4 lines below the header; a body on the header line fires | **Accepted.** Legacy encrypted PEM puts `Proc-Type`, `DEK-Info` and a blank line before the body. The inline rule catches JSON-escaped PEM (`"-----BEGIN PRIVATE KEY-----\nMIIE…"`, e.g. service-account JSON), which the plan's rule would miss. Both widen recall without weakening anything. The cost is one false-positive edge case (Warning W-3) |
| Tier-1 tokens with 8+ repeated identical characters skipped as placeholders | **Accepted.** It silences masked examples (`sk_live_xxxxxxxx…`). The chance of a real random key containing 8 identical characters in a row is negligible |
| Tier-2 key boundary uses a lookbehind; an unquoted value stops at a quote; a closing literal quote is skipped | **Accepted.** It handles assignments quoted inside code string literals (`"password: required",` stays silent, `"password: Hunter2Hunter2"` fires). All §8.4 rows pass. The pattern stays bounded |
| `findBlockingChunks` also hides the title when the title alone looks like a secret | **Accepted.** It is stricter than P-6, and it covers a header that truncates or reformats the title |
| Extra helpers (`secretKindRank`, `compareFindings`, `pseudoRandom`) | **Accepted.** Each is small and has one purpose. `compareFindings` is reused by the renderer, which avoids a second sort rule |
| MCP test pins exact input key sets rather than naming `allowSecrets` | **Accepted.** It is a strictly stronger assertion, and it keeps the plan's Slice 11 grep meaningful |
| Edit dialog remembers the last-submitted text to reconcile the generic fallback with P-18 | **Accepted.** Without it, a main-only refusal would show no warning at all. Covered by the "falls back to the generic copy" DOM test |
| SPEC §8 gained a `valija import` line | **Accepted.** It is needed to document `--allow-secrets` on import. Docs only |
| No manual GUI check (no display) | Noted. Not a §12 criterion. The new CSS uses only `--color-warning` and `--color-text-muted`, and both are defined for light and dark in `tokens.css:15-32`. A visual pass before merge is still advisable |

## 4. Issues

### Critical
None.

### Warning

- **W-1. Tier 3 flags certificate bodies and OpenSSH public keys.**
  - Reviewer probe: `detectSecrets` on a `-----BEGIN CERTIFICATE-----` block whose body lines are random base64 returns two `high-entropy-string` findings. A one-line `ssh-ed25519 AAAA…` key also fires.
  - Tier 1 is correct here. `known-formats.test.ts` only exercises `findKnownFormats`, so no test covers the whole detector on public material.
  - This is within the letter of the spec: §8.3's exclusion list does not mention PEM public blocks or SSH public keys, so it is not a criterion failure. It is still exactly the §14 dead-end risk: public material is common in developer notes, and over MCP there is no override.
  - Recommended follow-up:
    - add a tier-3 exclusion for lines inside a `BEGIN (PUBLIC KEY|RSA PUBLIC KEY|CERTIFICATE|…)` … `END` block;
    - add one for a token preceded on the line by `ssh-(rsa|ed25519|dss)|ecdsa-sha2-…`;
    - add `detectSecrets`-level negative tests for both;
    - per the spec's tuning rule, document the change in `specs/context.md`.
- **W-2. The renderer re-runs the detector on every keystroke while the warning is up.**
  - `item-edit-dialog.tsx` calls `detectSecrets(draft.content)` during render.
  - The `content:edit` schema accepts up to 1,000,000 characters, so a large paste after a refusal is scanned on every render. Typing in a large draft could feel sluggish.
  - Fix: wrap the call in `useMemo(() => …, [secretRefused, draft.content])`.
- **W-3. Private-key false positive.**
  - Prose that names a private-key header, followed within 4 lines by any 32+ character `[A-Za-z0-9+/=]` line, fires `private-key`. A 40-character hex git SHA is enough.
  - Reviewer probe: a header mention, then `commit`, then a SHA → `private-key` on lines 1–3.
  - Fix: in `firstBodyLine`, reject a candidate body line that is pure hex (real PEM base64 is mixed-case), and add a negative test.

### Suggestion

- **S-1. Hidden title inside curly quotes.** The `import.blockingChunk` copy wraps `{title}` in `“…”` / `«…»`, so a hidden title renders as `#4 “(title hidden — it may contain a secret)”`. Add a `blockingChunkUntitled` key without quotes in `en` and `es` (the CLI already omits the quotes).
- **S-2. The cap of 5 is written twice.** It appears in `describeFindings` (`secret-finding.ts`) and in `describeSecretFindings` (`renderer/state/secret-findings.ts`). Export one `FINDINGS_CAP` from `secret-finding.ts` and use it in both, so the CLI, MCP and desktop cannot drift.
- **S-3. `LineContext` in `high-entropy-string.ts`.** A class with two lazily cached getters is heavier than this pure-function folder needs. Two `let`-memoised locals inside `findHighEntropyStrings`, or a small `lineFacts(text)` closure, would read more plainly.
- **S-4. Ambiguous `docs/gui.md` sentence.** "Press **Import** anyway and nothing is imported" reads like the **Import anyway** button. Reword to "Press **Import** and nothing is imported: …".
- **S-5. Double sort.** `uniqueFindings` sorts, and `describeFindings` and `describeSecretFindings` sort again. The second sort is harmless (callers may pass unsorted lists), but a one-line comment would prevent a future "optimisation" that drops the needed one.

## 5. What would flip this to FAIL
Nothing outstanding. W-1 to W-3 are false-positive and performance hardening inside the approved spec and its accepted D-F trade-off. Address them in a follow-up, ideally together with the D-J audit advance.
