# CARDS — Project item cards with light Markdown rendering · Review

Verdict: PASS

**Reviewed:** `git diff fcd3060...HEAD` on `feat/desktop-GUI`, excluding `advances/CARDS/plan.md`.
**Commits:** `d7e23ed` (Slice 1), `43d1ab0` (Slice 2), `29779ab` (Slice 3). Gate P closed in
`16e7bd5`, which is an ancestor of all three — the approval preceded the implementation.
**Reviewer posture:** every command below was executed by the reviewer; nothing is taken from a
commit message.

---

## 1. Line count

| Bucket | Lines |
|---|---|
| Whole diff excluding `plan.md` | **+1054 / −10**, 12 files |
| Production — `light-markdown.ts` | 205 (plan: ~170) |
| Production — `long-content.ts` | 19 (plan: ~20) |
| Production — `markdown-content.tsx` | 81 (plan: ~62) |
| Production — `item-card.tsx` | 93 (plan: ~92) |
| Production — `screens.css` new section | 137 (plan: ~135) |
| Production — `project.tsx` | +10 / −10 (plan: ~14 changed) |
| Production — `en.ts` + `es.ts` | +4 (plan: 4) |
| Tests — `light-markdown.test.ts` / `long-content.test.ts` / `project.dom.test.tsx` | 203 / 36 / 258 = 497 (plan: ~440) |
| Docs — `docs/gui.md` | +8 (plan: ~8) |

Production lands at ~549 against a ~497 estimate; test lines at 497 against ~440. Both overruns are
in the right direction and neither file is oversized.

## 2. Verification actually run

| Command | Result |
|---|---|
| `cd desktop && npm run typecheck` | pass (both `tsconfig.json` and `tsconfig.web.json`) |
| `cd desktop && npm run lint` | pass — 134 files, no diagnostics |
| `cd desktop && npm run test` | **49 files / 713 tests pass** |
| `cd desktop && npx vitest run src/main/infra/no-network-surface.test.ts` | **82 files scanned, 82 pass** — the new `.tsx`/`.css` files are in the scan (`.test.tsx` is not skipped) |
| root `npm run typecheck` | pass |
| root `npm run lint` | exit 0 (one pre-existing `biome migrate` *info*, unrelated) |
| root `npm run test` | 57 files / 301 tests pass |
| `git diff --stat fcd3060...HEAD -- src/ desktop/src/main desktop/src/preload package.json desktop/package.json` | **empty** |
| `git diff --stat fcd3060...HEAD -- search.tsx pack-preview.tsx dashboard.tsx tokens.css base.css main-window.ts` | **empty** |
| `git grep -E "dangerouslySetInnerHTML\|innerHTML\|outerHTML\|insertAdjacentHTML\|document\.write\|new Function\|DOMParser\|eval\(" -- desktop/src/renderer/` | no hits |
| `git grep -E "<a \|<img\|<iframe\|style=\|href=\|src=\|localStorage\|console\.\|preferences\.write\|setTimeout\|setInterval"` over the new files | only the XSS *fixture string* and a doc comment; no code hit |

I additionally ran the parser out-of-band (`node --experimental-strip-types`, 18 hand-built inputs
plus nine 30–32 KB adversarial strings). Every input round-tripped losslessly; the slowest of the
adversarial cases was **3.6 ms** (30 KB of `***``` alternation), the 32,894-char spec fixture 2.5 ms.
No hang, no throw, no dropped character.

---

## 3. Acceptance criteria (`refined.md` §9)

### Rendering — cards

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | One bordered card per item, 10px vertical stack, no bullets, no default `<ul>` padding | **Met** | `screens.css:258-274` (`.item-list` `list-style:none; padding:0; gap:10px`, `.item-row` flex column); `project.dom.test.tsx:86-93` |
| 2 | Border/radius/padding per §5, existing tokens only, `tokens.css` unchanged | **Met** | `screens.css:265-272` (`1px solid var(--color-border)`, `6px`, `14px 16px`); `tokens.css` absent from the diff |
| 3 | Header: type left, `formatDate` date right, one line, visibly separated | **Met** | `item-card.tsx:41-53`; `screens.css:279-284` (`space-between`, `gap:12px`) |
| 4 | Type label is the raw domain value, untranslated, both languages | **Met** | `item-card.tsx:50`; `project.dom.test.tsx:115-121` and `:255` (es render still reads `decision`) |
| 5 | Date absolute, no relative-time copy | **Met** | `item-card.tsx:52` reuses `formatDate` unchanged; no new date code in the diff |
| 6 | Pinned: accent border, `aria-hidden` star, translated word, muted `·`, accent type label | **Met** | `item-card.tsx:40,43-50,84-93`; `screens.css:275-277, 293-296, 297-299` (`.item-sep` stays `--color-text-muted`, per §5, which governs over §2.1's shorthand); `project.dom.test.tsx:95-113` |
| 7 | Unpinned: no star, no pinned word, default border | **Met** | `project.dom.test.tsx:108-112` |
| 8 | One pill per tag; 5 tags → 5 elements; 0 tags → no row | **Met** | `item-card.tsx:71-79`; `project.dom.test.tsx:123-137` (also asserts the old `"mcp, claude-code"` join is gone) |

### Rendering — Markdown

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 9 | Plain content stays a plain paragraph, no structure invented | **Met** | `light-markdown.test.ts:165-172`; reviewer probe on 18 further inputs |
| 10 | `## …` → bold lead-in, `##` absent, no `h1/h2/h3` | **Met** | `markdown-content.tsx:36-37` emits `<p className="md-heading">`; `light-markdown.test.ts:19-31`; `project.dom.test.tsx:149-158` asserts zero `h1,h2,h3` |
| 11 | `**Síntoma:**` → `<strong>`, no literal asterisks | **Met** | `light-markdown.test.ts:35-46`; `project.dom.test.tsx:151,161` |
| 12 | `1. `/`2. ` → one `<ol>` with one `<li>` each; non-1 start preserved | **Met** | `light-markdown.ts:83-102`; `markdown-content.tsx:38-46`; `light-markdown.test.ts:66-80`; `project.dom.test.tsx:153-154` |
| 13 | `- `/`* ` → `<ul>`; `` `x` `` → `<code>`; fence → `<pre><code>` unparsed | **Met** (with a coverage gap — Warning W1) | parser: `light-markdown.test.ts:88-150`; adapter: `markdown-content.tsx:47-61`; `<code>` asserted at `project.dom.test.tsx:152`. `<ul>`/`<pre>` emission is verified by inspection only |
| 14 | Unsupported syntax verbatim; no `<a>`/`<em>`; nothing dropped | **Met** | `light-markdown.test.ts:152-163` (`_snake_case_`, `[text](example)`, `> quote`, `\| a \| b \|`, `#### …`); `em`/`a` are not in the `Inline`/`Block` unions at all; `project.dom.test.tsx:170` |
| 15 | Round-trip: visible text reproduces the source minus consumed markers | **Met** | `flatten` helper + `light-markdown.test.ts:165-178`; independently reproduced by the reviewer probe, including `a\nb\nc`, `1. one/continued/2. two`, indented text and trailing spaces |
| 16 | `<img src=x onerror=alert(1)>` → visible text, **zero** `img` elements | **Met** | `project.dom.test.tsx:164-174` (also asserts zero `a`); fixture contains no URL, so `no-network-surface` stays green |
| 17 | Long unbroken token does not widen the card / no horizontal scroll | **Met (CSS as specified; not machine-checkable)** | `screens.css:311, 348` — `overflow-wrap: anywhere` on `.item-content` and on `.md-pre`, exactly §5's declaration. jsdom has no layout (§4.2 said so honestly); the visual confirmation is Oscar's |

### Truncation

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 18 | Long item collapsed at max-height + gradient fade + toggle with `aria-expanded` and translated label | **Met** | `item-card.tsx:55-69`; `screens.css:317-320` (`max-height:176px`), `:321-329` (`linear-gradient`, no `url()`); `project.dom.test.tsx:176-184` |
| 19 | Toggle expands in place, label switches, collapses again | **Met** | `project.dom.test.tsx:186-198` |
| 20 | **Invariant:** never clipped without a toggle | **Met — structurally, as required** | `item-card.tsx:36-37`: `const collapsible = isLongContent(content); const collapsed = collapsible && !expanded;` — line 55's clamp class and line 60's toggle are both derived from the *same* `collapsible`, so they cannot drift. `project.dom.test.tsx:223-230` proves the short case renders neither |
| 21 | Card isolation; reload resets; nothing persisted | **Met** | `useState` only (`item-card.tsx:34`); `project.dom.test.tsx:201-221` (isolation) and `:232-244` (`fireEvent.focus(window)` → back to "Show more"); grep finds no `preferences.write`, no IPC, no `localStorage` in the new files |

### i18n

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 22 | Both catalogs gain the keys; `catalogs.test.ts` + `Catalog` typecheck pass | **Met** | `en.ts:108-109`, `es.ts:109-110`; both suites and both typechecks run green above |
| 23 | Language switch changes only the toggle label and the pinned word | **Met** | `project.dom.test.tsx:246-257` — `Ver más` / `Fijado`, `.item-type` still `decision`, `.item-content` textContent byte-identical to the 500-char source |

### Scope and non-regression

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 24 | No `src/`, no main, no preload, no dependency change | **Met** | the scoped `git diff --stat` is empty (§2 above) |
| 25 | `search.tsx`, `pack-preview.tsx`, `dashboard.tsx` untouched | **Met** | empty diff; and no `.item-*`/`.md-*` class is referenced anywhere outside `item-card.tsx`/`markdown-content.tsx`/`project.tsx`, so the new global rules cannot leak into the deferred search screen |
| 26 | Pack preview verbatim; export byte-identical | **Met** | no file on either path is opened by the diff |
| 27 | New CSS in a single commented `/* project.tsx */` section | **Met** | `screens.css:255` opens the section; everything new is appended below it; no existing rule reordered or edited |
| 28 | `docs/gui.md` paragraph in the same commit, states pack/export unaffected | **Met** | `29779ab`; `docs/gui.md:144-150` — "This is display only: the context pack, **Copy**, **Export…**, and what an AI tool receives through `get_context`/`search_context` are all unaffected and still show your content verbatim" |

### Security (`refined.md` §7)

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 29 | No `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `new Function` / `DOMParser` | **Met** | grep over `desktop/src/renderer/` returns nothing; Biome's `noDangerouslySetInnerHtml` is live and lint is green |
| 30 | No `<a>`/`<img>`/`<iframe>`/`style` from user content; `<ol start>` is the only user-derived attribute, from a parsed integer | **Met** | `markdown-content.tsx:32-81` is two closed `switch`es emitting exactly `p / p.md-heading / ol / ul / li / pre > code / strong / code / raw string`. `start` comes from `light-markdown.ts:93` `Number.parseInt(match[1] ?? "1", 10)` where `match[1]` is bounded by `\d{1,9}` (`light-markdown.ts:30`) — provably an integer ≤ 999,999,999, never `NaN`. `strict: true` makes both switches exhaustive by compilation (a sixth arm fails "lacks ending return statement") |
| 31 | `no-network-surface.test.ts` passes; fade is a gradient | **Met** | ran it: 82/82. `screens.css:326` `linear-gradient(to bottom, transparent, var(--color-bg))`, no `url(`. No `http://`/`https://`/`fetch(`/`setInterval` in any new file, including the scanned `project.dom.test.tsx` |
| 32 | `main-window.ts` CSP and navigation handlers unchanged | **Met** | absent from the diff |
| 33 | 32 KiB pathological string parses well under a frame, covered by a test | **Met** (fixture is weaker than its name — Warning W2) | `light-markdown.test.ts:191-202`, 32,894 chars, asserts `< 250 ms`; measured 2.5 ms here. Reviewer's own nine adversarial 30–32 KB inputs all ≤ 3.6 ms |
| 34 | `typecheck && lint && test` green at repo root and in `desktop/` | **Met** | §2 |

**34 / 34 met.** No criterion is unclear.

---

## 4. Hard gates

| Gate | Result |
|---|---|
| Security surface weakened (secrets/keys logged, plaintext to disk, KDF/keychain altered, SQLCipher unkeyed, MCP surface widened) | **No breach.** Zero files under `src/`, `desktop/src/main/**` or `desktop/src/preload/**`. No crypto, no keychain, no DB, no IPC channel, no new preload method. No `console.*` in the new files, so no path can log `content`. Expansion state is `useState` and never reaches the plaintext preferences file (§7.7) |
| XSS / HTML-string path | **No breach.** No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` or `DOMParser` anywhere in the renderer. Every user string reaches the DOM as a React text node. The emitted element set is closed and enforced by an exhaustive `switch` under `strict: true` |
| Parser totality / availability | **No breach.** Every dispatch branch advances the scan index (blank `+1`; `readFence` ≥ `start+2`; `readHeading` `start+1`; the three run-readers are only entered when the first line matches, so each consumes ≥ 1). The inline scanner advances by exactly one character on every failed marker, so no character can be dropped. Both `indexOf` latches are *sound*: `codePossible=false` only when no backtick exists at or after `i+1`, and `boldPossible=false` only when no `**` exists at or after `i+2` — in both cases no valid later span can be suppressed (I checked the `"***"` boundary case explicitly). Confirmed empirically on 27 inputs |
| Tests missing for new behavior / suite not passing | **No breach.** Parser grammar, degrade-to-literal, round-trip, totality, CRLF and 32 KiB availability are unit-tested; the toggle, the pinned markup, the pill count, the type label, per-card isolation, reset-on-reload, bilingual labels and the XSS property are DOM-tested. All suites in both workspaces pass. Two coverage gaps are recorded as Warnings, not breaches |
| Advance ritual (`CLAUDE.md`) | **Satisfied.** `refined.md` carries the Gate R approval line; `plan.md:3` carries `Approved: Oscar 2026-08-29`, committed in `16e7bd5`, which is an ancestor of all three implementation commits; this `review.md` closes the trail. The branch override (`feat/desktop-GUI`, no `{feature}/{ADVANCE}` branch) was explicitly stated in the approved plan §"Branch", so it is a sanctioned deviation, not drift |
| Naming, clean-architecture and file placement | **Satisfied.** See §5 |

---

## 5. Naming, placement, and architecture

- **Placement.** `CLAUDE.md`'s "no bare files at a layer's root" rule targets `src/` DDD modules;
  the renderer's top level is already kind-named (`components/`, `screens/`, `state/`, `styles/`,
  `testing/`). Every new file lands in one of those or in the new `content/`, which was approved at
  Gate R as D-E Option 1 and holds only pure, React-free transformations of the item's `content`
  field — the domain's own word. Nothing was dropped loose at a root. `renderer/content/` is a
  reasonable sibling of `state/` (whose `diagnostic-rows.ts` is the standing precedent for pure
  view logic outside its component), and correctly *not* `shared/`, which is the main↔renderer
  boundary.
- **Names.** `light-markdown.ts` / `long-content.ts` / `markdown-content.tsx` / `item-card.tsx` are
  kebab-case files exporting PascalCase components, matching `nav-bar.tsx` → `NavBar`.
  `ItemCard`'s inline props-object type is byte-for-byte the shape `NavBar` uses.
  `LONG_CONTENT_CHARS` / `LONG_CONTENT_NEWLINES` match `MAX_CONTENT_BYTES` / `ITEM_TYPES`.
  CSS reuses the existing `.item-*` prefix, with modifiers as bare adjectives on the block
  (`.item-row.pinned`, `.item-content.collapsed`) exactly like `.check-row.warning` /
  `.disclosure.open`. `.item-toggle` overrides base.css's heavy `button` the same way
  `.connect-tools .disclosure-header` already does.
- **The one deliberate convention deviation** — `parseLightMarkdown` returns `Block[]`, not a
  `Result` — is argued in the file's own header comment (`light-markdown.ts:9-13`) and is correct:
  the function is total by design, so a `Result` would be a permanently-`ok` wrapper. This is the
  kind of deviation that should be documented in-file, and it is.
- **Hexagonal shape holds.** Pure core (`content/`, no React, no DOM, no i18n, no clock) →
  adapter (`markdown-content.tsx`) → composition (`item-card.tsx`) → screen (`project.tsx`, which
  shrank back to fetching and list composition and correctly dropped its now-unused `formatDate`
  and `useLanguage` imports).
- **All ten Gate-P decisions were implemented as approved.** P-C1 separate `long-content.ts`;
  P-C2 `\n` preserved as a span + `white-space: pre-line` (verified: `parseLightMarkdown("a\nb\nc")`
  yields `[a, \n, b, \n, c]`), no `<br>`; P-C3 flat `Inline`, `` **run `x`** `` keeps its backticks;
  P-C4 toggle above the pills; P-C5 keyed `Fragment`s with targeted suppressions; P-C6 unscoped
  `.md-*` in the project section with an ownership comment; P-C7 `.md-pre` mirrors
  `.connect-tools … pre`; P-C8 the DOM test drives `ProjectScreen`; P-C9 a list interrupts a
  paragraph with no blank line (verified); P-C10 `ItemCard` renders its own `<li>`.

---

## 6. Issues

### Critical

None.

### Warning

**W1 — Two of the five arms of the security-relevant element switch have no test at any level.**
`markdown-content.tsx:47-55` (`<ul className="md-list">`) and `:56-61`
(`<pre className="md-pre"><code>`) are verified only by reading them. `renderBlock` *is* the
XSS boundary; a wrong tag or a lost class there would be caught by nothing. §9's criterion is
worded "`- `/`* ` runs render as `<ul>` … a fence renders as `<pre><code>`", i.e. about the DOM.
Cheap fix — one more DOM case:

```tsx
item({ id: "1", content: "- uno\n- dos\n\n```\ncode\n```" })
// expect ul.md-list li → 2 ; pre.md-pre > code textContent → "code"
// expect container.querySelectorAll("img, a, iframe, style") → 0   (widen case 6 while there)
```

**W2 — the availability fixture does not exercise what its name claims.**
`light-markdown.test.ts:193-196` builds `"**"×4000 \n "`"×4000 \n 2000 numbered lines`. The
backtick line starts with three backticks at column 0, so `FENCE` (`light-markdown.ts:28`) matches
and `readFence` swallows **the entire remainder**: the 2000 `N. line` lines never reach
`readOrderedList` or `parseInline`. The result is `blocks.length === 2`, which makes
`expect(blocks.length).toBeGreaterThan(0)` (line 201) close to vacuous. The timing measurement is
still real (32,894 chars, 2.5 ms), and only the bold path on the 8,000-char star line is genuinely
stressed. Fix: prefix the backtick run so it cannot open a fence (`` `x${"`".repeat(4000)}` ``) and
assert the block kinds, not just a non-zero length.

**W3 — two test names promise more than their assertions deliver.**
- `light-markdown.test.ts:160` — "*comes back unchanged, **with no invented span***" asserts only
  `flatten(...) === text`, and `flatten` collapses a `text` span and an invented `bold`/`code` span
  to the same string. Assert the block shape
  (`toEqual([{ kind: "paragraph", spans: [{ kind: "text", text }] }])`) to make the title true.
- `light-markdown.test.ts:180` — `describe("… totality (never throws, **never drops input**)")`
  asserts only `.not.toThrow()`. Add the `flatten` half for each fixture.

**W4 — D-B's headline behaviour is machine-unprotected.** "Single newlines inside a paragraph are
preserved as line breaks" is half the defect this advance exists to fix, and no test asserts it
directly. `light-markdown.test.ts:186` uses `parseLightMarkdown("a\nb")` only as the *right-hand
side* of the CRLF equality, so it would still pass if both sides lost the newline. I confirmed by
hand that the spans are `[a, "\n", b]` and that `screens.css:333-336` renders them via
`white-space: pre-line`, so the behaviour is correct today — it is simply unguarded. Add one
explicit assertion.

None of W1–W4 changes the verdict: the behaviours are all present and were verified by the reviewer
directly, and the approved plan's §4.2 mapped criterion 13 to the parser tests. They are the four
places a future regression would slip through unnoticed, and are worth a follow-up commit.

### Suggestion

**S1 — dead loop guard.** `readOrderedList` (`light-markdown.ts:88-99`), `readUnorderedList`
(`:107-114`) and `readParagraph` (`:129-145`) end each iteration with `if (i >= lines.length) break;`,
which can never be the exit that matters: the next iteration's `lines[i] ?? ""` already yields `""`,
which fails every matcher (and is blank for the paragraph reader) and breaks anyway. A plain
`while (i < lines.length)` with the single match guard is shorter, has one exit, and drops the
`?? ""` fallback that only exists to satisfy the dead path.

**S2 — asymmetric helper.** `readHeading(match, start, blocks)` (`:65`) takes a
`RegExpExecArray` while its four siblings take `(lines, start, blocks)`, and it never uses `lines`.
Its whole body is one `push` and `return start + 1`; inline it at `:48-51` or give it the sibling
signature so the five readers read as one family.

**S3 — out-parameter shape.** `readX(lines, start, blocks): number` mutates a passed array *and*
returns an index — two outputs, one of them a side effect. Returning `[Block, number]` (or
`{ block, next }`) would make all five helpers pure and let the dispatcher own the array. This was
the approved plan's shape, so it is not a deviation; it is the least readable thing in an otherwise
very clean file.

**S4 — the toggle rebuilds the whole element tree.** `useMemo` (`markdown-content.tsx:21`) correctly
prevents re-*parsing* on a toggle click, but `blocks.map(renderBlock)` still re-runs for up to 32 KiB
of content on every expand/collapse. `export const MarkdownContent = memo(function MarkdownContent(…))`
makes the toggle O(1) in content size for a one-line change. (Card-to-card isolation is already
correct — `setExpanded` is card-local, so no sibling re-renders.)

**S5 — inconsistent annotation.** `renderSpans` (`markdown-content.tsx:65`) is the only one of the
three helpers without an explicit return type, which undercuts the file's own stated reason for
annotating `renderBlock`/`renderSpan` (a new union arm must fail compilation).

**S6 — undocumented (safe) plan deviation.** The plan's `.md-list li + li` shipped as
`.md-content .md-list li + li` (`screens.css:341`). Same effect, higher specificity, no harm — but
it is the one selector that differs from the approved plan with no note. Either restore the planned
selector or add a one-line comment saying why it is scoped.

**S7 — the spec's element allowlist is now one element short of the truth.** `refined.md` §7.2 lists
`svg` but not `path`, and `PinnedStar` (`item-card.tsx:87-90`) emits a `<path>`. It is a static
literal with `fill="currentColor"` and carries no user data, so this is a documentation drift, not a
security issue — but the spec and the code should not disagree about a closed list.

**S8 — a bare marker renders an empty bullet.** `"- "` with nothing after it parses to an
`unordered-list` with one empty item, i.e. a bullet with no text (confirmed by probe). Nothing is
lost and it is consistent with "the marker is consumed", but rendering it as literal text would be
friendlier. Untested either way; worth a one-line decision comment if it stays.

**S9 — `parseInline` is exported.** The plan described it as an internal helper; it is exported at
`light-markdown.ts:158` so the unit test can call it directly (`light-markdown.test.ts:56-62`,
`:113-124`). This is a reasonable trade (the alternative is asserting inline behaviour through block
wrappers) and the export is harmless, but it does widen the module's public surface for tests only.

---

## 7. What I checked and found nothing wrong with

Recorded so a later reader knows these were examined, not skipped:

- **The two `indexOf` latches.** Both are sound — neither can suppress a reachable span (proof in
  §4). The plan's claim that they turn a 32 KiB `**` line from 16,000 scans into two is inaccurate
  (each attempt matches immediately at `i+2` and costs O(1) regardless), but the latches are still
  correct and cheap; nothing to fix.
- **Regex safety.** `#{1,3}`, `\d{1,9}`, `[ \t]*` and `(.*)$` — all anchored, all single-quantifier,
  no nested quantifier over user input. `#### h4` and a 13-digit "number" both correctly fall
  through to a paragraph (backtracking is bounded and terminates).
- **`<ol start>`.** The only user-derived attribute in the advance; bounded to nine digits *before*
  `Number.parseInt`, so it is provably an integer and cannot be `NaN`.
- **Class-name leakage.** The new global `.md-*` and `.item-*` rules are referenced by no other
  screen, so the deferred `search.tsx` is genuinely unaffected today.
- **`.md-content` flex vs list markers.** `.md-content` is the flex container and `.md-list` is a
  flex *item*, not a flex container — so `<li>` children are not blockified and their `::marker`
  survives. The plan's warning was heeded.
- **`.item-toggle` cascade.** `.item-toggle` (0,1,0) beats base.css's `button { font: inherit }`
  (0,0,1), so `font-size: 0.78rem` applies; base.css sets no `outline`, so the default focus ring is
  intact.
- **D-G unit conversion.** `12px → 0.75rem`, `12.5px → 0.78rem`, `11.5px → 0.72rem`; structural
  values (`176px`, `48px`, `20px`, `100px`, borders, radii, padding, gaps) stayed px, as approved.
- **Ritual ordering.** The `Approved:` line landed in `16e7bd5`, strictly before `d7e23ed`.

---

## 8. Bottom line

The advance does exactly what the approved spec and plan said, and the one genuinely dangerous part
— an untrusted 32 KiB string becoming DOM — is built the safe way: a pure, total, React-free parser
proved first, then a closed two-`switch` adapter whose element set is enforced by the compiler, and
no HTML-string path anywhere. Scope discipline is exact (zero bytes under `src/`, `main/`,
`preload/`, or either `package.json`), the truncation invariant is structural rather than
conventional, and both workspaces are green under commands I ran myself. The four Warnings are
test-coverage gaps around behaviour that is correct today; fixing W1 and W4 in a follow-up would
close the last places a regression could land silently.
