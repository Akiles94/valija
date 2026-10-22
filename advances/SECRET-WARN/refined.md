# SECRET-WARN — Secret warning on save · Refined Spec

**Status:** Approved at Gate R: Oscar 2026-10-19 (relayed by the orchestrating agent). All 15
decisions in §9 (D-A … D-O) are resolved. Two of them **differ from the original recommendation**:
- **D-E, option 2:** an import is all-or-nothing. It is refused if any chunk is flagged, unless a
  human overrides.
- **D-F, option 3:** detection covers tier 1, plus tier 2 (credential assignments), plus tier 3 (a
  high-entropy heuristic). Tiers 2 and 3 are specified precisely in §8.2–§8.3.

Treat every resolution as settled.

**Directory:** `SECRET-WARN`, a feature advance with no milestone number (same posture as
`CURATION` / `PROJECT-DETECT`).
**Branch:** `feat/secret-warning-SECRET-WARN`. It is stacked on `PROJECT-DETECT`, which is stacked on
`CURATION`. Neither is merged yet, so this advance lands after both, or is rebased onto `main` once
they land.
**Source:** Oscar's raw idea "Aviso de secretos", checked against the tree on 2026-10-19.
**Resolves:** `docs/SPEC.md` §12 open question 2 ("Secret-pattern warning on save: MVP or M2?"). The
answer: it ships now, as its own advance.
**Inherits from:** `docs/SPEC.md` §3, §7, §9, §10, §10a; `advances/CURATION/refined.md` (edit, D-H
imported items, D-C "a model accidentally saved a secret"); `advances/PROJECT-DETECT/refined.md`
(credential stripping on remotes, error messages that leak nothing); `specs/desktop.md` (closed IPC,
errors cross as a code only).
**Touches (expected):** `src/context/**` (domain + application), `src/importers/**` (application),
`src/delivery/**` (CLI, MCP), `desktop/src/**` (IPC schemas and messages, edit dialog, import screen,
both catalogs), and docs. There is **no** migration, **no** new MCP tool or argument, **no** new CLI
command, **no** new IPC channel, and **no** change to pack rendering.

---

## 1. Goal

**When content about to be written into the vault looks like a credential, Valija detects it on
every write path and stops the write before anything is stored. "Looks like a credential" means
any of these:**
- **a private key**
- **a provider API key or token**
- **a JWT**
- **a URL with an embedded password**
- **a `password = …`-style assignment with a real-looking value**
- **a long random-looking string**

**A human (CLI or desktop) can knowingly override the refusal. An AI tool cannot. The warning names
what kind of secret was found and where, but it never repeats the secret.**

Four phrases carry the scope:

- **"Every write path."** Content enters the vault in exactly six ways today (§3, fact 1). All six
  are covered, and the check lives in one place, so a seventh path added later inherits it.
- **"Before anything is stored."** Once a secret is stored, it reaches `get_context` /
  `search_context`, the sync client's history, and backups. A warning that comes after the save
  comes too late (D-A).
- **"A human can override; a model cannot."** False positives happen, more so with tiers 2–3. The
  user must be able to say "yes, save it". A prompt-injected or careless model must not be able to
  say it on the user's behalf (D-B, D-N).
- **"Never repeats the secret."** No warning, error, log, IPC message or MCP response contains the
  matched text or any fragment of it (D-H).

This is a **best-effort safety net**, not a guarantee. Copy and docs must say so (§10.8).

---

## 2. User walkthrough

### 2.1 An AI tool tries to save a key (MCP)

In Claude Code, Oscar pastes a failing deploy log and says "save what we learned". The model
composes a `save_context` whose content accidentally includes `AKIA…` from the log.

```
→ save_context { project: "valija", type: "fact",
                 content: "Deploy fails because… export AWS_ACCESS_KEY_ID=AKIA…" }
← Refused: the content looks like it contains a secret — AWS access key (line 2).
  Nothing was saved. Remove it or replace it with a placeholder such as <AWS_ACCESS_KEY_ID>,
  then call save_context again. If it is not a secret, describe it instead of quoting it.
  [POSSIBLE_SECRET]
→ save_context { …, content: "Deploy fails because… export AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>" }
← Saved fact to project "valija". Item id: 01J….
```

`save_handoff` behaves the same way. The model has **no argument** that overrides the refusal
(D-B, D-N). If `supersedes` was also passed, the superseded item is **not** archived, because
nothing was written.

### 2.2 A human edits an item from the CLI

```
$ valija edit 01J4AA --content-file notes.md
error [POSSIBLE_SECRET]: The content looks like it contains a secret — GitHub token (line 7),
credential assignment (line 9), private key (lines 12–40). Nothing was saved. Remove it, or
re-run with --allow-secrets to save it anyway.

$ valija edit 01J4AA --content-file notes.md --allow-secrets
Updated fact 01J4AA… in project "valija" (content).
```

The same happens when the content comes from stdin (`--content-file -`). There is no interactive
prompt (D-C). A refusal exits with code 1.

### 2.3 A human edits an item in the desktop app

Oscar opens **Edit** on a card, pastes text that contains a Stripe live key, and presses **Save**.
The dialog stays open with his text intact and shows a warning in his UI language:

> **This looks like it contains a secret.** Stripe secret key (line 3). Secrets saved in Valija
> can reach every AI tool you connect. **[Edit text]** **[Save anyway]**

**Save anyway** saves, exactly like `--allow-secrets`. **Edit text** returns focus to the textarea.
The warning never shows the key (D-D, D-H).

### 2.4 Importing chat history (CLI and desktop): all-or-nothing

Chat exports are where pasted keys most often live. An import with **any** flagged chunk is
**refused as a whole**, and nothing is written, unless a human overrides (D-E). The dry-run says
in advance exactly which chunks would block the import, so the user can adjust the selection
first.

```
$ valija import chatgpt.zip -p valija --all --dry-run
Would import 40 item(s) from 12 conversation(s) into "valija" (skipped 0, failed 0).
A real import would be REFUSED: 2 chunk(s) look like they contain secrets.
  #4 "Deploy debugging" part 3 — AWS access key (line 14)
  #9 "CI secrets" part 1 — credential assignment (line 2), high-entropy string (line 5)
Leave those conversations out of the selection (--pick / --query / --since), or add --allow-secrets.
(exit 0: a dry-run is a report)

$ valija import chatgpt.zip -p valija --all
error [POSSIBLE_SECRET]: Import refused: 2 chunk(s) look like they contain secrets. Nothing was imported.
  #4 "Deploy debugging" part 3 — AWS access key (line 14)
  #9 "CI secrets" part 1 — credential assignment (line 2), high-entropy string (line 5)
Leave those conversations out of the selection, or re-run with --allow-secrets.
(exit 1)

$ valija import chatgpt.zip -p valija --pick 1-3,5-8,10-12
Imported 36 item(s) from 10 conversation(s) into "valija" (skipped 0, failed 0).

$ valija import chatgpt.zip -p valija --all --allow-secrets
Imported 40 item(s) from 12 conversation(s) into "valija" (skipped 0, failed 0).
```

`#n` is the conversation's index in the listing, so it can be used directly with `--pick`. Line
numbers are relative to the chunk.

On the desktop **Import** screen:
- **Preview** shows the same "would be refused" block with the same per-chunk lines.
- **Import** on a flagged selection writes nothing. It shows the list and two ways forward:
  uncheck the named conversations in the table, or press **Import anyway**, which re-runs the same
  selection with the override.
- Re-running is safe, because import ids are deterministic and upsert (M2).

### 2.5 Where the result shows up afterwards

| Surface | Without override | With a human override |
|---|---|---|
| `get_context` / `valija export` / desktop pack | the secret never entered the vault, so it is absent | present, like any other content (no scan on read, D-L) |
| `search_context` / `valija search` / desktop search | absent | present. Imported items are searchable over MCP too (SPEC §10a) |
| `valija show` / desktop project screen | absent | present, with no marker (D-K) |
| Any MCP response, CLI output, IPC payload, log | **never contains the matched text** | — |
| Content already in the vault before this advance | **not scanned** (D-J) | — |

Imported chunks never enter packs, but they **are** returned by `search_context`. So an imported
secret does reach AI tools, which is why imports are covered at all.

---

## 3. Context snapshot (verified facts the planner builds on)

1. **The six content write paths** (all verified in the tree):
   | # | Surface | Entry point | Use case |
   |---|---|---|---|
   | 1 | MCP `save_context` | `src/delivery/mcp/server.ts` | `SaveContext` |
   | 2 | MCP `save_handoff` | same file, `type: "handoff"` | `SaveContext` |
   | 3 | CLI `valija edit --content-file` | `src/delivery/cli/curation-commands.ts` | `EditItem` |
   | 4 | Desktop Edit dialog → `content:edit` | `desktop/src/main/ipc/handlers/content-handlers.ts` | `EditItem` |
   | 5 | CLI `valija import` | `src/delivery/cli/import-command.ts` | `ImportConversations` → `ImportItems` |
   | 6 | Desktop Import → `import:preview` / `import:run` | `desktop/src/main/ipc/handlers/import-handlers.ts` | same |
2. **There is no human "create item" path.** No `valija save`/`add` command exists, and there is no
   desktop "new item". `SaveContext` is reached only from MCP (and from tests). This advance does
   not add one (§4 Out).
3. `parseContent` trims the content and caps it at 32 KB. Every use case parses its input **before**
   opening a session. That is where a refusal belongs: it writes nothing and makes no lineage bump.
4. `SaveContext` with `supersedes` archives the old item inside the same `session.write`. A refusal
   before the session leaves the superseded item untouched.
5. **Dry-run never reaches `ImportItems`.** `ImportConversations` builds the chunks and, in dry-run,
   returns counts only. To report what a real run would refuse, the classification must be
   reachable from `importers`. The dependency rule allows this (`importers → context`).
6. `ImportItems` today collects per-chunk failures without aborting the batch, and writes in **one**
   session. The new all-or-nothing rule is a pre-write check over the whole batch, separate from
   that failure collection.
7. **IPC errors carry a code only** (`to-ipc-result.ts`, GUI D-V(d)). A `DomainError` has only `code`
   and `message`. The desktop therefore cannot get the list of blocking chunks from an error. It
   has to come in a successful outcome payload (§6).
8. The renderer already imports pure `src/` domain modules (`ITEM_TYPES` in `item-edit-dialog.tsx`).
   That is the precedent for D-D.
9. `valija edit` reads its content from a file **or stdin** (CURATION D-J). An interactive prompt
   would compete for stdin (D-C).
10. The CLI has **no localization**. The desktop has `en` and `es` catalogs, with a parity test
    (`catalogs.test.ts`).
11. The MCP `save_context` description and the `/save-context` prompt already tell models "Never
    include secrets, API keys, or passwords". Today that is the only control.
12. Tags are `[a-z0-9-]{1,32}` and project names are slugs. Credentials in git remotes are stripped
    before a binding is stored (PROJECT-DETECT).
13. **Developer context is full of high-entropy strings that are not secrets.** Item ids are ULIDs
    and `imp-<32 hex>`. CURATION made `search_context` lines carry ids. Git SHAs, `package-lock.json`
    `integrity` values (`sha512-…`) and paths are everywhere. Tier 3 must be designed around these
    (§8.3).
14. Some existing tests contain strings such as `ghp_SECRETTOKEN` inside **git remote URLs** (binding
    tests). Those are not content writes. The planner must still check that no existing test
    **saves content** that the new rules would refuse. With tier 3, ids and seeds in test content
    are the likeliest collisions.
15. The schema is v4 after PROJECT-DETECT. vault-format §11 makes any migration costly (D-K).

---

## 4. Scope

### In
- A pure **secret detector** in the domain: content in, findings out (kind + line range, with no
  matched text), covering tiers 1–3 (§8).
- Enforcement on all six write paths (§3, fact 1), in the use cases (D-M).
- **Human override:**
  - `--allow-secrets` on `valija edit` and `valija import`
  - **Save anyway** in the desktop Edit dialog
  - **Import anyway** on the desktop Import screen
- **All-or-nothing import:** any flagged chunk refuses the whole import unless the human override
  is given. Dry-run and Preview list the blocking chunks (conversation index and title, part,
  kinds, lines) (D-E).
- **MCP:** refuse with `POSSIBLE_SECRET` and a remedy aimed at the model. No new tool or argument,
  and at most one sentence added to the `save_context` / `save_handoff` descriptions (D-B).
- Desktop copy in **both** `en.ts` and `es.ts`: the error code, every kind label, and the dialog and
  import strings.
- **Docs in the same commit:**
  - SPEC: mark §12 Q2 resolved, and update §7 (refusal), §8 (`--allow-secrets`, refused import) and
    §9 (rules, honest limits)
  - `specs/context.md`, `specs/importers.md`, `specs/delivery.md`, `specs/desktop.md`
  - README (Everyday use / Security)
  - `docs/gui.md`, if it describes Edit or Import
  - CHANGELOG

### Out (deferred or rejected)
- **Scanning existing content** (`valija scan` / a desktop audit view) (D-J). This is the natural
  follow-up, with CLI/desktop parity.
- **Redaction** of any kind (D-A).
- A user-configurable allowlist, pattern file, or threshold setting (D-G).
- Recording the override on the item (D-K).
- Any check on read paths (D-L).
- A human "create item" command or dialog (§3, fact 2).
- Scanning tags, project names, binding targets or paths (D-I).
- Partial imports that hold back flagged chunks automatically. Rejected by D-E: the user narrows
  the selection explicitly instead.
- Any network lookup ("is this key live?"). Rejected outright (SPEC §9).

---

## 5. Behaviour per write path

All checks run **before a session opens**. A refusal writes nothing, bumps no lineage, and creates
no project.

| Path | Findings, no override | Override | With override |
|---|---|---|---|
| MCP `save_context` / `save_handoff` | whole call refused, `POSSIBLE_SECRET`; `supersedes` target untouched; project not auto-created | **none** (D-B, D-N) | — |
| CLI `edit` (content given) | refused, `POSSIBLE_SECRET`, exit 1 | `--allow-secrets` | saved as today |
| CLI `edit` (only `--tags` / `--type`) | not scanned (D-I) | — | — |
| Desktop Edit dialog | warning in the dialog, draft kept, nothing saved | **Save anyway** | saved as today |
| CLI `import --dry-run` | success (exit 0); normal counts **plus** the "would be refused" block listing every blocking chunk | — (the dry-run with the flag simply shows no block) | — |
| CLI `import` (real) | **whole import refused**, nothing written, `POSSIBLE_SECRET`, blocking chunks listed, exit 1 | `--allow-secrets` | every selected chunk imported |
| Desktop Preview / Import | same as CLI dry-run / real; refused Import offers "uncheck these" and **Import anyway** | **Import anyway** | same as CLI |

**Message content** (CLI and MCP, English):
- It names each **kind** with its **line or line range**, de-duplicated, with a cap ("and N more").
- It never includes matched text, a prefix, a suffix, a mask, or a length.
- **The remedy is per surface:**
  - The CLI names `--allow-secrets`. For imports it also names the selection flags.
  - MCP says "remove it or use a placeholder; if it is not a secret, describe it instead of
    quoting it". It **never** mentions an override.
- The planner chooses where the remedy is attached (use-case message vs. delivery suffix).

**Import listing:**
- One line per blocking chunk: the conversation's listing index (`#n`), its title, the chunk part,
  and kinds with lines. There is no count of "withheld" items, because nothing is withheld; the
  import either writes everything selected or nothing.
- The dry-run block is computed by the same function as the real-run refusal, so the two always
  agree (§3, fact 5).
- Parse and validation `failed` entries keep their existing meaning and are reported separately.

**Desktop:** an edit refusal crosses IPC as the code `POSSIBLE_SECRET` only. The dialog's kinds and
lines come from D-D. The import's blocking list arrives inside the import **outcome** (§6), so the
code-only error rule stays intact.

---

## 6. Error codes and outputs

| Code / field | New? | Where |
|---|---|---|
| `POSSIBLE_SECRET` | new, in `ContextErrorCode` | `SaveContext` and `EditItem` refusals; the CLI exit line for a refused import; MCP and IPC errors |
| Import blocking findings: a list of `{ conversation index, title, part, kinds[], line ranges }` plus a `refused` flag | new output fields | `ImportConversations` output in both dry-run and real mode; CLI rendering; `ImportOutcomeResponse` (IPC) |
| `allowSecrets?: boolean` | new input flag | `EditItem`, the import path (`ImportConversations` → `ImportItems`), and the IPC `content:edit` and `import:run` schemas (strict optional boolean) |

`SaveContext` gains **no** override input (D-N). `ImportItems` also refuses the whole batch on its
own if it is handed flagged content without the override. That is defense in depth, mirroring how
it already re-validates content.

---

## 7. Schema / migration impact

**None.** Detection is a pure in-memory function. Nothing new is persisted, and the schema stays
v4. vault-format docs and the golden fixture are unchanged. Rules and thresholds are code
constants. Changing them is a code change documented in `specs/context.md`, not a format change.

---

## 8. Detection rules (requirements, not regexes)

**Common to all tiers:**
- **Kinds form a closed enum.** Each kind has a stable id and an English label (CLI/MCP), plus
  `en`/`es` desktop labels (D-O).
- **Findings carry kind + line range only.** The type has no field that could hold matched text.
- **One finding per span, by precedence.** When tiers overlap on the same span, tier 1 wins over
  tier 2, which wins over tier 3. A JWT is reported as `jwt`, not also as `high-entropy-string`.
- **Linear-time matching.** Content is capped at 32 KB, and an adversarial-input test with a time
  bound is required.
- **The placeholder exclusions apply to every tier:**
  - `<…>`, `${…}`, `$VAR`, `%VAR%`, `{{…}}`
  - runs of a single character (`xxxxxxxx`, `********`, `........`)
  - values containing `example`, `placeholder`, `redacted`, `changeme`, `dummy`, `sample` or `your_` /
    `your-` (case-insensitive)
  - AWS's documented `…EXAMPLE…` keys

### 8.1 Tier 1: known formats

| Kind id | Label (en) | Recognized by |
|---|---|---|
| `private-key` | Private key | PEM / OpenSSH / PGP **private** key block headers (public keys and certificates are not flagged) |
| `aws-access-key` | AWS access key | `AKIA` / `ASIA` access-key-id shape |
| `github-token` | GitHub token | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` shapes |
| `anthropic-api-key` | Anthropic API key | `sk-ant-…`, with a realistic minimum length (checked before `openai-api-key`) |
| `openai-api-key` | OpenAI API key | `sk-…` / `sk-proj-…`, with a realistic minimum length |
| `slack-token` | Slack token | `xox[abprs]-…` |
| `stripe-secret-key` | Stripe secret key | `sk_live_…`, `rk_live_…`, `sk_test_…` |
| `google-api-key` | Google API key | `AIza…` shape |
| `jwt` | JSON Web Token | three base64url segments with a JSON header (`eyJ…`) |
| `url-credentials` | Credentials in a URL | `scheme://user:password@host`, where the password is not a placeholder (`password`, `pass`, `secret`, `changeme`, the common exclusions) |

Each rule needs a minimum length or structure, so prose that *mentions* a format ("OpenAI keys
start with `sk-`") does not fire.

### 8.2 Tier 2: `credential-assignment` (label: "Credential assignment")

It fires on a **key, an operator, and a value**, all on one line, when all of the following hold:

1. **Key.** An identifier (`[A-Za-z0-9_.-]+`, optionally quoted, optionally after `export `) whose
   normalized form (lowercased, with `_`, `-` and `.` removed) **ends with** one of these:
   `password`, `passwd`, `secret`, `clientsecret`, `secretkey`, `apikey`, `accesskey`,
   `accesstoken`, `authtoken`, `refreshtoken`, `token`, `privatekey`.
   - *Ends with* is deliberate. `DB_PASSWORD` and `stripeSecretKey` match. `password_policy`,
     `tokenizer`, `max_tokens` and `secretary` do not.
   - `pwd` and `pass` are **not** keys: `PWD` is a shell variable and `pass` is ordinary prose.
2. **Operator.** One of `=`, `:`, `:=` or `=>`, with optional whitespace around it. This covers
   `.env`, shell, YAML, JSON, TOML and code.
3. **Value.** Either a quoted string (`"…"`, `'…'`, `` `…` ``) containing **no whitespace**, or an
   unquoted single token that runs to the end of the line, or to a `,` `;` `}` `#`.
   - A value followed by more words does not fire. This is what keeps
     `password = stored in the keychain` silent.
4. **The value looks like a credential, not code or prose:**
   - It is at least **8** characters long.
   - It contains at least **2** of {lowercase, uppercase, digit, symbol}, or is at least
     **16** characters long. This keeps `required`, `optional` and `keychain` silent.
   - It is not a placeholder (common exclusions), and not one of `null`, `none`, `nil`,
     `undefined`, `true`, `false`, `string`, `number`.
   - It is not an expression or reference. Excluded are values that:
     - contain `(` or `)`
     - are a dotted path (`config.secret`, `process.env.X`, `os.environ…`)
     - start with `$`, `env(` or `secrets.`
     - are an unquoted identifier made only of letters and `_`, with **no digit**
       (`refreshedAccessToken`). Code references look like that; real passwords rarely do.
   - It does not start with `/`, `./` or `~/` (a path).
5. **The reported line** is the assignment's line.

### 8.3 Tier 3: `high-entropy-string` (label: "High-entropy string")

It fires on a **candidate token** when all of the following hold. The numbers are the initial
values, see the tuning rule below.

1. **Candidate.** A maximal run of `[A-Za-z0-9+/=_-]`, at least **32** and at most **200**
   characters long. Longer runs are treated as encoded data payloads, not credentials.
2. **Character mix.** At least **2** uppercase letters, **2** lowercase letters and **2** digits.
3. **Entropy.** The Shannon entropy over the token's own character frequencies is at least
   **4.3 bits per character**. Random base62/base64 at 32 or more characters lands around
   4.6–5.0; identifiers and words land below.
4. **Exclusions.** The token never fires when any of these is true:
   - **It is pure hex, of any length or case.** This covers git SHAs (short, 40 and 64), sha256 and
     md5 values, `imp-<32 hex>` ids, and hex dumps. Hex secrets are left to tiers 1–2.
   - It is a **UUID** (8-4-4-4-12) or a **ULID** (26 chars, Crockford base32), alone or embedded.
   - It is an **SRI / integrity hash**: `sha256-`, `sha384-` or `sha512-` followed by base64.
   - It sits inside a **data URI** (`data:<mime>;base64,…`).
   - It is a **hash in an obvious context**: the same line, before the token, contains `sha`,
     `sha1`, `sha256`, `sha512`, `md5`, `hash`, `digest`, `checksum`, `integrity`, `etag`,
     `commit` or `fingerprint`.
   - It sits inside a **URL or path**: after `scheme://` up to the next whitespace, or the token
     starts with `/`, `./`, `../` or `~/`.
   - It is a **slash-separated path of word-like segments**: two or more `/`, and no segment
     satisfies rule 2 on its own.
   - It matches a **placeholder** (common exclusions).
   - It is **already covered by a tier 1 or tier 2 finding** (precedence).
5. **Tuning rule.** The planner may adjust the thresholds in rules 1–3 only if both corpora below
   stay green. The final values are documented in `specs/context.md`.

### 8.4 Required corpora (fixtures in the detector's tests)

Every example below is a **made-up test value**, never a real credential. Tier 1 needs a positive
and a negative case per kind. Tiers 2 and 3 need at least the following.

**Tier 2: must fire** (`credential-assignment`)
- `DB_PASSWORD=S3cr3t!Passw0rd`
- `export API_KEY="9fK2mQ7xLp4Rt8Vw"`
- `"client_secret": "Zx81-QpLm-77Hb-ee3R"`
- `password: Hunter2Hunter2` (YAML)
- `stripeSecretKey = 'a8F3kQ9zLm2X'`
- `token := "q9WvT3kZ8LmN"`

**Tier 2: must not fire**
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

**Tier 3: must fire** (`high-entropy-string`)
- a bare 40-character mixed base64 token in prose, e.g. `Q7mZ2vK9pL4xR8tW1nB6cY3hJ5gF0dS2aE7uI9oP`
- `Authorization: Bearer 8fJ2kL9mQ4rT7vX1zB5nC3pD6sG0hW2y`
- a 48-character base64url token with `-` and `_` on a line of its own

**Tier 3: must not fire**
- a 7-, 40- and 64-character git SHA / sha256 (lowercase hex), including `commit 3f2a…`
- `550e8400-e29b-41d4-a716-446655440000` (UUID)
- `01J3Q8Z6M4X5Y7T9B2C1D0E8F6` (ULID), and `imp-` followed by 32 hex characters
- a `package-lock.json`-style `"integrity": "sha512-…=="` value
- `data:image/png;base64,iVBORw0KGgo…` (longer than 200 characters)
- `src/context/domain/services/item-curation.ts` and `/Users/Oscar/Projects/App2024/src/Main.ts`
- `https://github.com/oscar/valija/blob/<40-hex>/docs/SPEC.md`
- `createImportedContextItemFromDraft` (an identifier)
- `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` (low entropy)
- a `search_context`-style result line with an id: `- [valija] (decision, 2026-07-20, id 01J3Q8Z6M4X5Y7T9B2C1D0E8F6) …`

**Whole-document negatives** must also produce **zero findings**:
- this repo's `docs/SPEC.md`
- the golden-fixture `expected-pack.md`
- a representative `package-lock.json` excerpt

---

## 9. Decisions (resolved at Gate R, 2026-10-19)

### D-A. Policy: warn, block, or redact? **Resolved: block with a human override.**
The options were: warn only (save, then print a warning); **block until a human explicitly
confirms**; or redact automatically. *Why:* a warn-only save has already put the secret in the
vault, the sync history and `search_context`. Redaction silently changes user data, and a false
positive destroys the content it hits.

### D-B. MCP behaviour. **Resolved: reject with `POSSIBLE_SECRET` (default).**
The model gets a model-directed remedy. At most one sentence is added to the `save_context` /
`save_handoff` descriptions. Quarantine (save as archived) and save-and-warn were rejected: both
store or expose a secret the user never chose to keep.

### D-C. CLI confirmation style. **Resolved: the `--allow-secrets` flag only (default).**
It is deterministic, scriptable, and does not compete with `--content-file -` for stdin. There is
no TTY prompt.

### D-D. How the desktop learns kinds and lines. **Resolved: the shared pure detector (default).**
- **Edit dialog:** the renderer runs the same domain detector on the draft when Save is pressed.
  Main enforces on its own and returns `POSSIBLE_SECRET` when the override flag is absent.
  Constraint: the detector has no Node APIs, so the renderer can bundle it.
- **Import:** findings are produced in main (chunking happens there) and arrive in the outcome
  payload (§6).

### D-E. Imports in bulk. **Resolved: option 2, refuse the whole import if any chunk is flagged, unless the human override is given.** *(Not the original default.)*
- **The import is all-or-nothing.** There is no partial import and no `withheld` count.
- **Dry-run / Preview list every blocking chunk:** listing index `#n`, title, part, kinds and
  lines. The user can then narrow the selection (`--pick` / `--query` / `--since`, or uncheck rows
  on the desktop) or knowingly override.
- **Trade-offs accepted:**
  - One flagged chunk blocks a large import until the user acts. This friction is intentional: it
    forces a conscious decision per import.
  - Tiers 2–3 make this more frequent, which is why the dry-run list must be exact and actionable.
  - The override is all-or-nothing too. There is no per-chunk override (deferred).

### D-F. Pattern set. **Resolved: option 3, tiers 1 + 2 + 3.** *(Not the original default.)*
- The tiers are specified in §8.1–§8.3, and the must-fire / must-not-fire corpora in §8.4 are
  acceptance criteria.
- **Trade-off accepted:** higher recall at the cost of more false positives. That cost is
  sharpest on MCP, where there is no override (§14), and on all-or-nothing imports (D-E). The
  §8.3 exclusions exist to keep developer-context noise (SHAs, ids, hashes, paths, data URIs)
  silent.

### D-G. False-positive handling. **Resolved: built-in placeholder exclusions only (default).**
They are listed in §8 and apply to every tier. There is no user allowlist, which would be new
state and new UI. There is no plaintext config file, which would break SPEC §9.

### D-H. What a warning reveals. **Resolved: kind + line or line range (default).**
Findings are de-duplicated and capped. Masked fragments are rejected, because they leak key
material into terminals, transcripts and model context.

### D-I. What gets scanned. **Resolved: item content only, when new content is written (default).**
- Edits that change only tags or type are not scanned.
- Re-submitting unchanged content that already contains a secret is still checked, because the
  check runs during parsing, before the session opens.

### D-J. Existing content. **Resolved: defer the audit (default).**
Only new writes are checked. A `valija scan` / desktop audit view is the expected follow-up, with
parity. Until then, the remedy for a secret already in the vault is `archive` / `edit`.

### D-K. Recording an override. **Resolved: no record (default).**
There is no auto-tag, which would advertise secret locations to AI tools. There is no migration.

### D-L. Read paths. **Resolved: no checks on read (default).**

### D-M. Where the rule lives. **Resolved: a pure domain service or policy in `context/domain` (default).**
- The kind and the finding are domain values. The detector sits in a kind-named subfolder.
- `SaveContext`, `EditItem` and `ImportItems` enforce it during input parsing.
- `ImportConversations` reuses the same function to classify chunks for the dry-run. It reuses
  the function and never copies it.
- A new `secrets/` module and adapter-level checks were rejected.

### D-N. Who may override. **Resolved: `allowSecrets` only on `EditItem` and the import path (default).**
`SaveContext` has no override at all, so a model's inability to override is structural rather than
a convention.

### D-O. Localized kind labels. **Resolved: localized desktop labels from the closed kind enum (default).**
The desktop shows `en` and `es` labels. CLI and MCP use English. Product names (GitHub, Stripe, AWS,
OpenAI, Anthropic, Slack, Google) stay untranslated. Suggested neutral-Spanish labels for the new
kinds: "asignación de credencial", "cadena de alta entropía".

---

## 10. Security surfaces (must not be weakened)

1. **No new channel for secret material.** Findings hold no matched text, by type. No error,
   message, log, IPC payload (including the import outcome), MCP response or CLI import listing
   contains it. Each surface has a test asserting that its serialized output does not contain a
   planted secret, for one kind from each tier.
2. **No logging** of content or findings on the new paths.
3. **MCP cannot override.** No argument, description text or remedy suggests an override. The tool
   count stays 5 and the prompt count stays 2. No tool schema gains a field.
4. **Refusal before session.** A refused write opens no session, creates no project, archives no
   `supersedes` target and bumps no lineage. A refused import writes **zero** chunks. A locked vault
   still answers `VAULT_LOCKED`. The planner decides the order of the two checks, but neither may
   leak content.
5. **IPC stays closed.** `allowSecrets` is a strict optional boolean on existing schemas
   (`content:edit`, `import:run`). No new channel. Errors still cross as a code only. The blocking
   list crosses inside the outcome, and contains titles, parts, kinds and lines only. Titles
   already cross in the listing.
6. **No plaintext outside the vault.** Nothing goes to the preferences file. No temp files, no
   allowlist file.
7. **No network, no telemetry, no new dependency.** Detection is in-process. The entropy computation
   is plain arithmetic.
8. **Honest copy.** Docs and UI say "best effort: known formats, credential assignments and
   random-looking strings". They never promise a secret-free vault, and they keep "do not paste
   secrets into AI tools".
9. **ReDoS-safe** rules and a linear entropy pass, with a time-bounded test on adversarial input.

---

## 11. Architecture notes

- **Domain** (`context/domain`):
  - a closed secret-kind enum
  - a finding value (kind + line range)
  - a pure detector, Node-free so the renderer can import it, in a kind-named subfolder
    (`services/` or `policies/`; the planner picks per the CLAUDE.md layout rule)
  - tier rules kept as small separate units, so each tier is testable alone
  - `POSSIBLE_SECRET` in `errors.ts`
- **Application:**
  - `EditItem` accepts `allowSecrets?`.
  - `SaveContext` refuses unconditionally.
  - `ImportItems` accepts `allowSecrets?` and refuses a flagged batch as a whole before its session.
  - `ImportConversations` classifies the selected chunks in both dry-run and real mode, returns the
    blocking list and the `refused` flag, and threads the override through.
  - No use case calls another.
- **Delivery / CLI:**
  - `--allow-secrets` on `edit` and `import`.
  - An edit refusal goes through `fail()`.
  - A refused import prints its blocking list and exits 1 with `POSSIBLE_SECRET`.
  - The dry-run prints the "would be refused" block and exits 0.
- **Delivery / MCP:** no schema change, at most one description sentence, and a refusal message with
  a model-directed remedy.
- **Desktop:**
  - schema flags on `content:edit` / `import:run`
  - the blocking list and `refused` in `ImportOutcomeResponse`
  - an Edit-dialog warning with **Save anyway**
  - on the Import status: the blocking list plus **Import anyway**, with Preview showing the same
    block
  - catalog entries in `en` and `es`
  - pure view formatting (findings → localized line) in `renderer/state/`
- **Tests per layer:**
  - detector: every §8.4 corpus item, plus tier precedence, line ranges, the ReDoS/time bound, and
    no matched text in any finding
  - use cases: a refusal writes nothing and bumps nothing; `supersedes` stays untouched; the
    override saves; a refused import writes zero chunks; the dry-run list equals the real-run list
  - CLI and MCP (refusal on both save tools; the text names no override and contains no secret)
  - desktop schemas and handlers
  - one DOM test each for the Edit warning and the Import refusal

---

## 12. Acceptance criteria

**Detection (§8)**
- [ ] Every tier-1 kind fires on its positive case and stays silent on its negative case
      (including prose mentions, placeholders, example keys, public keys and certificates).
- [ ] Every **tier 2 must-fire** item in §8.4 yields `credential-assignment`. Every **tier 2
      must-not-fire** item yields nothing.
- [ ] Every **tier 3 must-fire** item in §8.4 yields `high-entropy-string`. Every **tier 3
      must-not-fire** item yields nothing.
- [ ] `docs/SPEC.md`, `expected-pack.md` and the `package-lock.json` excerpt each yield zero findings.
- [ ] A span matched by several tiers is reported once, under the highest-precedence kind.
- [ ] Findings expose kind and line range only. A planted secret of one kind from each tier never
      appears in any serialized finding, error, outcome or output.
- [ ] An adversarial 32 KB input completes within a fixed time bound.
- [ ] The final thresholds are documented in `specs/context.md`.

**Write paths (§3 fact 1, §5)**
- [ ] MCP `save_context` and `save_handoff` with a secret → `POSSIBLE_SECRET`. Nothing is saved, no
      project is created, the `supersedes` target stays live, and there is no lineage bump.
- [ ] The MCP refusal names kinds and lines, suggests a placeholder, and mentions no override. The
      tool count is 5, the prompt count is 2, and no tool input schema changed.
- [ ] `valija edit --content-file f|-` with a secret → exit 1, `POSSIBLE_SECRET`, item unchanged.
      With `--allow-secrets` the content is saved. A tags-only or type-only edit is never refused.
- [ ] Desktop Edit with a secret → a localized warning with kinds and lines, the draft kept,
      nothing saved. **Save anyway** saves. Main refuses without the override flag, regardless of
      the renderer.
- [ ] `valija import --dry-run` with flagged chunks exits 0 and lists every blocking chunk
      (`#n`, title, part, kinds, lines).
- [ ] `valija import` (real) with flagged chunks writes **zero** items, exits 1 with
      `POSSIBLE_SECRET`, and prints the same list. With `--allow-secrets` it imports every selected
      chunk. Narrowing the selection to unflagged conversations imports normally.
- [ ] The dry-run list equals the real-run refusal list for the same input and selection.
- [ ] Desktop Preview shows the same list. Import on a flagged selection writes nothing and shows
      the list. **Import anyway** imports everything selected.

**Parity and copy**
- [ ] Every human capability (refuse, override, import refusal and listing) exists on both the CLI
      and the desktop.
- [ ] `POSSIBLE_SECRET`, all twelve kind labels and every new string exist in both `en.ts` and
      `es.ts`, and `catalogs.test.ts` passes.

**Contracts and docs**
- [ ] No migration. The schema stays v4. The golden fixture and conformance tests are unchanged.
- [ ] No new dependency, network call, IPC channel, or MCP tool or argument.
- [ ] SPEC §12 Q2 is marked resolved and points here, and §7, §8 and §9 are updated.
      `specs/context.md`, `specs/importers.md`, `specs/delivery.md`, `specs/desktop.md`, README and
      CHANGELOG are updated in the same commit. All copy says "best effort".
- [ ] No existing test that saves content is silently weakened to dodge the detector. Collisions
      are fixed by changing the test content to non-secret-looking values, with a note.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at root and in `desktop/`.

---

## 13. Deliverables summary (not a plan)

| Deliverable | Nature |
|---|---|
| Secret-kind enum (12 kinds), finding value, pure tiered detector, `POSSIBLE_SECRET`, §8.4 corpora | domain (context) |
| Refusal in `SaveContext`; `allowSecrets` on `EditItem` / `ImportItems`; whole-batch refusal; blocking list in dry-run and real mode via `ImportConversations` | application |
| `--allow-secrets` on `edit` / `import`; refused-import and dry-run listing | delivery/cli |
| Refusal text; at most one description sentence | delivery/mcp |
| Schema flags, blocking list in the import outcome, Edit warning + Save anyway, Import refusal + Import anyway, en/es copy | desktop |
| SPEC, specs, README, CHANGELOG | docs, same commit |

---

## 14. Biggest risk

**False positives become dead ends, now at a larger scale.** Tiers 2 and 3 widen what fires, and
two paths have no easy way out:
- **On MCP, by design, the model cannot override, and no human create path exists.** A legitimate
  note that quotes a long random-looking value (a config blob, an id format the exclusions miss, a
  base64 sample) can only be saved if the model rewrites it.
- **On import, one false positive blocks the whole run** until the user narrows the selection or
  overrides (D-E).

If tier 3 is noisy in practice, users learn to reach for `--allow-secrets` reflexively, and models
learn to paraphrase useful details away. The control would then cost more than it protects.

**Mitigations (mandatory):**
- The §8.3 exclusions (hex, UUID/ULID, SRI, data URIs, hash context, paths/URLs) and the §8.2
  value rules.
- The must-not-fire corpora as acceptance tests, including whole-document negatives (SPEC,
  golden pack, a lockfile excerpt).
- Thresholds that can be tuned only against both corpora.
- An exact, actionable listing (line numbers, `#n` for `--pick`).
- An MCP remedy that tells the model which line to fix and to describe rather than quote.

**Runner-up: false confidence.** Even with three tiers, this is a heuristic. Hex secrets outside an
assignment, short passwords in prose, and everything saved before this advance (D-J, including
imported chunks that `search_context` already returns) pass silently. Honest "best effort" copy
everywhere, and scheduling the D-J audit as the follow-up, are the mitigations.
