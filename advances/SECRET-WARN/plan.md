Approved: Oscar 2026-10-20 — all Decisions to confirm (P-1 … P-18) at their recommended defaults

# SECRET-WARN — Secret warning on save · Implementation Plan

**Spec:** `advances/SECRET-WARN/refined.md`. Oscar approved it at Gate R on 2026-10-19, and all 15
decisions (D-A … D-O) are resolved there. This plan follows those resolutions and does not reopen
them. Two of them shape most of the plan:
- **D-E, option 2:** an import is all-or-nothing. Any flagged chunk refuses the whole import unless
  a human overrides it.
- **D-F, option 3:** detection covers tiers 1, 2 and 3.

Where the spec leaves a choice to the planner, this plan picks a recommended default and lists the
choice in §6 *Decisions to confirm*. Those choices are: where the remedy text is attached (§5),
detector placement (§11), the order of the two pre-session checks (§10.4), and a few smaller ones.

**Branch:** `feat/secret-warning-SECRET-WARN`, following `{feature}/{ADVANCE}`. The orchestrator
reports that it already exists and is stacked on `feat/project-detect-PROJECT-DETECT`, which is
stacked on `feat/curation-CURATION`. The working tree therefore contains every CURATION and
PROJECT-DETECT change (bindings, detection, `EditItem`, 37 desktop channels, …). The planner has not
created or switched any branch. If either parent merges to `main` first, rebase onto `main` before
shipping.

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** `.claude/hooks/guard-implementation.sh` enforces this mechanically for
> `src/**`, `desktop/**`, `package.json` and build config. The planner never writes that line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Every claim in `refined.md` §3 was re-checked against the working tree, and all of them hold:
- the six write paths and their entry points
- no human "create item" path
- `parseContent` trims and caps content at 32 KB
- `SaveContext` archives the `supersedes` target inside its one `session.write`
- dry-run never reaches `ImportItems`
- `toIpcResult` sends only the error code
- the renderer already imports `ITEM_TYPES` from `src/`
- the CLI has no localization
- the `save_context` description already says "Never include secrets"
- schema v4

The facts below are **not in the spec**. Each one changes how a slice is written.

- **F1. The desktop error-copy test reads `src/` directly.** `desktop/src/shared/i18n/error-copy.test.ts`
  regex-scans `src/context/domain/errors.ts`. The `POSSIBLE_SECRET` copy in `en.ts`/`es.ts` must
  therefore land in the **same slice** as the code (Slice 1). Otherwise the `desktop/` loop stays red
  until the UI slice (the same issue as CURATION F1 and PROJECT-DETECT F1).
- **F2. Use-case classes have no `UseCase` suffix.** `CLAUDE.md` says `XUseCase`, but the repo uses
  bare names (`SaveContext`, `EditItem`, `ImportItems`, `ImportConversations`). This advance adds no
  use case. It only extends those four, and keeps the repo's names.
- **F3. `ImportItems` parses content inside the session** (`saveDraft`, inside `session.write`), and
  it collects a bad chunk as a failure instead of aborting. The whole-batch refusal is therefore a
  **new step before `withSession`**. It does not go into `saveDraft` (spec §3 fact 6).
- **F4. `ImportConversations` loses the listing index once it has selected.** `selectConversations`
  returns a plain `Conversation[]`. The `#n` the spec wants is the conversation's position in the
  date-sorted full list (1-based, the same number `toListing` prints and `--pick` reads). The plan
  rebuilds it with one `Map<Conversation, number>` built from the sorted list.
- **F5. Chunk line 1 is the provenance header, and it contains the conversation title**
  (`> Imported from ChatGPT · "<title>" · <date> · part n/m`). So a secret pasted into a title is
  flagged on line 1, and printing that title in the blocking list would echo the secret. Spec §10.1
  forbids that, while §10.5 says titles may cross. The plan hides the title in that one case (P-6).
- **F6. `content:edit` already spreads its request into `EditItem`** (`({ id, ...fields }) =>
  editItem.execute({ item: id, ...fields })`). The handler needs no change: adding `allowSecrets` to
  the schema and to `ContentEditRequest` is enough. The **schema change is load-bearing**. `z.object`
  strips unknown keys, so without the schema field the flag would be dropped silently and **Save
  anyway** would loop forever. A schema test pins this.
- **F7. `desktop/src/shared/ipc/messages.ts` stays free of root `src/` imports** (its own comment on
  `ImportFormatOverride`). The wire type for a finding therefore carries `kind: string`. The renderer
  narrows it with the domain's `isSecretKind` before looking up a label.
- **F8. Three typed test literals break when `ImportOutcomeResponse` gains fields:**
  `import.dom.test.tsx:50` (`OUTCOME`), `import.dom.test.tsx:274` (`outcomeWithFailure`), and the fake
  `importConversations` in `import-handlers.test.ts:290`. The fake's value is mapped field by field,
  so a missing `blockingChunks` would throw. All three are fixed in the slice that adds the fields
  (Slice 8).
- **F9. `no-network-surface.test.ts` scans `*.test.tsx`**, and only `.test.ts` files are exempt. DOM
  tests must not plant a `url-credentials` secret, because it contains `https://`. They use the AWS
  and credential-assignment fixtures instead.
- **F10. `import-no-reimplementation.test.ts` forbids `desktop/` from importing
  `importers/domain/services/`.** The blocking list is computed only in main, through
  `ImportConversations`, which matches D-D. The renderer imports **only** the context detector
  (`context/domain/services/secret-detection/detect-secrets.ts`) and the kind value, and neither is on
  the forbidden list.
- **F11. The renderer's tsconfig has Node types available** (`tsconfig.web.json` `types: ["vite/client",
  "node"]`). The compiler therefore would **not** catch a `node:` import or a `Buffer` use in the
  detector, even though the renderer cannot run them. A guard test in Slice 1 (§1.7) catches it.
- **F12. The desktop dialog only sends `content` when it changed** (`editRequestFor`). Unchanged
  content is never re-sent from the desktop, so it is never re-scanned there. On the CLI, `edit
  --content-file` with unchanged content **is** scanned (D-I). Both behaviours are correct.
- **F13. No CLI test exists for `valija import`.** Slice 6 adds `src/delivery/cli/import-command.test.ts`,
  modelled on `curation-commands.test.ts` (an `Exit` throw, spied `console`, a real temp vault).
- **F14. `server.test.ts` already pins every tool's input-schema keys** (`"keeps every tool's input
  schema exactly as declared"`) and the 5-tool / 2-prompt count. These pass **unmodified**, which is
  the AC "no tool input schema changed".
- **F15. The golden fixture is seeded through the repository** (`golden-vault.ts:162`,
  `items.save(...)`), not through a use case. It is unaffected, so there is no regeneration.
  `expected-pack.md` becomes a whole-document negative fixture (§8.4).
- **F16. Collision sweep (spec §3 fact 14).** The tree was grepped for every tier-1 prefix, for
  `password|secret|api_key|token` followed by an assignment operator, and for 32+ character runs in
  tests and fixtures. **No test saves content the new rules would refuse.** The only `ghp_…` strings
  sit inside git remote URLs in binding tests, which are not content writes. ULIDs (26 characters)
  are below the tier-3 minimum length. The implementer re-confirms this by running the full suites at
  the end of Slice 4. Any collision is fixed by changing the test content, with a comment
  (spec §12).
- **F17. The MCP error format is `` `${message} [${code}]` ``** (`server.ts` `err`). The walkthrough's
  leading `Refused:` is not reproduced. The message starts "The content looks like it contains a
  secret — …" (W2).
- **F18. `SPEC.md` is both a doc this advance edits and a must-be-silent fixture.** Every slice that
  edits `docs/SPEC.md` re-runs the whole-document negative test (it is in the default loop). Docs
  therefore **describe** patterns and never quote must-fire examples.

**Spec wrinkles (none blocking):**

- **W1. Label case.** The §8.1 table capitalizes labels ("Private key", "Credential assignment"), but
  the walkthrough prints them mid-sentence in lower case ("credential assignment (line 9)",
  "high-entropy string (line 5)"). The English CLI/MCP labels follow the walkthrough. The desktop
  labels are capitalized, because each one starts a list line (P-15).
- **W2. MCP wording.** As F17 explains, the `Refused:` prefix is dropped, and the code suffix comes
  from the existing formatter. The remedy text is exactly the spec's.
- **W3. Titles in the blocking list** (F5): §10.1 and §10.5 conflict when the secret *is* in the
  title. The plan hides the title in that case (P-6).
- **W4. A refused real import returns a successful outcome, not an error.** §6 needs the blocking
  list on the desktop (fact 7), so `ImportConversations` returns `ok({ refused: true, … })`. The CLI
  turns that into `error [POSSIBLE_SECRET]` and exit code 1, as §2.4 and §6 require. `ImportItems`'s
  own defense-in-depth refusal **is** an `err(POSSIBLE_SECRET)`.

---

## 1. Summary

The plan has eleven slices (1–11). They run from the pure detector, one tier per slice, through the
use cases, then the three delivery surfaces (CLI, MCP, desktop), and end with a final gate.

1. **Domain foundation.** The closed 12-kind enum and the finding value, plus the tier-1
   known-format rules. Also the detector entry point, the refusal policy, `POSSIBLE_SECRET` with its
   desktop copy (F1), and the shared planted-secret fixtures.
2. **Tier 2.** The `credential-assignment` rule and the §8.4 tier-2 corpora.
3. **Tier 3.** The `high-entropy-string` rule, the §8.4 tier-3 corpora, the whole-document negatives
   (SPEC, golden pack, lockfile excerpt), the adversarial time bound, and the final thresholds
   documented in `specs/context.md`.
4. **Context use cases.** `SaveContext` refuses with no override. `EditItem` and `ImportItems` gain
   `allowSecrets?`. Every refusal happens before the session.
5. **Importers.** `findBlockingChunks`, and `ImportConversations` returns `refused` +
   `blockingChunks` in dry-run and real mode and threads the override through.
6. **CLI.** `--allow-secrets` on `edit` and `import`, the import's blocking listing (dry-run exits 0,
   a real run exits 1), and a per-surface remedy.
7. **MCP.** The model-directed remedy and one description sentence on each save tool. Still five
   tools, two prompts, and no schema change.
8. **Desktop IPC.** `allowSecrets` on the `content:edit` and `import:run` schemas, the blocking list
   in `ImportOutcomeResponse`, and explicit outcome mapping.
9. **Desktop Edit dialog.** The warning with **Edit text** and **Save anyway**, the localized
   finding text in `renderer/state/`, and the catalogs.
10. **Desktop Import screen.** The blocking list in Preview and Import, with **Uncheck these
    conversations** and **Import anyway**, the catalogs, and `docs/gui.md`.
11. **Final gate.** No file changes; a whole-diff check against spec §12.

**Production lines: about 1,000 in total** (≈ 640 in `src/`, ≈ 360 in `desktop/src/`). Tests add
about 1,350 lines, test support and fixtures about 110, and docs about 170. There are zero
migrations, zero new dependencies, zero new MCP tools or arguments, zero new CLI commands, zero new
IPC channels, and zero changes to pack rendering.

---

## 2. Ordered slices

**Every slice ends green on both workspaces** (exact commands in §4.3):
`npm run typecheck && npm run lint && npm run test` at the repo root, **and**
`cd desktop && npm run typecheck && npm run lint && npm run test`. Slice 1 already touches `desktop/`
(F1), and `desktop/` compiles root `src/` files, so both loops run every time.

Each slice lists the docs that ship in the same commit (`CLAUDE.md`: "Docs ship in the same commit
as the code").

---

### Slice 1 — Domain foundation: kinds, finding, tier 1, detector, refusal policy (+ desktop error copy)

**Rationale.** The detector is the heart of the advance and a pure function of a string. This slice
pins its shape before any caller exists:
- the closed kind enum
- a finding type that **cannot** hold text
- tier precedence
- line ranges
- the Node-free guard
- the refusal message

Tier 1 lands here because the shape needs at least one real rule to prove precedence and
multi-line ranges (private keys).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/domain/values/secret-finding.ts` | new: `SECRET_KINDS`, `SecretKind`, `SecretFinding`, `SECRET_KIND_LABELS`, `isSecretKind`, `describeFindings` | ~60 |
| `src/context/domain/services/secret-detection/secret-match.ts` | new: `SecretMatch`, `WHOLE_LINE`, `tierOf` | ~20 |
| `src/context/domain/services/secret-detection/placeholder.ts` | new: `isPlaceholder` (the common exclusions) | ~30 |
| `src/context/domain/services/secret-detection/known-formats.ts` | new: tier 1, `findKnownFormats` | ~95 |
| `src/context/domain/services/secret-detection/detect-secrets.ts` | new: `detectSecrets` (precedence, findings) | ~45 |
| `src/context/domain/services/secret-detection/secret-refusal.ts` | new: `refusePossibleSecrets`, `refuseFlaggedImport`, `importRefusedMessage` | ~35 |
| `src/context/domain/errors.ts` | + `POSSIBLE_SECRET` | +1 |
| `src/testing/fake-secrets.ts` | new test support: planted secrets built at runtime (P-13) | ~45 (test support) |
| `src/context/domain/values/secret-finding.test.ts` | new | ~55 (test) |
| `…/secret-detection/placeholder.test.ts` | new | ~45 (test) |
| `…/secret-detection/known-formats.test.ts` | new | ~150 (test) |
| `…/secret-detection/detect-secrets.test.ts` | new (extended in Slices 2–3) | ~90 (test) |
| `…/secret-detection/secret-refusal.test.ts` | new | ~45 (test) |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + `errors.POSSIBLE_SECRET` each | +2 |

**1.1 `errors.ts`.** Append `"POSSIBLE_SECRET"` to `ContextErrorCode`.

**Invariant for every message built in this advance:** it may contain kind labels, line numbers,
counts, conversation indexes, part numbers and, when the header is not flagged (P-6), a title. It
**never** contains matched text, a prefix, a suffix, a mask or a length. Each surface's slice
asserts this end to end.

**1.2 `values/secret-finding.ts`**

```ts
/** Closed and ordered by precedence: tier 1 (known formats), then tier 2, then tier 3. */
export const SECRET_KINDS = [
  "private-key", "aws-access-key", "github-token", "anthropic-api-key", "openai-api-key",
  "slack-token", "stripe-secret-key", "google-api-key", "jwt", "url-credentials",
  "credential-assignment", "high-entropy-string",
] as const;
export type SecretKind = (typeof SECRET_KINDS)[number];

/** WHERE a possible secret is, never WHAT it is: by design there is no field that could hold matched text. */
export interface SecretFinding {
  readonly kind: SecretKind;
  readonly firstLine: number; // 1-based
  readonly lastLine: number;  // === firstLine except for multi-line blocks (private keys)
}

/** English, mid-sentence (CLI and MCP). Product names keep their case (W1). */
export const SECRET_KIND_LABELS: Record<SecretKind, string> = { … };
export const isSecretKind = (value: string): value is SecretKind => …;

/** "GitHub token (line 7), private key (lines 12–40)", capped: "…, and 3 more" (D-H). */
export function describeFindings(findings: readonly SecretFinding[], cap = 5): string
```

- **Labels:** `private key`, `AWS access key`, `GitHub token`, `Anthropic API key`, `OpenAI API
  key`, `Slack token`, `Stripe secret key`, `Google API key`, `JSON Web Token`, `credentials in a
  URL`, `credential assignment`, `high-entropy string`.
- **`describeFindings`**:
  - sorts by `firstLine`, then by kind order;
  - keeps the first `cap` findings and joins them with `, `;
  - renders `label (line n)` or `label (lines a–b)` (en dash);
  - appends `, and N more` when it cut anything.
  - It is called only with a non-empty list.

**1.3 `services/secret-detection/secret-match.ts`.** This file is internal to detection and never
leaves the folder.

```ts
/** A finding plus its column span on `firstLine`; used only to apply tier precedence. */
export interface SecretMatch { kind: SecretKind; firstLine: number; lastLine: number; start: number; end: number }
/** `end` for a match that covers its lines entirely (multi-line blocks). */
export const WHOLE_LINE = Number.MAX_SAFE_INTEGER;
export const tierOf = (kind: SecretKind): 1 | 2 | 3 =>
  kind === "credential-assignment" ? 2 : kind === "high-entropy-string" ? 3 : 1;
```

**1.4 `placeholder.ts`: the common exclusions (§8, every tier)**

```ts
/** True when a value is obviously not a real secret: a template, a mask, or documentation filler. */
export function isPlaceholder(value: string): boolean
```

One check per line, all case-insensitive where it matters:
- `<…>`, `${…}`, `{{…}}`, `%VAR%`, `$VAR` (a whole-value or contained template marker);
- a run of one repeated character (`/^(.)\1+$/`);
- contains `example`, `placeholder`, `redacted`, `changeme`, `dummy`, `sample`, `your_` or `your-`.

AWS's documented `…EXAMPLE…` keys fall under `example`.

**1.5 `known-formats.ts`: tier 1**

```ts
/** Tier 1: provider formats and structural secrets. Each rule needs a realistic length or structure. */
export function findKnownFormats(lines: readonly string[]): SecretMatch[]
```

- **Single-line rules.** A small table of `{ kind, pattern }`. Every pattern is global, anchored
  on a literal prefix, and uses **bounded** quantifiers. Anthropic is listed before OpenAI, so
  within tier 1 the `sk-ant-` span wins (§8.1). A token passing `isPlaceholder` is skipped.

  | kind | shape (minimums are the "realistic length") |
  |---|---|
  | `aws-access-key` | `\b(AKIA\|ASIA)[A-Z0-9]{16}\b` |
  | `github-token` | `\bgh[pousr]_[A-Za-z0-9]{36}\b`, `\bgithub_pat_[A-Za-z0-9_]{22,255}` |
  | `anthropic-api-key` | `\bsk-ant-[A-Za-z0-9_-]{32,255}` |
  | `openai-api-key` | `\bsk-(?:proj-)?[A-Za-z0-9_-]{32,255}` (not starting `ant-`) |
  | `slack-token` | `\bxox[abprs]-[A-Za-z0-9-]{10,255}` |
  | `stripe-secret-key` | `\b(?:sk\|rk)_live_[A-Za-z0-9]{16,255}`, `\bsk_test_[A-Za-z0-9]{16,255}` |
  | `google-api-key` | `\bAIza[0-9A-Za-z_-]{35}\b` |
  | `jwt` | `\beyJ[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,2048}` (structural, P-14) |

- **`private-key` (multi-line).** A header line matching `-----BEGIN (RSA |EC |DSA |OPENSSH
  |ENCRYPTED )?PRIVATE KEY-----` or `-----BEGIN PGP PRIVATE KEY BLOCK-----`, **followed within 3
  lines by a base64 body line of at least 32 characters**. The match spans the header line through
  the matching `-----END …-----` line, or through the last body line if there is no END line, with
  `start: 0, end: WHOLE_LINE`.
  - A bare header in prose does not fire (P-16).
  - `PUBLIC KEY` and `CERTIFICATE` headers are never matched.
- **`url-credentials`.** `\b[a-z][a-z0-9+.-]{0,30}://([^\s/:@]{1,256}):([^\s/@]{1,256})@`. It
  fires only when the password group is not a placeholder (`isPlaceholder`), not one of
  `password`, `pass`, `secret`, `changeme`, and not `*`-masked. **The groups are inspected in memory
  and never stored**: only `start`/`end` go into the match.

**ReDoS rule (§10.9), stated once for the whole folder:** every quantifier on a character class is
bounded (`{m,n}`), **except** the tier-3 tokenizer in Slice 3. That tokenizer is a single global
`[class]+` scan that never backtracks across tokens. Lines are scanned one at a time.

**1.6 `detect-secrets.ts`**

```ts
/** Every possible secret in `text`: one finding per span, highest tier wins, kind + lines only. */
export function detectSecrets(text: string): SecretFinding[] {
  const lines = text.split(/\r?\n/);
  const matches = [...findKnownFormats(lines)];          // Slice 2 and 3 append their tiers here
  const kept = matches.filter((match) => !isOutranked(match, matches));
  return uniqueFindings(kept.map(toFinding));
}
```

- `isOutranked(m, all)`: some other match has a **lower** tier number, overlaps `m`'s line range,
  and overlaps its column span (`WHOLE_LINE` overlaps everything). Within one tier, the earlier
  table entry wins, which gives the Anthropic-before-OpenAI order.
- `uniqueFindings`: removes duplicate `(kind, firstLine, lastLine)` entries and sorts by line.
- Imports: `../../values/secret-finding.js` and the sibling rule files. **No `node:` import, no
  `Buffer`, no `process`** (F11).

**1.7 `secret-refusal.ts`: the policy the use cases call**

```ts
/** Refuse content that looks like it contains a secret. Callers that allow a human override skip the call. */
export function refusePossibleSecrets(content: string): Result<void, DomainError> {
  const findings = detectSecrets(content);
  if (findings.length === 0) return ok(undefined);
  return contextErr("POSSIBLE_SECRET",
    `The content looks like it contains a secret — ${describeFindings(findings)}. Nothing was saved.`);
}

/** All-or-nothing (D-E): any flagged chunk refuses the whole batch. */
export function refuseFlaggedImport(contents: readonly string[]): Result<void, DomainError>

export const importRefusedMessage = (flaggedChunks: number): string =>
  `Import refused: ${flaggedChunks} chunk(s) look like they contain secrets. Nothing was imported.`;
```

The message is **surface-neutral**. Each delivery surface appends its own remedy (P-2): the CLI
names `--allow-secrets`, and MCP names a placeholder and never an override.

**1.8 `src/testing/fake-secrets.ts` (P-13).** These are made-up values, **assembled at runtime by
string concatenation**, so no realistic token literal ever sits in the repo (no push-protection or
scanner hits).

```ts
export const PLANTED = {
  awsAccessKey: ["AKIA", "Q7MZ2VK9PL4XR8TW"].join(""),
  githubToken: ["ghp", "_", "Q7mZ2vK9pL4xR8tW1nB6cY3hJ5gF0dS2aE7u"].join(""),
  // … one per tier-1 kind, plus:
  credentialAssignment: { line: "DB_PASSWORD=S3cr3t!Passw0rd", secret: "S3cr3t!Passw0rd" },
  highEntropy: ["Q7mZ2vK9pL4x", "R8tW1nB6cY3h", "J5gF0dS2aE7uI9oP"].join(""),
} as const;
/** The three values every "never echoed" sweep looks for: one per tier (§10.1). */
export const ONE_PER_TIER = [PLANTED.awsAccessKey, PLANTED.credentialAssignment.secret, PLANTED.highEntropy];
```

**1.9 Desktop error copy (F1).** Add `errors.POSSIBLE_SECRET` to both catalogs:

| en | es |
|---|---|
| This looks like it contains a secret, so nothing was saved. | Parece que contiene un secreto, así que no se guardó nada. |

**1.10 Tests**

- `secret-finding.test.ts`:
  - `SECRET_KINDS` has exactly 12 entries, and every kind has a label;
  - `describeFindings` renders `(line n)` and `(lines a–b)`, sorts by line, caps at 5 with
    `, and 2 more`, and stays stable for equal lines;
  - `isSecretKind` accepts every kind and rejects `"password"`.
- `placeholder.test.ts`: one `it.each` row per exclusion (`<API_KEY>`, `${X}`, `{{x}}`, `%X%`,
  `$X`, `xxxxxxxx`, `********`, `........`, `example`, `YOUR_KEY`, `your-key`, `redacted`, `dummy`,
  `sample`, `changeme`, `AKIA…EXAMPLE`), plus negatives such as `S3cr3t!Passw0rd`.
- `known-formats.test.ts`: for **each of the 10 tier-1 kinds**, at least one positive and one
  negative:
  - a prose mention ("OpenAI keys start with `sk-`");
  - a too-short token;
  - a placeholder;
  - the AWS `EXAMPLE` key;
  - a **public key** and a **certificate** block (silent);
  - a bare private-key header with no body (silent);
  - `postgres://user:password@host` and `https://u:${PASS}@h` (silent), against
    `postgres://admin:Zx81QpLm77Hb@db` (fires).

  Positives use `PLANTED`. The private-key block reports `lines a–b`.
- `detect-secrets.test.ts` (grows in Slices 2–3):
  - **no text, by type and by value:** for every `PLANTED` value, `JSON.stringify(detectSecrets(text))`
    contains no 6-character substring of the secret, and every finding has exactly the keys
    `kind`, `firstLine`, `lastLine`;
  - **line ranges:** 1-based; CRLF input yields the same lines as LF;
  - **precedence within tier 1:** `sk-ant-…` yields `anthropic-api-key` once, never also
    `openai-api-key`;
  - **Node-free guard (F11):** reads every non-test `.ts` file in `secret-detection/` plus
    `values/secret-finding.ts`, and asserts none matches `/from "node:|\bBuffer\b|\bprocess\./`.
- `secret-refusal.test.ts`:
  - clean content → `ok`;
  - planted content → `POSSIBLE_SECRET`, whose message names the kind and line and contains no
    planted value;
  - `refuseFlaggedImport(["clean", planted, planted])` → message says `2 chunk(s)`.

**Docs in this commit:**
- `specs/context.md`:
  - §domain/errors (`POSSIBLE_SECRET`);
  - §domain/values (`secret-finding.ts`);
  - §domain/services: a new `secret-detection/` paragraph covering the tier-1 table, the
    placeholder exclusions, precedence, the ReDoS rule, and "Node-free, imported by the desktop
    renderer".

**Done when:** both loops are green and `error-copy.test.ts` passes with `POSSIBLE_SECRET`.

---

### Slice 2 — Tier 2: `credential-assignment`

**Rationale.** Tier 2 is the noisiest rule against code and prose. It lands alone so that its
corpora (§8.4) are the whole diff.

**Files**

| File | Nature | Lines |
|---|---|---|
| `…/secret-detection/credential-assignment.ts` | new: `findCredentialAssignments` | ~85 |
| `…/secret-detection/detect-secrets.ts` | + tier 2 in the match list | +1 |
| `…/secret-detection/credential-assignment.test.ts` | new: §8.4 tier-2 corpora | ~110 (test) |
| `…/secret-detection/detect-secrets.test.ts` | + precedence tier 1 over tier 2 | +15 (test) |

**2.1 `credential-assignment.ts`**

```ts
/** Tier 2 (§8.2): `key <op> value` on one line, where the key names a credential and the value looks real. */
export function findCredentialAssignments(lines: readonly string[]): SecretMatch[]
```

Per line, the rule reads as four steps:

1. **Find key + operator** with one bounded global pattern:
   `(?:^|[\s{,(;])(?:export\s{1,8})?["'`]?([A-Za-z0-9_.-]{1,64})["'`]?\s{0,8}(:=|=>|=|:)\s{0,8}`.
2. **The key names a credential.** `normalizeKey` lowercases the key and removes `_`, `-` and `.`.
   The result must **end with** one of `password`, `passwd`, `secret`, `clientsecret`, `secretkey`,
   `apikey`, `accesskey`, `accesstoken`, `authtoken`, `refreshtoken`, `token`, `privatekey`.
   `pwd` and `pass` are deliberately absent.
3. **Read the value** right after the operator (`readValue`):
   - a quoted `"…"`, `'…'` or `` `…` `` string with **no whitespace inside**, or an unquoted run up
     to whitespace or one of `,` `;` `}` `#`;
   - then the **tail rule:** after optional spaces, the line must end or continue with `,` `;` `}`
     `#`;
   - a value followed by more words yields `null`.
4. **The value looks like a credential** (`looksLikeCredential(value, quoted)`, one `if` per rule):
   - length ≥ 8;
   - ≥ 2 of {lower, upper, digit, symbol}, or length ≥ 16;
   - not `isPlaceholder`, and not one of `null`, `none`, `nil`, `undefined`, `true`, `false`,
     `string`, `number`;
   - no `(` or `)`;
   - not a dotted path (`/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/`);
   - does not start with `$`, `env(` or `secrets.`;
   - not (unquoted **and** `/^[A-Za-z_]+$/`);
   - does not start with `/`, `./` or `~/`.

The match spans the **value's** columns on that line, so a tier-1 token used as the value outranks
it (§8 precedence), and a tier-3 token used as the value is outranked by it.

**2.2 Tests: `credential-assignment.test.ts`**, two `it.each` tables, verbatim from §8.4:

- **must fire** (6 rows) → exactly one `credential-assignment` on line 1:
  - `DB_PASSWORD=S3cr3t!Passw0rd`
  - `export API_KEY="9fK2mQ7xLp4Rt8Vw"`
  - `"client_secret": "Zx81-QpLm-77Hb-ee3R"`
  - `password: Hunter2Hunter2`
  - `stripeSecretKey = 'a8F3kQ9zLm2X'`
  - `token := "q9WvT3kZ8LmN"`
- **must not fire** (16 rows) → `[]`:
  - `password = stored in the keychain`
  - `password: required`
  - `token: string`
  - `password: z.string().min(8)`
  - `secret = config.secret`
  - `apiKey = process.env.OPENAI_API_KEY`
  - `DB_PASSWORD=${DB_PASSWORD}`
  - `password=<your-password>`
  - `API_KEY=changeme`
  - `api_key: "your_api_key_here"`
  - `password = ********`
  - `max_tokens = 4000`
  - `token budget: 4000 tokens`
  - `accessToken = refreshedAccessToken`
  - `PWD=/home/oscar/code`
  - `password_policy: "min 12 chars"`
- **key boundary:** `tokenizer = Abc12345xyz`, `secretary: Abc12345xyz` → silent;
  `DB_PASSWORD` and `stripeSecretKey` fire.
- **multi-line:** an assignment on line 4 of a markdown note → `firstLine: 4`.

`detect-secrets.test.ts` gains:
- `OPENAI_API_KEY=<a PLANTED openai key>` → one `openai-api-key`, no `credential-assignment`.

**Docs in this commit:** `specs/context.md` §domain/services `secret-detection/` gains the tier-2
rules in prose (the key suffix list, operators, value rules), with no must-fire example quoted (F18).

**Done when:** both loops are green and all 22 corpus rows match.

---

### Slice 3 — Tier 3: `high-entropy-string`, whole-document negatives, time bound

**Rationale.** Tier 3 is the rule most likely to produce false positives (spec §14). It lands with
the three whole-document negatives and the adversarial bound in the same commit, so the thresholds
are tuned against **both** corpora at once (§8.3 rule 5).

**Files**

| File | Nature | Lines |
|---|---|---|
| `…/secret-detection/high-entropy-string.ts` | new: `findHighEntropyStrings`, `shannonEntropy`, thresholds | ~100 |
| `…/secret-detection/detect-secrets.ts` | + tier 3 in the match list | +1 |
| `…/secret-detection/high-entropy-string.test.ts` | new: §8.4 tier-3 corpora | ~120 (test) |
| `…/secret-detection/detect-secrets.test.ts` | + whole-document negatives, time bound, tier precedence | +70 (test) |
| `…/secret-detection/__fixtures__/package-lock-excerpt.json` | new: ~60 lines cut from this repo's `package-lock.json` | data |

**3.1 `high-entropy-string.ts`**

```ts
/** The §8.3 thresholds. Changing one is a code change documented in specs/context.md, never a setting (D-G). */
export const MIN_TOKEN_LENGTH = 32;
export const MAX_TOKEN_LENGTH = 200;
export const MIN_ENTROPY_BITS = 4.3;

/** Tier 3 (§8.3): a long, mixed, random-looking token that no exclusion explains. */
export function findHighEntropyStrings(lines: readonly string[]): SecretMatch[]
export function shannonEntropy(token: string): number
```

Per line: tokenize with one global `/[A-Za-z0-9+/=_-]+/g` (maximal runs, linear). A token fires
when it passes four checks:
1. `isCandidateLength(token)`: from 32 to 200 characters;
2. `hasCharacterMix(token)`: ≥ 2 uppercase, ≥ 2 lowercase, ≥ 2 digits;
3. `shannonEntropy(token) >= MIN_ENTROPY_BITS`;
4. `!isExplained(token, line, start)`, where `isExplained` has one `if` per §8.3 rule 4 exclusion:
   - **hex-like:** `/^(?:[a-z]{1,8}[-_])?[0-9a-fA-F]+$/`, which covers SHAs of any length, md5,
     sha256 and `imp-<32 hex>` (A2);
   - **UUID or ULID** as the whole token or as a `-`/`_`-delimited segment (UUID 8-4-4-4-12 hex;
     ULID exactly 26 of `[0-9A-HJKMNP-TV-Z]`);
   - **SRI:** the token starts with `sha256-`, `sha384-` or `sha512-`;
   - **data URI:** the text right before the token ends with `;base64,` inside a `data:` prefix;
   - **hash context:** the line before the token matches
     `\b(sha1?|sha256|sha512|md5|hash|digest|checksum|integrity|etag|commit|fingerprint)\b` (i);
   - **URL:** the token starts inside a `scheme://…` span (bounded scheme, up to the next
     whitespace);
   - **path:** the token starts with `/`. The tokenizer drops `.` and `~`, so `./`, `../` and `~/`
     also reach this check as `/…`;
   - **word path:** ≥ 2 `/`, and no segment passes `hasCharacterMix` on its own;
   - **placeholder:** `isPlaceholder(token)`.

Tier-1 and tier-2 coverage needs no rule of its own here: `detectSecrets`' precedence drops a
tier-3 match that overlaps a higher-tier one.

**Tuning rule.** The implementer may move the three constants only while **both** corpora and all
three whole-document negatives stay green. The final values (initially 32 / 200 / 4.3) go into
`specs/context.md` in this commit.

**3.2 Tests**

- `high-entropy-string.test.ts`, verbatim from §8.4:
  - **must fire:**
    - the 40-character mixed token in prose (`PLANTED.highEntropy`);
    - `Authorization: Bearer 8fJ2kL9mQ4rT7vX1zB5nC3pD6sG0hW2y`;
    - a 48-character base64url token with `-` and `_` on its own line.
  - **must not fire:**
    - 7-, 40- and 64-character lowercase hex, including `commit 3f2a…`;
    - the UUID;
    - the ULID, and `imp-` + 32 hex;
    - an `"integrity": "sha512-…=="` value;
    - a `data:image/png;base64,…` run longer than 200 characters;
    - the two paths;
    - the GitHub blob URL;
    - `createImportedContextItemFromDraft`;
    - 36 × `A`;
    - the `search_context`-style result line with an id.
  - `shannonEntropy("aaaa") === 0`, and `shannonEntropy` of 32 distinct characters is 5.
- `detect-secrets.test.ts` additions:
  - **whole-document negatives (§8.4, AC):** `detectSecrets(readFileSync(<repo>/docs/SPEC.md))`,
    `…/src/testing/__fixtures__/golden-vault/expected-pack.md` and
    `__fixtures__/package-lock-excerpt.json` each return `[]`.
  - **precedence across tiers:** a JWT → only `jwt`; `API_KEY=<40-char PLANTED.highEntropy>` →
    only `credential-assignment`; a private-key block → one `private-key` finding spanning its
    lines, and no `high-entropy-string` on its body lines.
  - **one planted value per tier in one document** → exactly three findings with the right lines.
  - **adversarial time bound (§10.9, P-12):** each of six 32 KB shapes completes in **< 250 ms**
    (measured with `performance.now()`, best of 3 runs):
    1. `a=` repeated;
    2. one 32 KB line of `A`;
    3. `-----BEGIN PRIVATE KEY-----\n` repeated;
    4. `x://a:` repeated;
    5. `password: "` repeated;
    6. 32 KB of 40-character random base64 lines (the worst case for entropy work).

**Docs in this commit:**
- `specs/context.md` `secret-detection/`: the tier-3 rules, the **final thresholds**, the list of
  exclusions, and "best effort: known formats, credential assignments and random-looking strings;
  hex secrets outside an assignment, short passwords in prose, and anything saved before this
  advance pass silently" (§14).

**Done when:** both loops are green, every §8.4 row matches, all three whole-document negatives
return `[]`, and the six time-bound cases pass.

---

### Slice 4 — Context use cases: refuse before the session

**Rationale.** This slice puts enforcement in the use cases (D-M), so every caller inherits it,
including a seventh path added later. Each change is a few lines in `parseInput`, or just before
`withSession`.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/context/application/use-cases/save-context.use-case.ts` | refuse in `parseInput` (no override, D-N) | +3 |
| `src/context/application/use-cases/edit-item.use-case.ts` | + `allowSecrets?`; refuse in `parseInput` | +6 |
| `src/context/application/use-cases/import-items.use-case.ts` | + `allowSecrets?`; whole-batch refusal before the session | +6 |
| `…/use-cases/save-context.use-case.test.ts` | + secret cases | +70 (test) |
| `…/use-cases/edit-item.use-case.test.ts` | + secret cases | +60 (test) |
| `…/use-cases/import-items.use-case.test.ts` | + secret cases | +50 (test) |

**4.1 `SaveContext`.** In `parseInput`, right after `parseContent` succeeds:

```ts
const content = parseContent(input.content);
if (!content.ok) return content;
const safe = refusePossibleSecrets(input.content);   // the raw input, so lines match what the model sent (P-4)
if (!safe.ok) return safe;
```

- `SaveContextInput` gains **no** field. The model's inability to override is structural (D-N).
- Order: project → type → tags → content (size) → **secrets** → supersedes. The size cap runs first,
  so detection never scans more than a capped value (P-3, §3 item 3).

**4.2 `EditItem`.** `EditItemInput` gains:

```ts
/** A human's explicit "save it anyway" (CLI --allow-secrets, desktop Save anyway). Never set by an AI tool. */
allowSecrets?: boolean;
```

Inside the existing `if (input.content !== undefined)` block, after `parseContent`:

```ts
if (input.allowSecrets !== true) {
  const safe = refusePossibleSecrets(input.content);
  if (!safe.ok) return safe;
}
```

Tags-only and type-only edits never reach this check (D-I). Unchanged content re-sent from the CLI
**is** checked (D-I, F12).

**4.3 `ImportItems`.** `ImportItemsInput` gains `allowSecrets?: boolean`. In `execute`, after
`parseProjectName` and **before** `withSession`:

```ts
if (input.allowSecrets !== true) {
  const safe = refuseFlaggedImport(input.items.map((item) => item.content));
  if (!safe.ok) return safe;
}
```

- Defense in depth (§6): `ImportConversations` already refuses before calling this (Slice 5), so
  in practice this check runs only on content that is already clean. It costs one extra linear
  scan per chunk (R3).
- The per-chunk failure collection in `saveDraft` stays exactly as it is (F3).
- Update the class doc comment: "A flagged batch is refused whole, before the session, unless
  `allowSecrets`."

**4.4 Tests** (real SQLCipher vault, `makeUnlockedVault()`; generation via
`vault.deviceIdentity.lastSeen(vault.vaultId)?.generation`; content from `PLANTED`):

- `save-context.use-case.test.ts`:
  1. one planted value per tier → `POSSIBLE_SECRET`; the message names the kind and the line, and
     contains no planted value;
  2. **nothing written:** a new project name → `listProjects` does not contain it (not
     auto-created); the item count is unchanged; the generation is unchanged;
  3. **`supersedes` untouched:** save A; save B with a secret and `supersedes: A` → refused, and A
     is still live (not archived);
  4. **lock order (P-3):** with the vault locked, clean content → `VAULT_LOCKED` (unchanged), and a
     secret → `POSSIBLE_SECRET`;
  5. **type-level:** `// @ts-expect-error` on `{ …, allowSecrets: true }` proves `SaveContextInput`
     has no override.
- `edit-item.use-case.test.ts`:
  1. a content edit with a secret → `POSSIBLE_SECRET`; the item content is unchanged; the generation
     is unchanged;
  2. the same edit with `allowSecrets: true` → saved;
  3. an item whose content already holds a secret (saved with `allowSecrets`): a **tags-only** edit
     and a **type-only** edit both succeed;
  4. re-submitting that same content without the flag → `POSSIBLE_SECRET` (D-I);
  5. multi-line: a private-key block reports `lines a–b` in the message.
- `import-items.use-case.test.ts`:
  1. three drafts, one flagged → `POSSIBLE_SECRET` with `1 chunk(s)`; **zero** items written; the
     project not created; the generation unchanged;
  2. the same with `allowSecrets: true` → all three imported;
  3. all clean → unchanged behaviour (the existing cases pass unmodified).

**Docs in this commit:**
- `specs/context.md` §application use cases: `SaveContext` (refuses, no override), `EditItem` and
  `ImportItems` (`allowSecrets`, refusal before the session).
- `docs/SPEC.md`:
  - §12 Q2 → struck through and **Resolved by SECRET-WARN** (one line: "a best-effort secret check
    on every write; a human can override, an AI tool cannot", pointing to `advances/SECRET-WARN/`);
  - §9 *Rules*: one paragraph on the three tiers, "best effort", the closed rules with no settings,
    no scan of existing content, no scan on read, and "do not paste secrets into AI tools" kept.
- `README.md` §"Security model (short version)": the same honest summary.

**Done when:** both loops are green. The **full** root suite passes unmodified apart from the new
cases, which re-confirms the F16 collision sweep.

---

### Slice 5 — Importers: blocking chunks, all-or-nothing, override threaded through

**Rationale.** Dry-run and real runs must list exactly the same blocking chunks (§5, AC). One
domain function, called from one place in `ImportConversations` for both modes, makes that true by
construction (§3 fact 5).

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/importers/domain/services/blocking-chunks.ts` | new: `ChunkToScreen`, `BlockingChunk`, `findBlockingChunks` | ~35 |
| `src/importers/application/use-cases/import-conversations.use-case.ts` | `allowSecrets?`; output `refused` + `blockingChunks`; listing index | +45 |
| `src/importers/domain/services/blocking-chunks.test.ts` | new | ~70 (test) |
| `…/use-cases/import-conversations.use-case.test.ts` | + secret cases | +90 (test) |

**5.1 `domain/services/blocking-chunks.ts`**

```ts
/** One chunk about to be imported, labelled the way the user sees it in the listing. */
export interface ChunkToScreen { conversationIndex: number; title: string; part: number; content: string }

/** A chunk that blocks the import. `title` is null when the title itself looks like a secret (P-6). */
export interface BlockingChunk { conversationIndex: number; title: string | null; part: number; findings: SecretFinding[] }

/** D-E: every chunk with a possible secret, in listing order. The same call serves dry-run and the real run. */
export function findBlockingChunks(chunks: readonly ChunkToScreen[]): BlockingChunk[] {
  return chunks.flatMap((chunk) => {
    const findings = detectSecrets(chunk.content);
    if (findings.length === 0) return [];
    const titleIsFlagged = findings.some((finding) => finding.firstLine === 1);   // line 1 = provenance header (F5)
    return [{ conversationIndex: chunk.conversationIndex, title: titleIsFlagged ? null : chunk.title, part: chunk.part, findings }];
  });
}
```

`importers/domain` imports `context/domain` here, which the dependency rule allows
(`importers → context`). `chunk-render.test.ts` already does the same.

**5.2 `ImportConversations`**

- **Input:** `allowSecrets?: boolean` (same doc comment as `EditItemInput`).
- **Output:** `ImportConversationsOutput` gains two **required** fields (P-17). `summary()` defaults
  them to `false` / `[]`, so list mode is unchanged.

  ```ts
  /** dry-run: a real run would be refused; import: it was refused and nothing was written (D-E). */
  refused: boolean;
  blockingChunks: BlockingChunk[];
  ```

- **`buildItems`** returns `chunks: ChunkToScreen[]` alongside `items` (same order, same loop). The
  listing index comes from `const listingIndex = new Map(conversations.map((c, i) => [c, i + 1]))`,
  built once from the sorted list (F4). `part` is `chunkIndex + 1`.
- **`execute`**, after `buildItems`, in this order:

  ```ts
  const blockingChunks = input.allowSecrets === true ? [] : findBlockingChunks(chunks);
  const refused = blockingChunks.length > 0;
  if (mode === "dry-run") return ok(this.summary(mode, …, { imported: items.length, conversations: contributed, skipped, refused, blockingChunks }));
  if (refused) return ok(this.summary(mode, …, { imported: 0, conversations: 0, skipped, refused, blockingChunks }));
  const written = this.importItems.execute({ projectName, items, ...(input.allowSecrets === true ? { allowSecrets: true } : {}) });
  ```

  A refused real run **never calls** `ImportItems`. Nothing is written, and the project is not
  created.
- The class doc comment gains one sentence on the all-or-nothing rule.

**5.3 Tests**

- `blocking-chunks.test.ts`:
  - clean chunks → `[]`;
  - two flagged chunks of conversation #4 (parts 1 and 3) → two entries with the right parts, in
    order;
  - a finding on line 1 → `title: null`; a finding on line 5 → the title is kept;
  - `JSON.stringify(result)` contains no planted value.
- `import-conversations.use-case.test.ts` (fake reader and registry as today, plus a **spy**
  `ImportItems`):
  1. dry-run with conversation #2 flagged → `refused: true`, one blocking entry with
     `conversationIndex: 2`, and the counts unchanged (they still report what *would* import);
  2. a real run with the same input → `refused: true`, `imported: 0`, and **the spy was never
     called**;
  3. **dry-run list equals real-run list:** `expect(real.blockingChunks).toEqual(dry.blockingChunks)`
     for the same input and selection (AC);
  4. `--pick` that excludes #2 → `refused: false`, and the spy receives every selected chunk;
  5. `allowSecrets: true` → `blockingChunks: []`, `refused: false`, and the spy receives
     `allowSecrets: true`;
  6. `--query` / `--since` selections keep the **full-listing** index (F4): with #1 filtered out, a
     flagged #3 still reports `3`;
  7. list mode → `refused: false`, `blockingChunks: []`.

**Docs in this commit:**
- `specs/importers.md`:
  - §domain/services (`blocking-chunks.ts`);
  - §application use cases (`allowSecrets`, `refused`, `blockingChunks`, all-or-nothing, dry-run
    parity);
  - §Security (titles hidden when flagged; no secret text in any outcome).

**Done when:** both loops are green (the desktop compiles the widened output type).

---

### Slice 6 — CLI: `--allow-secrets`, the blocking listing, per-surface remedy

**Rationale.** These are the human override and the actionable listing on the CLI. They ship
together, so the CLI half of the parity table is complete in one commit.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/cli/render.ts` | `fail(error, remedy?)` | +2 |
| `src/delivery/cli/curation-commands.ts` | `--allow-secrets` on `edit`; edit remedy | +6 |
| `src/delivery/cli/import-command.ts` | `--allow-secrets`; dry-run block; refused-run error + listing | +45 |
| `src/delivery/cli/program.ts` | two `.option("--allow-secrets", …)` | +4 |
| `src/delivery/cli/curation-commands.test.ts` | + edit secret cases | +60 (test) |
| `src/delivery/cli/import-command.test.ts` | new (F13) | ~170 (test) |

**6.1 `render.ts`.** A backward-compatible signature change:

```ts
export function fail(error: DomainError, remedy?: string): never {
  console.error(`error [${error.code}]: ${error.message}${remedy === undefined ? "" : ` ${remedy}`}`);
  process.exit(1);
}
```

**6.2 `edit`**

- `EditOptions` gains `allowSecrets?: boolean`, and `editCommand` passes it through.
- On failure:

  ```ts
  const EDIT_SECRET_REMEDY = "Remove it, or re-run with --allow-secrets to save it anyway.";
  if (!result.ok) fail(result.error, result.error.code === "POSSIBLE_SECRET" ? EDIT_SECRET_REMEDY : undefined);
  ```

- `program.ts`: `.option("--allow-secrets", "save even if the content looks like it contains a secret")`.
- There is no prompt (D-C). The `--content-file -` stdin path is unchanged.

**6.3 `import`.** `ImportOptions` gains `allowSecrets?: boolean`, passed into the input.
`renderSummary` becomes three small functions:

```ts
if (summary.mode === "import" && summary.refused) return renderRefusedImport(summary);   // stderr, exit 1
renderCounts(summary);                                                                    // today's line + failures
if (summary.mode === "dry-run" && summary.refused) renderWouldBeRefused(summary);         // stdout, exit 0
```

- **`blockingLine(chunk)`:** `` `  #${chunk.conversationIndex} ${chunk.title === null ? "(title hidden)" : `"${truncate(chunk.title, 48)}"`} part ${chunk.part} — ${describeFindings(chunk.findings)}` ``
- **`renderWouldBeRefused`** (stdout):
  ```
  A real import would be REFUSED: N chunk(s) look like they contain secrets.
  <blockingLine…>
  Leave those conversations out of the selection (--pick / --query / --since), or add --allow-secrets.
  ```
- **`renderRefusedImport`** (stderr, then `process.exit(1)`):
  ```
  error [POSSIBLE_SECRET]: <importRefusedMessage(N)>
  <blockingLine…>
  Leave those conversations out of the selection, or re-run with --allow-secrets.
  ```
- A `POSSIBLE_SECRET` **error** from `ImportItems` (defense in depth, never expected in practice)
  goes through `fail(error, IMPORT_SECRET_REMEDY)`.
- `program.ts`: `.option("--allow-secrets", "import even if some chunks look like they contain secrets")`.

**6.4 Tests**

- `curation-commands.test.ts`:
  1. `edit --content-file f` with a planted secret → exit 1; the stderr line equals
     `error [POSSIBLE_SECRET]: The content looks like it contains a secret — AWS access key (line 2). Nothing was saved. Remove it, or re-run with --allow-secrets to save it anyway.`;
     the item is unchanged (via `showProject`);
  2. the same with `allowSecrets: true` → `Updated fact … (content).`;
  3. `--tags` only on an item that already holds a secret → succeeds;
  4. **sweep:** joined stdout and stderr contain no value from `ONE_PER_TIER`, for one file per tier.
- `import-command.test.ts`. The container has a real `ImportConversations` (`FileExportReader`,
  `parserRegistry`) plus a real `ImportItems` on a temp vault. The input is a generic-format export
  with 4 conversations written to a temp file: #2 holds `PLANTED.awsAccessKey` on a known line, and
  #4 holds a credential assignment.
  1. `--all --dry-run` → no exit; stdout contains the counts line, the REFUSED line, `  #2 "…" part 1
     — AWS access key (line N)`, the #4 line, and the remedy;
  2. `--all` → exit 1; stderr starts `error [POSSIBLE_SECRET]: Import refused: 2 chunk(s)`;
     `showProject` → `PROJECT_NOT_FOUND` (zero items, project not created);
  3. **parity:** the blocking lines in 1 and 2 are identical (AC);
  4. `--pick 1,3` → `Imported …`, exit not called;
  5. `--all --allow-secrets` → imports every chunk;
  6. `--all --dry-run --allow-secrets` → no REFUSED block;
  7. a conversation **titled** with a planted secret → its line reads `#k (title hidden) part 1 — …`;
  8. **sweep:** no output line in any case contains a value from `ONE_PER_TIER`.

**Docs in this commit:**
- `docs/SPEC.md` §8: `edit` and `import` gain `[--allow-secrets]`, plus one paragraph on the refusal,
  the dry-run listing, all-or-nothing, and exit codes.
- `specs/delivery.md` §cli (the `edit`/`import` rows, `fail(error, remedy?)`).
- `README.md`: §"Curating your context" (`--allow-secrets` on `edit`) and §"Import your history"
  (all-or-nothing, the dry-run listing, `#n` usable with `--pick`, `--allow-secrets`).
- `CHANGELOG.md` `Added`: "Secret check on every write (CLI)".

**Done when:** both loops are green and both CLI sweeps pass.

---

### Slice 7 — MCP: a model-directed refusal, and one description sentence per save tool

**Rationale.** On MCP there is no override (D-B, D-N). The only work here is the refusal text and
proving the surface did not grow.

**Files**

| File | Nature | Lines |
|---|---|---|
| `src/delivery/mcp/server.ts` | `SECRET_REMEDY_FOR_MODELS`; `refusal(error)`; +1 sentence on each of two descriptions | +12 |
| `src/delivery/mcp/server.secrets.test.ts` | new (mirrors `server.detection.test.ts`) | ~130 (test) |

**7.1 `server.ts`**

```ts
/** D-B: tell the model how to fix the call — never how to override it. */
const SECRET_REMEDY_FOR_MODELS =
  "Remove it or replace it with a placeholder such as <API_KEY>, then call the tool again. " +
  "If it is not a secret, describe it instead of quoting it.";

const refusal = (error: DomainError) =>
  err(error.code === "POSSIBLE_SECRET" ? new DomainError(error.code, `${error.message} ${SECRET_REMEDY_FOR_MODELS}`) : error);
```

- In `save_context` and `save_handoff`, `if (!r.ok) return err(r.error)` becomes
  `return refusal(r.error)`. Every other tool is untouched.
- The descriptions gain one sentence each (P-8):
  - `save_context`: after "Never include secrets, API keys, or passwords.", add **"Content that
    looks like a credential (keys, tokens, passwords, long random strings) is refused with
    POSSIBLE_SECRET and nothing is saved."**
  - `save_handoff`: the same sentence appended.
- No `inputSchema` changes, and no prompt text changes.

**7.2 Tests: `server.secrets.test.ts`** (an in-memory `Client` as in `server.test.ts`; a real
temp vault):

1. `save_context` with one planted value per tier → `isError`, text ends with `[POSSIBLE_SECRET]`,
   names the kind and the line, contains `placeholder` and `describe it`;
2. the text matches none of `/allow|override|anyway|--allow-secrets|force/i` (§10.3);
3. no planted value appears in the text;
4. **nothing written:** a new project name → `list_projects` does not list it; the item count is
   unchanged;
5. `supersedes` with a secret → the target is still returned by `search_context` (still live);
6. `save_handoff` with a secret → the same refusal;
7. a clean save → the existing success text, byte-identical;
8. `listTools()` → 5 tools; every `save_context` / `save_handoff` input property set is unchanged
   (the assertion in `server.test.ts`, F14, passes unmodified); `listPrompts()` → 2.

**Docs in this commit:**
- `docs/SPEC.md` §7: one paragraph — save tools refuse content that looks like a secret with
  `POSSIBLE_SECRET`; the reply names kinds and lines and suggests a placeholder; there is no
  override argument; still five tools.
- `README.md` §"The MCP surface".
- `specs/delivery.md` §mcp.
- `CHANGELOG.md` `Added` (MCP).

**Done when:** both loops are green and `server.test.ts` passes **unmodified**.

---

### Slice 8 — Desktop IPC: flags on two existing schemas, blocking list in the outcome

**Rationale.** IPC stays closed (§10.5): this slice adds no channel, two strict optional booleans,
and one outcome extension. It lands separately from the UI, so the wire contract is reviewed on its
own.

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/shared/ipc/messages.ts` | `allowSecrets?` on `ContentEditRequest` and `ImportRunRequest`; `SecretFindingMessage`, `BlockingChunkMessage`; `ImportOutcomeResponse` + `refused`, `blockingChunks` | +22 |
| `desktop/src/main/ipc/schemas.ts` | `allowSecrets: z.boolean().optional()` on `content:edit` and `import:run` | +2 |
| `desktop/src/main/ipc/handlers/import-handlers.ts` | pass `allowSecrets` on run; explicit `toOutcome` mapping; `emptyOutcome` | +20 |
| `desktop/src/main/ipc/schemas.test.ts` | + flag cases | +25 (test) |
| `desktop/src/main/ipc/handlers/content-handlers.curation.test.ts` | + edit secret cases | +40 (test) |
| `desktop/src/main/ipc/handlers/import-handlers.test.ts` | + secret cases; fix the fake (F8) | +70 (test) |
| `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` | two typed literals + 2 fields (F8) | +4 (test) |

`content-handlers.ts` needs **no change** (F6). `preload/index.ts`, `bridge.ts` and `channels.ts`
need **no change**, because the request and response types widen through the existing type
imports.

**8.1 `messages.ts`**

```ts
/** Kind + lines only: there is no field that could carry matched text (§10.1). `kind` is a SecretKind id (F7). */
export interface SecretFindingMessage { kind: string; firstLine: number; lastLine: number }
export interface BlockingChunkMessage { conversationIndex: number; title: string | null; part: number; findings: SecretFindingMessage[] }
// ImportOutcomeResponse gains:
  refused: boolean;
  blockingChunks: BlockingChunkMessage[];
```

`ContentEditRequest` and `ImportRunRequest` gain `allowSecrets?: boolean`, each with the doc
comment "a human's Save anyway / Import anyway". `ImportPreviewRequest` deliberately gains nothing:
Preview always shows the block.

**8.2 `import-handlers.ts`**

- `import:run` forwards `...(req.allowSecrets === true ? { allowSecrets: true } : {})`.
- `toOutcome` maps **field by field**. It never spreads a domain object (§10.5):
  `blockingChunks: v.blockingChunks.map((c) => ({ conversationIndex: c.conversationIndex, title:
  c.title, part: c.part, findings: c.findings.map((f) => ({ kind: f.kind, firstLine: f.firstLine,
  lastLine: f.lastLine })) }))`.
- `emptyOutcome` gains `refused: false, blockingChunks: []`.

**8.3 Tests**

- `schemas.test.ts`:
  - `content:edit` accepts `allowSecrets: true` and rejects `allowSecrets: "true"`;
  - `import:run` behaves the same;
  - `import:preview` with `allowSecrets: true` parses with the key **stripped** (the handler never
    sees it);
  - the existing no-path block is untouched.
- `content-handlers.curation.test.ts` (real `EditItem`):
  - a content edit with a planted secret → `{ ok: false, error: { code: "POSSIBLE_SECRET" } }`
    exactly (code only), and `JSON.stringify(response)` contains no planted value;
  - the same with `allowSecrets: true` → `{ ok: true, value: { changed: true, … } }`;
  - **main refuses regardless of the renderer:** a raw handler call without the flag is refused
    (AC "Main refuses without the override flag").
- `import-handlers.test.ts` (real `ImportConversations` plus a temp vault, as its existing cases):
  - `import:preview` → `refused: true` and the blocking list;
  - `import:run` → `refused: true`, and `content:show` → `PROJECT_NOT_FOUND`;
  - `import:run` with `allowSecrets: true` → imported;
  - preview list = run list;
  - `JSON.stringify` of every outcome contains no planted value;
  - **F8:** the fake at `:290` gains `refused: false, blockingChunks: []`.

**Docs in this commit:** `specs/desktop.md` §IPC surface: the two flags, the outcome fields,
"still 37 channels", and "the blocking list crosses as data, never as an error message".

**Done when:** both loops are green, and `register-handlers.test.ts` (closed channel set) passes
unmodified.

---

### Slice 9 — Desktop Edit dialog: warning, Edit text, Save anyway

**Rationale.** This gives the desktop half of the edit override. The renderer reuses the domain
detector only to **describe** a refusal that main has already made. Main stays the enforcer (D-D).

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/renderer/state/secret-findings.ts` | new: `describeSecretFindings` (localized, sorted, capped) | ~35 |
| `desktop/src/renderer/state/secret-findings.test.ts` | new | ~60 (test) |
| `desktop/src/renderer/components/secret-warning.tsx` | new: `SecretWarning` | ~40 |
| `desktop/src/renderer/components/item-edit-dialog.tsx` | `secretRefused` prop; `onSave(draft, allowSecrets)`; renders `SecretWarning` | +12 |
| `desktop/src/renderer/screens/project.tsx` | `secretRefused` state; `saveEdit(item, draft, allowSecrets)` | +12 |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + `secrets.*` (12 kinds, 4 format strings, 4 warning strings) | +40 |
| `desktop/src/renderer/styles/screens.css` | + `.secret-warning` | +8 |
| `desktop/src/renderer/screens/__dom-tests__/project.dom.test.tsx` | + edit warning cases | +70 (test) |

**9.1 `state/secret-findings.ts`**

```ts
/** "Stripe secret key (line 3), Private key (lines 12–40)" in the UI language, capped like the CLI (D-H, D-O). */
export function describeSecretFindings(findings: readonly SecretFindingMessage[], t: Translator["t"], cap = 5): string
```

- Unknown kinds are skipped by `isSecretKind`, which is never expected but keeps a stale main from
  rendering a raw id (F7).
- Each finding renders through `t("secrets.finding", { kind: t(`secrets.kinds.${kind}`), where })`.
  `where` is `t("secrets.line", { line })` or `t("secrets.lines", { from, to })`, and overflow is
  `t("secrets.more", { count })`.

**9.2 `components/secret-warning.tsx`**

```tsx
/** The refusal, in words: what kind, which lines, why it matters — never the secret (D-D, D-H). */
export function SecretWarning({ findings, onEditText, onSaveAnyway, disabled }: …)
```

The component renders `role="alert"` containing:
- the bold `secrets.warningTitle`;
- the described findings;
- `secrets.warningBody` (the best-effort copy, §10.8);
- two buttons, **Edit text** and **Save anyway**.

**9.3 Dialog and screen (P-5: main first, then describe)**

- `project.tsx` `saveEdit(item, draft, allowSecrets = false)`:
  - sends `allowSecrets ? { ...request, allowSecrets: true } : request`;
  - on `!result.ok && result.error.code === "POSSIBLE_SECRET"` it sets `secretRefused` to `true`
    and returns, so the dialog stays open and keeps the draft;
  - every other path is unchanged;
  - opening the dialog resets `secretRefused`.
- `item-edit-dialog.tsx`:
  - `onSave: (draft, allowSecrets: boolean) => void`; the form submit calls `onSave(draft, false)`;
  - when `secretRefused` is set, it renders `<SecretWarning findings={detectSecrets(draft.content)}
    onEditText={() => contentRef.current?.focus()} onSaveAnyway={() => onSave(draft, true)} />`
    **above** `.modal-actions`. That keeps **Save** the last focusable control, and the existing
    Tab-trap test passes unchanged;
  - findings are recomputed from the current draft (P-18): if the user has removed the secret, the
    list is empty and the warning hides;
  - **fallback:** main refused, but the renderer finds nothing (not expected, since it is the same
    code). The warning then shows `errors.POSSIBLE_SECRET` in place of the list, still with
    **Save anyway**.
- `detectSecrets` is imported from
  `../../../../src/context/domain/services/secret-detection/detect-secrets.js`, following the
  `ITEM_TYPES` precedent (§3 fact 8).

**9.4 Copy** (new `secrets` namespace; neutral Spanish, product names untranslated, D-O)

| key | en | es |
|---|---|---|
| `kinds.private-key` | Private key | Clave privada |
| `kinds.aws-access-key` | AWS access key | Clave de acceso de AWS |
| `kinds.github-token` | GitHub token | Token de GitHub |
| `kinds.anthropic-api-key` | Anthropic API key | Clave de API de Anthropic |
| `kinds.openai-api-key` | OpenAI API key | Clave de API de OpenAI |
| `kinds.slack-token` | Slack token | Token de Slack |
| `kinds.stripe-secret-key` | Stripe secret key | Clave secreta de Stripe |
| `kinds.google-api-key` | Google API key | Clave de API de Google |
| `kinds.jwt` | JSON Web Token | JSON Web Token (JWT) |
| `kinds.url-credentials` | Credentials in a URL | Credenciales en una URL |
| `kinds.credential-assignment` | Credential assignment | Asignación de credencial |
| `kinds.high-entropy-string` | High-entropy string | Cadena de alta entropía |
| `finding` | {kind} ({where}) | {kind} ({where}) |
| `line` | line {line} | línea {line} |
| `lines` | lines {from}–{to} | líneas {from}–{to} |
| `more` | and {count} more | y {count} más |
| `warningTitle` | This looks like it contains a secret. | Parece que esto contiene un secreto. |
| `warningBody` | Secrets saved in Valija can reach every AI tool you connect. This check is best effort: it can miss a secret or flag something that isn't one. | Los secretos guardados en Valija pueden llegar a todas las herramientas de IA que conectes. Esta comprobación es orientativa: puede pasar por alto un secreto o marcar algo que no lo es. |
| `editText` | Edit text | Editar texto |
| `saveAnyway` | Save anyway | Guardar de todos modos |

**9.5 Tests**

- `secret-findings.test.ts`:
  - **every `SECRET_KINDS` member has an `en` and an `es` label** (the parity between the domain
    enum and the catalogs that D-O requires);
  - `line` / `lines` / cap rendering in both languages;
  - an unknown kind is skipped.
- `project.dom.test.tsx` (a fake bridge, **no `https://`** (F9); content uses `PLANTED.awsAccessKey`
  and `PLANTED.credentialAssignment.line`):
  1. Save with a secret, with `edit` mocked to return `POSSIBLE_SECRET` → the dialog stays open, the
     textarea keeps the text, the alert shows "AWS access key (line 2)", and **the planted value is
     absent from the alert's `textContent`**;
  2. **Save anyway** → `edit` called a second time with `{ …, allowSecrets: true }`, the dialog
     closes, and the list reloads;
  3. **Edit text** → `document.activeElement` is the textarea, and `edit` is not called again;
  4. Spanish (`language: "es"`) → "Clave de acceso de AWS (línea 2)";
  5. the existing cases pass unchanged (Save exact-name match, Tab trap, refused-save copy).

**Docs in this commit:**
- `docs/gui.md` §"Browsing, searching, and taking a pack" ("Keeping a project current"
  paragraph): Edit refuses text that looks like a secret, says what kind and where, and offers
  **Save anyway**, with the best-effort sentence.
- `specs/desktop.md` §Renderer view state (`secret-findings.ts`) and §Screens (Edit dialog).
- `CHANGELOG.md` `Added` (desktop edit).

**Done when:** both loops are green; `catalogs.test.ts`, `error-copy.test.ts` and
`no-network-surface.test.ts` pass; and a manual run (`cd desktop && npm run dev`) shows the warning
in light **and** dark themes.

---

### Slice 10 — Desktop Import screen: blocking list, Uncheck these, Import anyway

**Rationale.** This completes desktop parity with `valija import`: the same list in Preview and on
Import, and both ways forward.

**Files**

| File | Nature | Lines |
|---|---|---|
| `desktop/src/renderer/screens/import/blocking-chunk-list.tsx` | new: `BlockingChunkList` | ~50 |
| `desktop/src/renderer/screens/import/import-status.tsx` | renders the list; a refused import replaces the summary | +15 |
| `desktop/src/renderer/screens/import/import-screen.tsx` | `refusedRequest` state; `submitImport(request)`; Uncheck / Import anyway handlers | +35 |
| `desktop/src/renderer/state/import-selection.ts` | + `uncheckConversations` | +8 |
| `desktop/src/renderer/state/import-selection.test.ts` | + cases | +20 (test) |
| `desktop/src/shared/i18n/catalogs/en.ts`, `es.ts` | + 7 `import.*` keys each | +24 |
| `desktop/src/renderer/styles/screens.css` | + `.blocking-chunks` | +8 |
| `desktop/src/renderer/screens/__dom-tests__/import.dom.test.tsx` | + refusal cases | +90 (test) |

**10.1 State helper**

```ts
/** "Uncheck these": drop the blocking conversations from the selection, leaving every other choice alone. */
export function uncheckConversations(checked: ReadonlySet<number>, indexes: readonly number[]): Set<number>
```

**10.2 Screen**

- `runSelection(mode)` builds the request as today and delegates to `submitImport(mode, request)`,
  which holds today's `try/catch/finally` body.
- On `import` with `result.value.refused`, the screen stores `setRefusedRequest(request)`.
- **Import anyway** → `submitImport("import", { ...refusedRequest, allowSecrets: true })`. It
  re-sends **exactly** the refused selection (P-11), never a selection edited since then.
- **Uncheck these conversations** →
  `setChecked(uncheckConversations(checked, blocking.map((c) => c.conversationIndex)))`, then
  clears the outcome and `refusedRequest`.
- `beginWork` also clears `refusedRequest`, so a stale **Import anyway** never survives a new run.

**10.3 `BlockingChunkList` and `ImportStatus`**

- **Preview with `refused`:** shows `previewSummary` (unchanged), then `import.wouldBeRefused`
  (plural), then the list. There are no buttons: Preview never writes.
- **Import with `refused`:** shows `import.refused` (plural) **in place of** `importSummary`, then
  the list, then `import.blockingRemedy`, then **Uncheck these conversations** and **Import
  anyway**. `excludedFromPacksNotice` is hidden.
- **Each line:** `t("import.blockingChunk", { index, title: title ?? t("import.titleHidden"),
  part, findings: describeSecretFindings(findings, t) })`.
- The region stays the single `aria-live` status (D-4), so the refusal is announced.

**10.4 Copy**

| key | en | es |
|---|---|---|
| `wouldBeRefused` (plural) | one: A real import would be refused: {count} chunk looks like it contains a secret. · other: A real import would be refused: {count} chunks look like they contain secrets. | one: Una importación real se rechazaría: {count} fragmento parece contener un secreto. · other: Una importación real se rechazaría: {count} fragmentos parecen contener secretos. |
| `refused` (plural) | one: Import refused — nothing was imported. {count} chunk looks like it contains a secret. · other: Import refused — nothing was imported. {count} chunks look like they contain secrets. | one: Importación rechazada: no se importó nada. {count} fragmento parece contener un secreto. · other: Importación rechazada: no se importó nada. {count} fragmentos parecen contener secretos. |
| `blockingChunk` | #{index} “{title}”, part {part}: {findings} | #{index} «{title}», parte {part}: {findings} |
| `titleHidden` | (title hidden — it may contain a secret) | (título oculto: puede contener un secreto) |
| `blockingRemedy` | Uncheck those conversations, or import anyway if you know they aren't secrets. | Desmarca esas conversaciones o importa de todos modos si sabes que no son secretos. |
| `uncheckBlocking` | Uncheck these conversations | Desmarcar estas conversaciones |
| `importAnyway` | Import anyway | Importar de todos modos |

**10.5 Tests**

- `import-selection.test.ts`: `uncheckConversations` removes only the given indexes, ignores
  unknown ones, and never mutates its input.
- `import.dom.test.tsx` (a fake bridge; **no `https://`**, F9):
  1. **Preview** returning `refused` with two chunks → the status shows the would-be-refused copy
     and both lines (`#2 “Deploy debugging”, part 1: AWS access key (line 3)`), with no action
     buttons;
  2. **Import** returning `refused` → the refused copy and the list; **no** "Imported …" summary;
     both buttons are present;
  3. **Import anyway** → `import.run` called with the **same** request plus `allowSecrets: true`;
  4. **Uncheck these conversations** → rows #2 and #4 are unchecked in the table, the other rows
     stay checked, and the refusal clears;
  5. a `title: null` chunk shows `(title hidden — it may contain a secret)`;
  6. Spanish → `#2 «…», parte 1: Clave de acceso de AWS (línea 3)`;
  7. the whole status `textContent` contains no `ONE_PER_TIER` value (the outcome fixture is built
     from findings only, so this guards the renderer against ever printing anything else).

**Docs in this commit:**
- `docs/gui.md` §"Importing your chat history": all-or-nothing, the Preview block, Uncheck / Import
  anyway, and the best-effort sentence. §"What this app deliberately does not do" gains "scan what
  is already in your vault (coming later)".
- `specs/desktop.md` §Screens (Import).
- `CHANGELOG.md` `Added` (desktop import).

**Done when:** both loops are green; `catalogs.test.ts`, `import-copy.test.ts` and
`no-network-surface.test.ts` pass; and a manual run imports a crafted export (refused, then
Uncheck, then Import anyway) in light **and** dark themes.

---

### Slice 11 — Final gate (no file changes)

1. Run both full loops (§4.3).
2. `git diff --exit-code feat/project-detect-PROJECT-DETECT...HEAD -- src/shared/infra/migrations.ts
   src/shared/infra/migrations src/testing/__fixtures__/golden-vault docs/vault-format.md
   src/delivery/context-pack-markdown.ts src/context/domain/services/context-pack.ts` must be
   **empty** (no migration, no fixture change, no pack change, §7).
3. `git diff feat/project-detect-PROJECT-DETECT...HEAD -- package.json package-lock.json
   desktop/package.json` must be **empty** (no new dependency, §10.7).
4. `git diff feat/project-detect-PROJECT-DETECT...HEAD -- desktop/src/shared/ipc/channels.ts` must
   be **empty** (no new channel, §10.5).
5. `grep -rnE "console\.(log|error|warn)" src/context src/importers` returns nothing (§10.2).
6. `grep -rn "allowSecrets" src/delivery/mcp` returns nothing (§10.3, D-N).
7. `grep -rn "node:" src/context/domain/services/secret-detection src/context/domain/values/secret-finding.ts`
   returns nothing (F11; the guard test also checks this).
8. `server.test.ts` still reports 5 tools and 2 prompts, with its schema-key assertion unmodified.
9. Walk spec §12 line by line against §4.2 below, then hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

1. **Size cap, then detection, then the vault.** `parseContent` runs first, so detection never runs
   on uncapped content. The secret check runs next, still inside `parseInput`. Only then does
   `withSession` open. A refused write therefore never opens a session, never creates a project,
   never archives a `supersedes` target and never bumps lineage. Tests assert each of the four
   (Slice 4).
2. **Locked vault (P-3).** Because parsing comes first, a locked vault plus a secret answers
   `POSSIBLE_SECRET`, and a locked vault plus clean content still answers `VAULT_LOCKED`. Neither
   path reads the vault, and neither error carries content (§10.4).
3. **The override is structural, not a convention.** `SaveContextInput` has no `allowSecrets`
   (type test). `server.ts` never mentions it (Slice 11 grep). The MCP remedy never suggests an
   override (regex test). Only `EditItem` and the import path accept the flag, and only the CLI flag
   and the two desktop buttons set it.
4. **All-or-nothing ordering for imports.** `ImportConversations` builds every selected chunk, then
   `findBlockingChunks`, then returns early on dry-run or refusal. Only a clean or overridden batch
   reaches `ImportItems`, which re-checks the whole batch **before** its session (defense in depth).
   A refused import writes **zero** chunks and creates no project.
5. **No text by type.** `SecretFinding` and `SecretMatch` have no string field besides `kind`. Rule
   code reads regex groups in memory only to apply exclusions, and drops them. Messages are built
   only from labels, numbers and (unflagged) titles. A title on a flagged header line is replaced by
   `null` before it leaves the domain (P-6).
6. **IPC: data, not errors; explicit, not spread.** An edit refusal crosses as `{ code }` only. The
   import blocking list crosses inside the outcome, mapped field by field, so a future domain field
   cannot leak by accident. There is no new channel. `allowSecrets` is a strict optional boolean on
   two existing schemas.
7. **The renderer describes; main enforces.** The renderer runs `detectSecrets` only to word a
   refusal main has already made (P-5). A renderer bug cannot save a secret: main refuses without the
   flag (handler test).
8. **No logging, no files, no network.** No new code in `src/context` or `src/importers` logs (grep
   gate). Nothing is written to preferences, temp files or an allowlist. Detection is in-process
   arithmetic with no new dependency.
9. **ReDoS-safe by construction.** Rule patterns use bounded quantifiers, anchored on literals; the
   tier-3 tokenizer is a single linear scan; entropy is one pass over each token. The six-shape time
   bound test fails the build on a regression (§10.9).
10. **Planted values never sit in the repo as literals** (P-13). This avoids push-protection blocks
    and scanner noise, and it means "the secret never appears" sweeps search for values the source
    file itself does not contain verbatim.

---

## 4. Test plan

### 4.1 By layer

| Layer | Files | Proves |
|---|---|---|
| Domain value | `secret-finding.test.ts` | 12 kinds, labels, `describeFindings` (lines, ranges, cap) |
| Domain rules | `placeholder`, `known-formats`, `credential-assignment`, `high-entropy-string` `.test.ts` | every §8.1 kind ±; every §8.4 tier-2 and tier-3 row |
| Domain detector | `detect-secrets.test.ts` | cross-tier precedence, line ranges, CRLF, no text by type/value, SPEC / golden pack / lockfile → `[]`, 6-shape time bound, Node-free guard |
| Domain policy | `secret-refusal.test.ts` | messages: kinds + lines, counts, no text |
| Importers domain | `blocking-chunks.test.ts` | listing order, parts, hidden title, no text |
| Use cases (real SQLCipher) | `save-context`, `edit-item`, `import-items`, `import-conversations` `.use-case.test.ts` | refusal before session: no write, no project, no lineage bump, `supersedes` live; override saves; tags/type-only unscanned; dry-run list = real list; refused run never calls `ImportItems` |
| CLI | `curation-commands.test.ts`, `import-command.test.ts` | exact lines, exit codes 1/0, `--allow-secrets`, `--pick` narrowing, hidden title, output sweep |
| MCP (in-memory client) | `server.secrets.test.ts`, `server.test.ts` (unmodified) | refusal on both save tools, placeholder remedy, no override wording, nothing written, 5 tools / 2 prompts / schemas unchanged |
| Desktop IPC | `schemas.test.ts`, `content-handlers.curation.test.ts`, `import-handlers.test.ts`, `register-handlers.test.ts` (unmodified) | strict flags, code-only errors, outcome fields, main enforces, payload sweep, 37 channels |
| Desktop view logic | `secret-findings.test.ts`, `import-selection.test.ts` | localized descriptions, enum/catalog parity, uncheck helper |
| Desktop DOM | `project.dom.test.tsx`, `import.dom.test.tsx` | Edit warning, Save anyway, Edit text; Preview/Import blocks, Uncheck, Import anyway; bilingual; no planted text |
| Contracts | `error-copy.test.ts`, `catalogs.test.ts`, `import-copy.test.ts`, `no-network-surface.test.ts`, `import-no-reimplementation.test.ts`, `vault-format-conformance.test.ts` | copy completeness, no network shapes, no importer reimplementation in desktop, schema v4 and fixture unchanged |

### 4.2 Acceptance criteria (spec §12) → where each is checked

| §12 criterion | Checked by |
|---|---|
| Every tier-1 kind ± (prose, placeholders, example keys, public keys, certs) | `known-formats.test.ts` |
| Tier-2 must-fire / must-not-fire | `credential-assignment.test.ts` (22 rows) |
| Tier-3 must-fire / must-not-fire | `high-entropy-string.test.ts` |
| SPEC, `expected-pack.md`, lockfile excerpt → zero findings | `detect-secrets.test.ts` whole-document block (runs in every loop, F18) |
| One finding per span, highest precedence | `detect-secrets.test.ts` precedence block |
| Kind + lines only; one planted value per tier never in any finding/error/outcome/output | `detect-secrets` (findings), use-case messages, `blocking-chunks`, CLI sweeps, MCP case 3, IPC `JSON.stringify` sweeps, DOM `textContent` checks |
| 32 KB adversarial input within a bound | `detect-secrets.test.ts` six shapes < 250 ms |
| Final thresholds in `specs/context.md` | Slice 3 docs; review |
| MCP save tools → `POSSIBLE_SECRET`; nothing saved; no project; `supersedes` live; no bump | `save-context.use-case.test.ts` 1–3 + `server.secrets.test.ts` 1, 4–6 |
| MCP text names kinds/lines, suggests a placeholder, no override; 5 tools / 2 prompts / schemas unchanged | `server.secrets.test.ts` 1–2, 8 + `server.test.ts` unmodified |
| `valija edit` refusal exit 1, item unchanged; `--allow-secrets` saves; tags/type-only never refused | `curation-commands.test.ts` 1–3 + `edit-item.use-case.test.ts` |
| Desktop Edit: localized warning, draft kept, nothing saved; Save anyway saves; main refuses without the flag | `project.dom.test.tsx` 1–4 + `content-handlers.curation.test.ts` |
| `import --dry-run` exit 0 lists every blocking chunk | `import-command.test.ts` 1 |
| Real import: zero items, exit 1, same list; `--allow-secrets` imports all; narrowing imports | `import-command.test.ts` 2, 4, 5 + `import-conversations` 2, 4, 5 |
| Dry-run list = real list | `import-conversations.use-case.test.ts` 3 + `import-command.test.ts` 3 + `import-handlers.test.ts` |
| Desktop Preview list; Import writes nothing and lists; Import anyway imports all | `import.dom.test.tsx` 1–4 + `import-handlers.test.ts` |
| CLI ↔ desktop parity | the table below + both suites |
| `POSSIBLE_SECRET`, 12 kind labels, every new string in `en` + `es` | `error-copy.test.ts`, `catalogs.test.ts`, `secret-findings.test.ts` enum parity |
| No migration; schema v4; golden fixture and conformance unchanged | Slice 11 step 2 + `vault-format-conformance.test.ts` unmodified |
| No new dependency, network call, IPC channel, MCP tool or argument | Slice 11 steps 3, 4, 8 + `no-network-surface.test.ts` + `register-handlers.test.ts` |
| SPEC §12 Q2 resolved; §7, §8, §9 updated; specs, README, CHANGELOG same commit; "best effort" | per-slice docs (Slices 1–10) + review |
| No existing content test weakened | Slice 4 "full suite passes unmodified" + F16 sweep |
| Loops green, root and desktop | §4.3, every slice |

**CLI ↔ desktop parity** (`CLAUDE.md` "Surface parity"):

| Capability | CLI | Desktop |
|---|---|---|
| Refuse an edit that looks like a secret | `valija edit … --content-file` → `POSSIBLE_SECRET`, exit 1 | Edit dialog warning, draft kept |
| Override an edit refusal | `--allow-secrets` | **Save anyway** |
| See which kinds and lines | the error line | the warning's localized list |
| See which chunks would block an import | `import --dry-run` block | **Preview** block |
| Refused import, nothing written | `import` → exit 1 + list | **Import** → refused copy + list |
| Narrow the selection | `--pick` / `--query` / `--since` with `#n` | uncheck rows, or **Uncheck these conversations** |
| Override an import refusal | `--allow-secrets` | **Import anyway** |
| MCP (deliberately narrower) | — | — (refusal only; no override anywhere on MCP) |

### 4.3 Verification loop

```bash
cd /home/user/valija && npm run typecheck && npm run lint && npm run test
cd /home/user/valija/desktop && npm run typecheck && npm run lint && npm run test
# Slices 1–3, the detector alone while tuning:
cd /home/user/valija && npx vitest run src/context/domain/services/secret-detection src/context/domain/values/secret-finding.test.ts
# Slices 8–10, the desktop contracts:
cd /home/user/valija/desktop && npx vitest run src/main/infra/no-network-surface.test.ts src/shared/i18n src/main/ipc
```

The root `typecheck`/`test` do not cover `desktop/`, so both loops run every time.

---

## 5. Assumptions (each one a place the plan could be wrong)

- **A1. Planner-chosen regex minimums are "realistic length".** The §8.1 shapes and minimums in
  Slice 1.5 come from the planner's knowledge of each provider's format as of 2026. A provider
  format change (a new prefix, a shorter key) would slip past tier 1. Tiers 2 and 3 often still
  catch it.
- **A2. The hex-like exclusion allows a short lowercase prefix** (`^(?:[a-z]{1,8}[-_])?[0-9a-fA-F]+$`).
  That is how `imp-<32 hex>` counts as "pure hex" (§8.3). It also silences `abc-<hex>` tokens in
  general. Since tier 3 already requires two uppercase letters, which lowercase hex never has, this
  is belt and braces.
- **A3. `docs/SPEC.md`, `expected-pack.md` and a lockfile excerpt are silent with the initial
  thresholds.** The planner checked SPEC by reading it and found no candidate tokens or credential
  assignments. If a whole-document test fails, the tuning rule (§8.3.5) applies. The implementer
  tightens an exclusion or a threshold, and never edits the fixture to dodge it.
- **A4. 250 ms per 32 KB shape is generous on CI.** Linear passes over 32 KB take single-digit
  milliseconds. A quadratic regression on 32 KB takes seconds. The bound separates the two with
  margin (P-12).
- **A5. Splitting at chunk boundaries.** `hardSplit` can cut a very long single message mid-token,
  so a key may be split across two chunks and missed. This is accepted as "best effort" (§14) and
  noted in `specs/importers.md`.
- **A6. The renderer bundles the detector without config changes.** `ITEM_TYPES` is imported the
  same way today. The detector uses only `String`/`RegExp`/`Map`/`Math`. If Vite's renderer build
  ever refuses a root `src/` file, the fallback is the existing import path pattern, not a copy.
- **A7. Docs per slice satisfy "same commit"** (CURATION A6, PROJECT-DETECT A8). The `--no-ff` merge
  groups them.
- **A8. The `--content-file -` stdin path needs no separate test.** It shares `readContent` with the
  file path, which is tested. The refusal logic sits after reading, in the use case.
- **A9. Existing GitHub-token-shaped strings in binding tests are not affected.** They live in git
  remote URLs handed to `parseRepositoryTarget`, never in content. No new rule runs on bindings
  (D-I).
- **A10. No production caller relies on `ImportConversationsOutput` being exactly its old shape.**
  The CLI, the desktop handler and tests were found by search. The new required fields break only
  the three test literals named in F8.

---

## 6. Decisions to confirm

All of D-A … D-O stand as settled. These are the planning-level calls the spec left open, or that
the plan had to make. For each, the recommended option is listed first.

**P-1. Where the detector lives.**
- **(a) Recommended:** `context/domain/services/secret-detection/`, a feature folder inside
  `services/` that holds the entry point, one file per tier, the placeholder rule and the refusal
  policy.
- (b) Flat files in `services/` (`secret-detection.ts`, `secret-known-formats.ts`, …).
- (c) A new `context/domain/policies/` folder.

*Trade-off:* (a) keeps seven cohesive files together, and each tier stays testable alone (spec §11);
(b) avoids a nested folder but scatters seven `secret-*` files among `context-pack.ts` and
`item-curation.ts`; (c) matches the spec's word "policy", but `policies/` in this repo holds a
stateful class (`SessionGuard`), while these are pure functions.

**P-2. Where the remedy text is attached.**
- **(a) Recommended:** use cases return a surface-neutral message ("…Nothing was saved."). The CLI
  appends `--allow-secrets`; MCP appends the placeholder advice.
- (b) The use case builds per-surface text through a `surface` parameter.

*Trade-off:* (a) keeps the domain ignorant of delivery and makes "MCP never mentions an override"
true by construction; (b) centralizes wording but leaks delivery concepts into the use cases.

**P-3. The order of the secret check and the lock check.**
- **(a) Recommended:** the secret check runs in `parseInput`, before the session. A locked vault plus
  a secret therefore answers `POSSIBLE_SECRET`.
- (b) Open the session first, so a locked vault always answers `VAULT_LOCKED`.

*Trade-off:* (a) follows the repo's parse-first rule (§3 fact 3) and touches nothing; (b) gives a
single answer while locked, but scans content only after reaching the vault.

**P-4. Which text the line numbers refer to.**
- **(a) Recommended:** the raw input (`input.content`), scanned after `parseContent` succeeds.
  "Line 7" then matches the user's file or the dialog's textarea.
- (b) The trimmed, stored `Content`.

*Trade-off:* (a) gives correct line numbers when the file starts with blank lines; (b) numbers lines
as stored, which can be off by the count of leading blank lines.

**P-5. The desktop Edit flow.**
- **(a) Recommended:** call main first. On `POSSIBLE_SECRET`, the renderer runs `detectSecrets` on
  the draft only to describe the refusal.
- (b) The renderer pre-checks on Save and calls main only when the check is clean, or with the
  flag.

*Trade-off:* (a) makes main the single source of truth for whether to block, costs nothing on
clean saves, and still satisfies D-D (the renderer runs the shared detector when Save is pressed and
refused); (b) saves one round-trip on flagged saves, but the decision to block then lives in two
places.

**P-6. Titles in the blocking list when the title itself looks like a secret.**
- **(a) Recommended:** when a chunk's finding is on line 1 (the provenance header), its `title`
  becomes `null`. The CLI prints `(title hidden)` and the desktop prints the catalog copy.
- (b) Always show the title (§10.5 literally).

*Trade-off:* (a) honours §10.1 ("never repeats the secret") in the one case where the title is the
secret, at the cost of a less recognizable line; (b) is simpler but can print a pasted key back to
the terminal.

**P-7. The defense-in-depth rescan in `ImportItems`.**
- **(a) Recommended:** keep it, as §6 requires. Its cost is one extra linear scan per chunk on
  non-overridden imports.
- (b) Have `ImportConversations` pass a "screened" marker so `ImportItems` skips the rescan.

*Trade-off:* (a) protects any future caller of `ImportItems`; (b) is faster on huge imports but
reintroduces a flag a caller could set wrongly.

**P-8. One description sentence on each save tool.**
- **(a) Recommended:** add the same sentence to `save_context` and `save_handoff`.
- (b) Only `save_context`.
- (c) No description change.

*Trade-off:* (a) warns the model before the refusal on both tools, and the spec allows one sentence;
(b) leaves handoffs, which often quote logs, without the hint; (c) relies on the refusal text alone.

**P-9. The MCP placeholder example.**
- **(a) Recommended:** one generic example, `<API_KEY>`.
- (b) A per-kind placeholder (`<AWS_ACCESS_KEY_ID>`, `<GITHUB_TOKEN>`, …).

*Trade-off:* (a) costs one constant, and models adapt it on their own (the walkthrough's
`<AWS_ACCESS_KEY_ID>` came from the variable name); (b) needs 12 more strings to maintain.

**P-10. The findings cap.**
- **(a) Recommended:** 5 entries, then "and N more", on every surface.
- (b) 10 entries.

*Trade-off:* (a) keeps error lines and per-chunk lines readable; (b) shows more detail on documents
with many hits.

**P-11. What Import anyway re-sends.**
- **(a) Recommended:** exactly the refused request, kept in state, plus `allowSecrets`.
- (b) The current selection at click time.

*Trade-off:* (a) guarantees the human overrides precisely what they were shown (§2.4 "re-runs the
same selection"); (b) is less state, but could override chunks that were never listed.

**P-12. The adversarial time bound.**
- **(a) Recommended:** < 250 ms per 32 KB shape, best of 3 runs.
- (b) < 1 s total.

*Trade-off:* (a) catches a quadratic regression early with ample CI margin; (b) is less sensitive to
slow CI but could hide a partial regression.

**P-13. Planted secrets in tests.**
- **(a) Recommended:** build them at runtime in `src/testing/fake-secrets.ts` (string
  concatenation), shared by every layer.
- (b) Literal strings in each test file.

*Trade-off:* (a) avoids GitHub push protection and secret scanners rejecting the branch, and gives
one shared fixture for the "never echoed" sweeps; (b) is easier to read, but a realistic `ghp_` /
`sk_live_` literal can block `git push`.

**P-14. JWT recognition.**
- **(a) Recommended:** structural only: `eyJ…` header, three base64url segments, minimum lengths.
- (b) Also base64-decode the header and require valid JSON with an `alg` field.

*Trade-off:* (a) is simple and Node-free; (b) produces fewer false positives on `eyJ`-prefixed
non-tokens, but needs `atob` and a try/catch inside the detector.

**P-15. English label case.**
- **(a) Recommended:** lower-case generic labels in CLI/MCP sentences (matching the walkthrough), and
  capitalized labels on the desktop (each starts a list item).
- (b) The §8.1 table's capitalization everywhere.

*Trade-off:* (a) reads naturally mid-sentence and matches §2.2/§2.4 exactly; (b) is one table, but
sentences read "…contains a secret — Credential assignment (line 9)".

**P-16. A private-key header with no body.**
- **(a) Recommended:** it fires only with a base64 body line of at least 32 characters within 3
  lines.
- (b) The header alone fires.

*Trade-off:* (a) keeps docs that *mention* PEM headers silent (§8.1 "prose that mentions a format
does not fire"); (b) catches a truncated paste of the header alone, which holds no key material
anyway.

**P-17. `ImportOutcomeResponse` / `ImportConversationsOutput` field optionality.**
- **(a) Recommended:** `refused` and `blockingChunks` are **required**, defaulting to `false` / `[]`.
- (b) Optional.

*Trade-off:* (a) makes every consumer handle the refusal (the compiler finds the three test
literals, F8); (b) avoids touching those literals but lets a renderer forget the refusal silently.

**P-18. The desktop warning follows the draft.**
- **(a) Recommended:** the warning's findings are recomputed from the current text. If the user
  removes the secret, the warning disappears and a plain Save works.
- (b) Freeze the findings at refusal time until the next Save.

*Trade-off:* (a) gives immediate feedback and never shows lines that no longer exist; (b) is static,
but can point at lines the user already fixed.

---

## 7. Naming, placement, and ubiquitous language

**Placement** (`CLAUDE.md` "no bare files at a layer's root"):

| New file | Folder kind | Precedent |
|---|---|---|
| `context/domain/values/secret-finding.ts` | `values/` (enum + value + its formatting) | `item-type.ts`, `repository-target.ts` (`repositoryName`) |
| `context/domain/services/secret-detection/{detect-secrets,secret-match,placeholder,known-formats,credential-assignment,high-entropy-string,secret-refusal}.ts` | **new feature subfolder inside `services/`** (pure, stateless rules) (P-1) | `services/project-resolution.ts`, `importers/infra/parsers/` (a grouped folder) |
| `context/domain/services/secret-detection/__fixtures__/package-lock-excerpt.json` | test data beside its test | `importers/infra/parsers/__fixtures__/` |
| `importers/domain/services/blocking-chunks.ts` | `services/` | `chunk-render.ts`, `selection.ts` |
| `testing/fake-secrets.ts` | test support | `fake-workspace-probe.ts` |
| `delivery/mcp/server.secrets.test.ts` | `mcp/` | `server.detection.test.ts` |
| `delivery/cli/import-command.test.ts` | `cli/` | `curation-commands.test.ts` |
| `desktop/src/renderer/state/secret-findings.ts` | renderer `state/` (pure view logic) | `binding-link.ts`, `item-edit.ts` |
| `desktop/src/renderer/components/secret-warning.tsx` | `components/` | `item-edit-dialog.tsx` |
| `desktop/src/renderer/screens/import/blocking-chunk-list.tsx` | `screens/import/` (an import-screen part) | `import-status.tsx`, `conversation-table.tsx` |

No new layer-root file. `errors.ts` stays the one per-module exception. No `application/` folder
gains a new kind: the policy is a domain service (P-1), and no application-level policy object is
introduced.

**Names**

| Name | Verdict |
|---|---|
| `SECRET_KINDS`, `SecretKind`, `SECRET_KIND_LABELS`, `isSecretKind` | mirror `ITEM_TYPES` / `ItemType`; "kind" is the spec's word (§8) |
| `SecretFinding` (`kind`, `firstLine`, `lastLine`) | "finding" is the spec's word; field names say exactly what they hold |
| `detectSecrets(text)` | the spec's "detector"; reads as a phrase: `const findings = detectSecrets(content)` |
| `findKnownFormats` / `findCredentialAssignments` / `findHighEntropyStrings` | one verb per tier, named after the tier's kind |
| `isPlaceholder`, `isOutranked`, `looksLikeCredential`, `isExplained`, `hasCharacterMix` | predicates read as questions at the call site |
| `refusePossibleSecrets(content)`, `refuseFlaggedImport(contents)` | domain verbs for D-A's "block"; return `Result`, like `archiveSuperseded` |
| `describeFindings` / `describeSecretFindings` | English (domain) vs localized (renderer), named in parallel |
| `findBlockingChunks`, `BlockingChunk`, `ChunkToScreen` | "blocking chunk" and "flagged" come from §2.4/§5 |
| `allowSecrets` / `--allow-secrets` | the spec's flag, verbatim (§6) |
| `refused`, `blockingChunks` (output fields) | the spec's "`refused` flag" and "blocking findings" (§6) |
| `POSSIBLE_SECRET` | the spec's code, verbatim |
| `SECRET_REMEDY_FOR_MODELS`, `EDIT_SECRET_REMEDY`, `IMPORT_SECRET_REMEDY` | constants named for their audience, like `MCP_REMEDY` |
| `SecretWarning`, `BlockingChunkList`, `uncheckConversations` | renderer vocabulary mirroring the domain |
| catalog `secrets.*`, `import.*` additions | namespaced by feature, like `bindings.*` |
| Use cases `SaveContext`, `EditItem`, `ImportItems`, `ImportConversations` | unchanged names (F2): no new use case, no `UseCase` suffix |

**Ubiquitous language.** The model says *possible secret*, *finding*, *kind*, *tier*, *flagged*,
*blocking chunk*, *refuse* and *override*. The copy says "looks like it contains a secret", "Save
anyway", "Import anyway" and "best effort". The copy **never** says "redact", "detected a secret"
(that would claim certainty), "safe" or "guarantee". On MCP, nothing says "override", "allow",
"anyway" or "force".

---

## 8. Estimated line count and risks

### Production lines

| Area | Lines |
|---|---|
| `src/context/domain` (value, 7 detection files, error code) | ~470 |
| `src/context/application` (three use cases) | ~15 |
| `src/importers` (`blocking-chunks.ts`, `ImportConversations`) | ~80 |
| `src/delivery` (render, curation and import commands, program, MCP server) | ~70 |
| `desktop/src/shared/ipc` + `main/ipc` (messages, schemas, import handler) | ~45 |
| `desktop/src/renderer` (secret-findings, secret-warning, dialog, project, blocking list, status, screen, import-selection, css) | ~225 |
| `desktop/src/shared/i18n/catalogs` (en + es: 1 error + 20 `secrets.*` + 7 `import.*` each) | ~90 |
| **Total production** | **~1,000 (range 900–1,100)** |

Tests come to about 1,350 lines. Test support and fixtures add about 110 (`fake-secrets.ts` plus the
lockfile excerpt). Docs come to about 170 lines across SPEC (§7, §8, §9, §12), `specs/` ×4
(context, importers, delivery, desktop), README, `gui.md` and CHANGELOG.

### Risks

1. **R1. False positives become dead ends** (spec §14). They can stall MCP, where no override
   exists, and all-or-nothing imports. Mitigations:
   - the exclusions;
   - three whole-document negatives that run in every loop;
   - exact listings with `#n`;
   - a remedy that tells the model which line to fix;
   - thresholds tunable only against both corpora.

   The residual risk is real. It is Oscar's accepted D-F trade-off.
2. **R2. False confidence.** Hex secrets outside an assignment, short passwords in prose,
   chunk-split tokens (A5), and everything already in the vault (D-J) all pass. All copy says
   "best effort", and D-J's audit is the named follow-up.
3. **R3. Import cost.** Large exports are scanned twice per non-overridden import
   (`ImportConversations`, then `ImportItems`, P-7) and once more per Preview. Both passes are
   linear over ≤ 28 KB chunks, a few milliseconds each. It is noticeable only on exports with
   thousands of chunks, which already block the main process today (`mayStopResponding` copy).
4. **R4. Planted fixtures tripping external scanners.** P-13's runtime assembly is the mitigation.
   If GitHub push protection still flags a concatenated value, the implementer splits it further,
   and never weakens a test.
5. **R5. SPEC.md edits breaking the whole-document negative** (F18). The test runs in every loop.
   Docs describe patterns in words and never paste must-fire examples.
6. **R6. Provider format drift** (A1). The tier-1 shapes age. Updating them is a code change
   documented in `specs/context.md` (§7 of the spec), with a positive and a negative test per
   change.
7. **R7. Renderer and main disagreeing.** It is not expected, because both run the same code on the
   same string. If it happens, the fallback warning still offers **Save anyway**, and main remains
   the enforcer (P-5).
8. **R8. Size.** About 1,000 production lines over eleven slices, smaller than PROJECT-DETECT. Every
   slice is independently green, so review can proceed slice by slice.

---

## 9. Repo structure after execution

Legend: `+` new · `~` changed · unmarked = unchanged context.

```
valija/
├── advances/SECRET-WARN/
│   ├── refined.md                                        (unchanged — Gate R approved)
│   └── plan.md                                           + THIS FILE
├── CHANGELOG.md                                          ~ Added: secret check (CLI, MCP, desktop edit, desktop import)
├── README.md                                             ~ Curating (--allow-secrets) · Import (all-or-nothing) · MCP surface · Security (best effort)
├── docs/
│   ├── SPEC.md                                           ~ §7 refusal · §8 --allow-secrets · §9 rules + limits · §12 Q2 resolved
│   ├── gui.md                                            ~ Edit warning · Import refusal · "does not do" bullet
│   └── vault-format.md                                   (unchanged — no migration, schema v4)
├── specs/
│   ├── context.md                                        ~ POSSIBLE_SECRET · secret-finding · secret-detection/ (tiers, thresholds) · use cases
│   ├── importers.md                                      ~ blocking-chunks · ImportConversations refused/blockingChunks · security
│   ├── delivery.md                                       ~ cli edit/import rows, fail(error, remedy?) · mcp refusal
│   └── desktop.md                                        ~ IPC flags + outcome fields (still 37 channels) · secret-findings · Edit/Import screens
├── src/
│   ├── context/
│   │   ├── domain/
│   │   │   ├── errors.ts                                 ~ + POSSIBLE_SECRET
│   │   │   ├── values/
│   │   │   │   ├── content.ts                            (unchanged — size cap still runs first)
│   │   │   │   ├── secret-finding.ts                     + SECRET_KINDS, SecretKind, SecretFinding, SECRET_KIND_LABELS, isSecretKind, describeFindings
│   │   │   │   └── secret-finding.test.ts                +
│   │   │   └── services/
│   │   │       ├── context-pack.ts                       (unchanged)
│   │   │       └── secret-detection/                     + NEW SUBFOLDER (Node-free; imported by the desktop renderer)
│   │   │           ├── detect-secrets.ts                 + detectSecrets (precedence, findings)
│   │   │           ├── detect-secrets.test.ts            + precedence, no-text, whole-document negatives, time bound, Node-free guard
│   │   │           ├── secret-match.ts                   + SecretMatch, WHOLE_LINE, tierOf
│   │   │           ├── placeholder.ts                    + isPlaceholder
│   │   │           ├── placeholder.test.ts               +
│   │   │           ├── known-formats.ts                  + findKnownFormats (tier 1)
│   │   │           ├── known-formats.test.ts             +
│   │   │           ├── credential-assignment.ts          + findCredentialAssignments (tier 2)
│   │   │           ├── credential-assignment.test.ts     +
│   │   │           ├── high-entropy-string.ts            + findHighEntropyStrings, shannonEntropy, thresholds (tier 3)
│   │   │           ├── high-entropy-string.test.ts       +
│   │   │           ├── secret-refusal.ts                 + refusePossibleSecrets, refuseFlaggedImport, importRefusedMessage
│   │   │           ├── secret-refusal.test.ts            +
│   │   │           └── __fixtures__/
│   │   │               └── package-lock-excerpt.json     + whole-document negative
│   │   └── application/use-cases/
│   │       ├── save-context.use-case.ts                  ~ refuses in parseInput (no override)
│   │       ├── save-context.use-case.test.ts             ~ + secret cases
│   │       ├── edit-item.use-case.ts                     ~ + allowSecrets?
│   │       ├── edit-item.use-case.test.ts                ~ + secret cases
│   │       ├── import-items.use-case.ts                  ~ + allowSecrets?; whole-batch refusal before the session
│   │       └── import-items.use-case.test.ts             ~ + secret cases
│   ├── importers/
│   │   ├── domain/services/
│   │   │   ├── blocking-chunks.ts                        + ChunkToScreen, BlockingChunk, findBlockingChunks
│   │   │   └── blocking-chunks.test.ts                   +
│   │   └── application/use-cases/
│   │       ├── import-conversations.use-case.ts          ~ + allowSecrets?; refused + blockingChunks; listing index
│   │       └── import-conversations.use-case.test.ts     ~ + secret cases, dry-run = real
│   ├── delivery/
│   │   ├── container.ts                                  (unchanged — no new use case)
│   │   ├── cli/
│   │   │   ├── render.ts                                 ~ fail(error, remedy?)
│   │   │   ├── program.ts                                ~ --allow-secrets on edit and import
│   │   │   ├── curation-commands.ts                      ~ edit: allowSecrets + remedy
│   │   │   ├── curation-commands.test.ts                 ~ + secret cases
│   │   │   ├── import-command.ts                         ~ allowSecrets; would-be-refused block; refused import → exit 1
│   │   │   └── import-command.test.ts                    + (first CLI import test)
│   │   └── mcp/
│   │       ├── server.ts                                 ~ refusal(error) + SECRET_REMEDY_FOR_MODELS; +1 sentence × 2 descriptions
│   │       ├── server.test.ts                            (unchanged — 5 tools, 2 prompts, schemas pinned)
│   │       └── server.secrets.test.ts                    +
│   └── testing/
│       └── fake-secrets.ts                               + PLANTED, ONE_PER_TIER (assembled at runtime)
└── desktop/src/
    ├── shared/
    │   ├── ipc/
    │   │   ├── messages.ts                               ~ allowSecrets? ×2 · SecretFindingMessage · BlockingChunkMessage · ImportOutcomeResponse + refused, blockingChunks
    │   │   └── channels.ts                               (unchanged — still 37 channels)
    │   └── i18n/catalogs/
    │       ├── en.ts                                     ~ + errors.POSSIBLE_SECRET · secrets.* (20) · import.* (7)
    │       └── es.ts                                     ~ + errors.POSSIBLE_SECRET · secrets.* (20) · import.* (7)
    ├── main/ipc/
    │   ├── schemas.ts                                    ~ allowSecrets: z.boolean().optional() on content:edit, import:run
    │   ├── schemas.test.ts                               ~ + flag cases
    │   └── handlers/
    │       ├── content-handlers.ts                       (unchanged — already spreads the request, F6)
    │       ├── content-handlers.curation.test.ts         ~ + POSSIBLE_SECRET code-only, override saves
    │       ├── import-handlers.ts                        ~ forwards allowSecrets on run; explicit toOutcome mapping
    │       └── import-handlers.test.ts                   ~ + refusal cases; fake gains new fields (F8)
    ├── preload/index.ts                                  (unchanged — types widen through imports)
    └── renderer/
        ├── state/
        │   ├── bridge.ts                                 (unchanged)
        │   ├── secret-findings.ts                        + describeSecretFindings
        │   ├── secret-findings.test.ts                   + incl. SECRET_KINDS ↔ catalog parity
        │   ├── import-selection.ts                       ~ + uncheckConversations
        │   └── import-selection.test.ts                  ~ + cases
        ├── components/
        │   ├── secret-warning.tsx                        + SecretWarning (Edit text / Save anyway)
        │   └── item-edit-dialog.tsx                      ~ secretRefused prop; onSave(draft, allowSecrets)
        ├── screens/
        │   ├── project.tsx                               ~ secretRefused state; saveEdit(…, allowSecrets)
        │   ├── import/
        │   │   ├── blocking-chunk-list.tsx               + BlockingChunkList (Uncheck these / Import anyway)
        │   │   ├── import-status.tsx                     ~ renders the block; refused replaces the summary
        │   │   └── import-screen.tsx                     ~ refusedRequest; submitImport; Uncheck / Import anyway
        │   └── __dom-tests__/
        │       ├── project.dom.test.tsx                  ~ + edit warning cases
        │       └── import.dom.test.tsx                   ~ + refusal cases; typed literals + 2 fields (F8)
        └── styles/screens.css                            ~ + .secret-warning, .blocking-chunks
```

**Net:**
- **26 new files:**
  - 12 production code files: 1 value, 7 detection files, 1 importers service, and 3 desktop
    components/state;
  - 12 test files;
  - 1 test-support file;
  - 1 fixture.
- **About 38 changed files**, including 10 doc files.
- **1 new subfolder** (`src/context/domain/services/secret-detection/`, plus its `__fixtures__/`).
- **0** migrations (schema stays v4), new dependencies, new CLI commands, new IPC channels (still
  37), and new MCP tools, arguments or prompts (still five tools and two prompts).
