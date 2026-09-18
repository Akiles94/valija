# CARDS — Project item cards with light Markdown rendering · Refined Spec

**Status:** Gate R **approved** (Oscar 2026-08-29) — all ten defaults (D-A … D-J) approved as
written, no changes requested.

**Directory:** `CARDS` — a UI-polish advance, deliberately not a milestone number (same posture
as `GUI`).
**Source:** Oscar's review of `desktop/src/renderer/screens/project.tsx` plus an approved design
canvas ("Option A" + the Markdown refinement). The canvas is **not** shippable code and the
planner cannot open it — §5 restates every value from it, and §5 is the visual source of truth
for this advance.
**Inherits from:** `advances/GUI/refined.md` (D-V bilingual catalogs, D-Q theming, P-D20
no-network surface), `docs/gui.md`, `docs/SPEC.md` §7/§9/§10a.
**Touches exactly one process:** the renderer. No main-process file, no preload, no IPC channel,
no `src/**` file, no dependency in the crypto path.

---

## 1. Goal

**Make the project screen's item list readable: render each saved item as a bordered card with a
header row (type · date · pinned state), tags as individual pills, and its content interpreted as
light Markdown when the AI wrote it that way — with long content collapsed behind a working
"Show more" toggle — without changing one byte of what is stored, exported, or handed to an AI
tool.**

Three phrases carry the whole scope:

- **"Render, don't restructure."** `ContextItem.content` stays a single trimmed 1–32768-byte
  string. No new schema field, no per-type structured payload, no migration, no MCP contract
  change. The fix lives entirely in how the project screen *paints* text it already receives.
- **"Light Markdown."** A deliberately small, closed subset (§6 D-A), parsed by our own code into
  React elements. Not CommonMark, not a Markdown library, not an HTML string.
- **"The project screen."** `search.tsx` has the identical bug and is explicitly deferred
  (§4 Out). `pack-preview.tsx` keeps showing the export verbatim in a `<pre>` and is untouched.

---

## 2. User walkthrough — the feature from Oscar's side

### 2.1 The end-to-end flow

Oscar unlocks the vault and opens the project **valija** from the Dashboard. The screen chrome is
identical to today: Back button, `<h1>valija</h1>`, the type-filter `<select>`, the "Paquete de
contexto" button. Everything below that is what changes.

| # | What Oscar does | What he sees back |
|---|---|---|
| 1 | Opens the project | A vertical stack of bordered cards (10px apart), newest first — no bullet markers, no run-on spans |
| 2 | Looks at a plain item — a one-sentence `preference`, unpinned, no tags | Header row: `PREFERENCE` (small, uppercase, muted) on the left, `12 ago 2026` on the right. Below it, the sentence as an ordinary paragraph. No toggle, no pills. **Visually the same text it always showed, just inside a card.** |
| 3 | Looks at his own structured `progress` note (the Claude-Code diagnosis, tags `mcp, claude-code, connection, gui, debugging`) | Header row `PROGRESS · 28 ago 2026`. Content renders as: a bold lead-in line "Diagnóstico y fix: valija no conectaba en Claude Code (2026-08-28)" (no literal `##`), then a paragraph whose "Síntoma:" is bold (no literal `**`), then a real numbered list with items 1 and 2 (no literal `1.` typed inline). Five separate tag pills sit under the content. The card is clipped at a fixed height with a soft fade into the page background and a **"Ver más"** control |
| 4 | Clicks **"Ver más"** | The same card expands in place — full content, no fade, no clipping, nothing scrolls or navigates. The control now reads **"Ver menos"** and collapses it again |
| 5 | Looks at a pinned `decision` | The card's border is accent-coloured instead of grey; the header row shows a small filled star, the word **Fijado**, a muted `·`, then `DECISION` — the star, word and type label all in the accent colour. The date stays muted on the right |
| 6 | Filters by type, or refocuses the window | The list reloads exactly as today; every card renders under the same rules. Expanded cards return to collapsed after a reload (expansion is view state, never persisted) |
| 7 | Switches the app to English in Settings | "Ver más/Ver menos" become "Show more/Show less" and "Fijado" becomes "Pinned". **The type labels and the saved content itself do not change one character** — domain vocabulary and user content are never translated |

### 2.2 What the rendered content is used for afterwards — and what it deliberately does not touch

| Surface | After this advance |
|---|---|
| Project screen item list | The only place that interprets Markdown. Display only |
| **Context pack preview** (`pack-preview.tsx`) | **Unchanged.** Still a `<pre>` of the exact export text; the notice "shown exactly as it will be exported — never translated" stays literally true |
| **Export to file / clipboard** (`valija export`, the Export… button) | **Unchanged, byte-for-byte.** Markdown rendering never round-trips into stored or exported text |
| **What an AI tool receives** via `get_context` / `search_context` | **Unchanged.** The MCP server is a separate process that never runs this code |
| **CLI `valija show`** | **Unchanged.** Still prints the raw string |
| **Search screen** | **Unchanged this advance** — still the unstyled list. Deferred on purpose (§4 Out) |
| **The vault** | **Never written.** This screen performs no write of any kind; the parser is pure and the expand/collapse state is component-local memory, never a preferences write |

The one-line mental model for a reviewer: *the bytes are the contract; the card is a lens.*

---

## 3. Context snapshot — verified facts the planner must build on

1. **`project.tsx` today** renders `<li>` with five sibling spans and a `<p>`; JSX drops the
   whitespace between the spans, so `progress28 ago 2026FijadoMcp, claude-code` runs together.
2. **`screens.css` has no rule at all** for `.item-list`, `.item-row`, `.item-type`, `.item-date`,
   `.item-pinned`, `.item-tags`, `.item-content`. Everything visible is browser default: `<ul>`
   bullets, `<ul>` padding, and a `<p>` with base.css's `line-height: 1.5`.
3. **Newlines in saved content are currently invisible.** `<p>{item.content}</p>` has no
   `white-space` rule, so HTML collapses every `\n` into a single space. A multi-paragraph AI note
   renders today as one unbroken wall of text. This is a large part of the reported ugliness and is
   fixed by block-level rendering (see D-B).
4. **`screens.css` is organised one commented section per screen.** There is no `project.tsx`
   section yet; this advance adds one. The bordered-box vocabulary already exists
   (`.check-row`, `.client-card`, `.kit-text`: `1px solid var(--color-border)` + `border-radius:
   6px` + padding, no background of its own), and `.check-row.warning` / `.check-row.fatal`
   already establish "swap the border colour to signal state".
5. **`tokens.css` has exactly 8 custom properties per theme** (`--color-bg`, `--color-surface`,
   `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`, `--color-accent-text`,
   `--color-danger`, `--color-warning`). This advance adds none.
6. **`desktop/src/main/infra/no-network-surface.test.ts` scans every non-test `.ts`/`.tsx`/`.css`
   under `desktop/src`** for `crashReporter`, `setInterval`, `fetch(`, `XMLHttpRequest`,
   `http://`, `https://`. A parser that allowlists URL schemes, or a CSS `url(...)` fade image,
   would **fail the suite**, not merely a review. This is a hard constraint on D-A (no links) and
   on the fade implementation (gradient only).
7. **The window's CSP is already strict** (`script-src 'self'`, `connect-src 'none'`,
   `object-src 'none'`, `frame-src 'none'`), navigation off `file:` is denied and
   `setWindowOpenHandler` returns `deny`. Defence in depth, not a licence to relax the renderer.
8. **Icons already have a house style**: inline `<svg aria-hidden="true">` with
   `stroke="currentColor"`/`fill="currentColor"`, sized in the markup (`connect-tools.tsx`'s
   chevron). The star follows it.
9. **Item order comes from SQL**: `item-repo.ts` uses `ORDER BY created_at DESC`. Pinned items are
   **not** hoisted. See D-I.
10. **Catalog parity is machine-enforced twice**: `es.ts` is typed `Catalog` (typecheck) and
    `catalogs.test.ts` walks both trees for key and placeholder parity. New keys must land in both
    files in the same commit.
11. **Base `button` styling is heavy** (`padding: 8px 16px`, border, `--color-surface` background).
    A "Ver más" affordance styled as a default button would dominate the card; `connect-tools`'s
    `.disclosure-header` is the precedent for overriding it inside a screen's own section.
12. **DOM tests are established but rare**: `__dom-tests__/recovery-kit.dom.test.tsx` and
    `relocate-vault.dom.test.tsx` use `@testing-library/react` + jsdom with
    `// @vitest-environment jsdom`. `jsdom` gives `scrollHeight === 0` — relevant to D-D.
13. **Biome `recommended: true`** is on for the whole repo, which includes React's
    `noDangerouslySetInnerHtml` rule. The XSS rule in §7 is lint-enforced, not just reviewed.

---

## 4. Scope

### In

- Rewriting the item list markup in `desktop/src/renderer/screens/project.tsx` (card per item;
  header row; tag pills; Markdown-rendered content; expand/collapse control).
- A new, pure, dependency-free light-Markdown parser + its React renderer under
  `desktop/src/renderer/` (placement: D-E).
- A new `/* project.tsx */` section in `desktop/src/renderer/styles/screens.css`.
- Two new catalog keys (show-more / show-less) in **both** `en.ts` and `es.ts`.
- Unit tests for the parser; a DOM test for the screen (depth: D-J).
- A paragraph in `docs/gui.md` §"Browsing, searching, and taking a pack" describing card
  rendering and stating that the pack/export is unaffected — shipped in the same commit.

### Out (deferred on purpose — name them so the planner does not drift)

- **`search.tsx` / `.search-result` / `.hit-*`** — identical root cause, explicitly deferred to a
  follow-up advance. Do not restyle it, do not import the new renderer into it.
- **`pack-preview.tsx`** — the export text is shown verbatim and stays that way.
- **Any change under `src/**`**: `Content`, `ItemType`, repositories, `context-pack.ts`, MCP tool
  schemas or prompts, the CLI. Zero files.
- **Per-item-type structured schemas** (`decision` → `chosen`/`rejected`/`rationale`, etc.) — the
  heavier alternative Oscar explicitly chose not to do now.
- **Curation of any kind**: no edit, pin/unpin, delete, retag, archive. The GUI's standing
  "no curation" boundary is untouched.
- **A Markdown editor or preview-while-typing** — nothing in this app writes content.
- **Reordering, grouping, or filtering beyond today's type filter** (see D-I).
- **Copy-per-item, item detail view, keyboard navigation of the list** — future work.
- **A new npm dependency** unless D-F is decided against its default.

---

## 5. Visual specification — the mockup restated in values

The planner cannot open the design canvas. These are the values it used; treat this section as
normative, subject to D-G (units).

**List container** (replaces the bare `<ul class="item-list">` defaults)
- `list-style: none; padding: 0; margin: 16px 0 0;`
- `display: flex; flex-direction: column; gap: 10px;`

**Card** (`.item-row`)
- `border: 1px solid var(--color-border); border-radius: 6px; padding: 14px 16px;`
- No background of its own — inherits `--color-bg` (matches `.check-row`, `.client-card`).
- `display: flex; flex-direction: column; gap: 10px;`
- Pinned variant: `border-color: var(--color-accent);` (technique already used by
  `.check-row.warning` / `.check-row.fatal`). No fill, no shadow, no left-bar.

**Header row**
- `display: flex; justify-content: space-between; align-items: center; gap: 12px;`
- Left cluster: `display: flex; align-items: center; gap: 6px;`
  - Pinned only: filled star SVG (12×12, `fill="currentColor"`, `aria-hidden="true"`), then the
    word from `project.pinned`, then a middot `·` in `var(--color-text-muted)`.
  - Type label: `text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;`
    `font-size: 12px; color: var(--color-text-muted)` — and `var(--color-accent)` when pinned
    (star + "Fijado" + type label all accent).
  - The type text stays the raw domain value, untranslated, in both languages (existing rule).
- Right: formatted date, `font-size: 12.5px; color: var(--color-text-muted);` never relative
  ("hoy", "3 days ago" are not on the table — `formatDate` is `dateStyle: "medium"`).

**Content block**
- Base body size, `line-height: 1.5`, `color: var(--color-text)`.
- `overflow-wrap: anywhere` so a long unbroken token (path, base64, hash) cannot widen the card.
- Block spacing inside the content: `8px` between blocks; lists get `padding-left: 20px` and
  `4px` between items; the Markdown heading block renders as a `font-weight: 600` lead-in line at
  body size (see D-C for why it is not an `<h2>`); inline code uses the monospace stack already in
  `screens.css` (`ui-monospace, "Cascadia Code", Consolas, monospace`) at `0.9em` with
  `background: var(--color-surface)`, `padding: 1px 4px`, `border-radius: 4px`.

**Tag pills** (one element per tag, replacing `tags.join(", ")`)
- Row: `display: flex; flex-wrap: wrap; gap: 6px;` below the content.
- Pill: `font-size: 11.5px; color: var(--color-text-muted); background: var(--color-surface);`
  `border: 1px solid var(--color-border); padding: 3px 10px; border-radius: 100px;`

**Collapse treatment** (only when the card is long — see D-D)
- Content wrapper: `max-height: 176px; overflow: hidden; position: relative;`
- Fade: an absolutely-positioned 48px-tall overlay at the bottom,
  `background: linear-gradient(to bottom, transparent, var(--color-bg)); pointer-events: none;`
  **No image, no `url(...)`** (fact 6).
- Toggle: a real `<button type="button">` styled flat — `padding: 0; border: none; background:
  none; color: var(--color-accent); font-size: 12.5px; cursor: pointer;` — with `aria-expanded`
  reflecting state, sitting under the content (above the tag pills or below them: planner's call,
  keep it consistent).
- Expanded: no `max-height`, no fade, label switches to show-less.

**Untouched on this screen**: `NavBar`, Back button, `<h1>`, the type filter `<select>`, the
"Paquete de contexto" button, the error paragraph, the empty state.

---

## 6. Decisions to confirm (options, trade-offs, defaults)

### D-A. The Markdown subset

Everything outside the chosen subset renders as literal characters — that is the safety property,
not a gap.

- **Tier 1 — the mockup minimum:** `#`/`##`/`###` heading lines, `**bold**`, ordered lists
  (`1. `). Smallest parser; leaves `- ` bullets and backticks visible as literal characters, which
  LLM-written notes contain constantly.
- **Tier 2 — recommended:** Tier 1 **+** unordered lists (`- ` / `* `), inline code
  (`` `x` ``), fenced code blocks (```` ``` ````), blank-line paragraph splitting.
  Covers essentially all of what Claude/ChatGPT actually emit when summarising a session, at a
  parser that is still ~120 lines of line-based matching.
- **Tier 3 — rejected:** Tier 2 + italics, links, images, tables, blockquotes, nested lists,
  task lists, raw HTML passthrough.

**Two exclusions are argued, not arbitrary:**

- **No italics, in either form.** `_italic_` would corrupt the exact vocabulary this vault is full
  of — `VALIJA_STATE_HOME`, `save_context`, `created_at` would render as
  `VALIJA<em>STATE</em>HOME`. `*italic*` collides with the `* ` bullet marker and with `**bold**`
  disambiguation. The visual payoff is near zero; the corruption risk is real.
- **No links.** Three independent reasons: (a) the app denies navigation and window-opening and
  sets `connect-src 'none'`, so an anchor would be dead or a phishing affordance;
  (b) `docs/gui.md` already promises "plain text, not a clickable link, since this app never opens
  a URL"; (c) a scheme allowlist would put the literal strings `http://`/`https://` into
  `desktop/src/**`, which **fails `no-network-surface.test.ts`**. Link text renders literally,
  URL and all.

**Default: Tier 2.** Reason: it is the smallest subset that makes real vault content look right
(paths and commands in backticks, bullet lists, config snippets in fences), and every added rule is
line-anchored and closed. *Trade-off:* fenced code blocks are the only multi-line-state rule in the
parser and need an "unterminated fence" policy (default: treat the remainder as code).

**Precise rules the planner must implement (under the default):**

| Kind | Trigger | Renders as | Notes |
|---|---|---|---|
| Heading | line starts `#`, `##`, or `###` + space | bold lead-in line (D-C) | `####`+ is literal text |
| Ordered list | run of lines matching `^\s*\d+\.\s+` | `<ol>` + `<li>` | `start` attribute taken from the first number, so a list beginning at "2." is not silently renumbered |
| Unordered list | run of lines matching `^\s*[-*]\s+` | `<ul>` + `<li>` | no nesting; deeper indents are flattened |
| Fenced code | line is exactly ```` ``` ```` (optionally + info string) | `<pre><code>` | info string ignored; content is literal, no inline parsing; unterminated fence swallows the rest |
| Paragraph | any other run of non-blank lines | `<p>` | single newlines inside a paragraph are preserved as line breaks (D-B) |
| Bold | `**…**` within one line, non-empty | `<strong>` | non-greedy; unmatched `**` stays literal |
| Inline code | `` `…` `` within one line, non-empty | `<code>` | **wins over bold** — backtick contents are never re-parsed |

Inline rules never apply inside fenced code. Blocks never span a blank line.

### D-B. What happens to plain content and to newlines

- **Option 1 — literally "as today":** one `<p>`, newlines collapsed into spaces. Faithful to the
  raw idea's wording, but preserves the run-on-wall bug (fact 3) for every multi-line plain note.
- **Option 2 (default) — block-aware for everything:** even content with no Markdown syntax is
  split on blank lines into paragraphs, and single newlines inside a paragraph become line breaks.
  A one-sentence item is *identical* to today (one paragraph, no toggle); a multi-line plain item
  finally shows its own line structure.
- **Option 3 — `white-space: pre-wrap` on a single block:** matches `.kit-text`/`.pack-text`.
  Simplest, but mixes badly with the parsed blocks (double spacing) and reads as terminal output.

**Default: Option 2.** Reason: it honours the intent of "plain stays plain" (no invented
structure) while fixing the invisible-newline defect that is half of the complaint. *Trade-off:* it
is a small, deliberate deviation from "renders exactly as it does today" — call it out at Gate R.

### D-C. Are Markdown headings real `<h2>` elements?

- **Option 1 — real `<h2>`/`<h3>`:** semantic, but every card would inject headings into the
  document outline under the screen's single `<h1>`, so a 30-item list produces 30 sibling
  headings of user-authored text and inherits base.css's `h2 { font-size: 1.1rem; margin: 24px 0
  8px }` sizing that was written for screen sections.
- **Option 2 (default) — a styled `<p class="md-heading">`** with `font-weight: 600`, body size,
  no outline participation.
- **Option 3 — `<strong>` inside a paragraph:** same look, but conflates a block with an inline
  span in the parser's model.

**Default: Option 2.** Reason: the user text is content, not page structure; the mockup's "bold
lead-in line" is exactly this. *Trade-off:* a screen-reader user loses heading navigation inside a
card — acceptable for a list of short excerpts, and revisitable if a per-item detail view ever
lands.

### D-D. Truncation: mechanism, threshold, and how "is it long?" is decided

Mechanism options:
- **Option 1 (default) — CSS `max-height` clamp + gradient fade + `useState` toggle**, at
  **176px collapsed** (~7 body lines at `line-height: 1.5`). Works uniformly across headings,
  lists and code blocks.
- **Option 2 — `-webkit-line-clamp: 4`:** cheaper for plain text, but line-clamp does not work
  across multiple block children, so structured cards would need Option 1 anyway. Two mechanisms
  for one behaviour.
- **Option 3 — truncate the source string before parsing (e.g. first 400 chars):** rejected — it
  cuts Markdown mid-syntax and would show half a list or an orphaned `**`.

Deciding *whether* a card is long:
- **Option A (default) — a pure predicate on the content string**, e.g.
  `content.length > 420 || newlineCount >= 6`. Deterministic, unit-testable, no layout
  measurement, no `ResizeObserver`, jsdom-friendly.
- **Option B — measure `scrollHeight > clientHeight` in a layout effect.** Pixel-accurate, but
  jsdom reports `0` for both, so the DOM test would assert nothing real, and it re-measures on
  every resize.

**Default: Option 1 + Option A**, with one **invariant that removes Option A's only real danger**:
*the clamp and the toggle are governed by the same predicate*. If the predicate says "short", the
card is rendered **unclamped** — so a mis-predicted short-but-tall item is fully visible rather
than silently cut. Content is **never clipped without a visible control to expand it.**
*Trade-off:* a card just over the threshold may show a toggle that reveals only a line or two.
That is the harmless failure direction; the numbers (420 chars / 6 newlines / 176px) derive from a
~640px card inner width at the 720px `.screen` max-width and are tunable at review.

### D-E. Where the code lives

The renderer is not a DDD module, but the repo rule "every file sits in a folder that names its
kind" still applies.

- **Option 1 (default) — split by kind, two units:**
  - `desktop/src/renderer/content/light-markdown.ts` — pure `parseLightMarkdown(text): Block[]`,
    no React import, fully unit-testable in the default Node environment.
  - `desktop/src/renderer/components/markdown-content.tsx` — the React adapter that turns `Block[]`
    into elements, plus `desktop/src/renderer/components/item-card.tsx` for the card itself.
  This is the hexagonal shape in miniature: a pure transformation with a rendering adapter over it,
  each testable alone.
- **Option 2 — one `.tsx` that parses and renders in one pass.** Fewer files; couples the only
  security-relevant logic to React and forces every parser test through jsdom.
- **Option 3 — put the parser in `desktop/src/shared/`** so a future `search.tsx` pass can reuse
  it. But `shared/` is the main↔renderer boundary (i18n today), and Markdown display is
  renderer-only; a `renderer/content/` module is equally reusable by `search.tsx` later.

**Default: Option 1.** *Trade-off:* three new files instead of one — consistent with the repo's
small-readable-units rule and with `state/diagnostic-rows.ts`'s precedent of pure view logic
separated from its screen.

### D-F. Hand-rolled parser vs. a Markdown library

- **Option 1 (default) — hand-rolled, zero dependencies.** The renderer's only runtime dependency
  today is React. The output is React nodes, so escaping is by construction and no HTML string
  ever exists. ~120 lines, closed grammar, every rule ours.
- **Option 2 — `react-markdown` (+ `remark-gfm`).** Renders React nodes (no `innerHTML` by
  default) and is battle-tested, but pulls ~15 transitive packages (unified/micromark/…) into a
  local-first, E2EE product's supply chain, defaults to full CommonMark including links, images
  and autolinks that we would then have to disable, and grows the bundle by an order of magnitude
  more than the feature is worth.
- **Option 3 — `marked` + `DOMPurify` + `dangerouslySetInnerHTML`.** Rejected outright: it
  reintroduces the exact HTML-string path §7 forbids, and would trip Biome's
  `noDangerouslySetInnerHtml`.

**Default: Option 1.** *Trade-off:* we own the edge cases (unmatched `**`, `2**32**5`, a stray
backtick). Mitigation is explicit: the parser ships with adversarial unit tests (§9), and every
unmatched marker must degrade to literal text rather than throw or drop input. **A hard rule for
either option: the parser must never lose characters — anything it does not understand is emitted
verbatim.**

### D-G. `px` vs `rem` for the new sizes

The mockup uses `12px` / `12.5px` / `11.5px`; `screens.css` today uses `0.85rem` / `0.9rem` /
`0.8rem`.

- **Option 1 (default) — convert to rem** (`0.75rem`, `0.78rem`, `0.72rem`), keeping structural
  values (borders, radii, padding, gap, the 176px cap) in px as the file already does. Matches the
  file's idiom and respects a user's root font-size setting.
- **Option 2 — keep the mockup's px** for pixel fidelity to the approved canvas.

**Default: Option 1.** Visually identical at a 16px root; consistent with every existing rule in
the file. *Trade-off:* a fussy pixel-diff against the canvas will show ±0.5px.

### D-H. The two new catalog keys

- **Default:** `project.showMore` / `project.showLess` — en `"Show more"` / `"Show less"`,
  es `"Ver más"` / `"Ver menos"`. No placeholders (so `catalogs.test.ts` placeholder parity is
  trivially satisfied). Alternative names (`project.expand`/`project.collapse`) are equivalent;
  what is **not** optional is that both catalogs gain matching keys in the same commit.
- The star icon carries no text of its own: it is `aria-hidden="true"` next to the already-visible
  translated "Pinned"/"Fijado" word, so no new key is needed for it.

### D-I. Do pinned items sort to the top?

`item-repo.ts` returns `ORDER BY created_at DESC`; pinning is a pack-building signal
(`context-pack.ts`), not a list-ordering one.

- **Option 1 (default) — keep repository order**, distinguish pinned purely visually.
  Zero divergence from `valija show`, no client-side re-sort, no surprise when the CLI and GUI are
  compared side by side.
- **Option 2 — hoist pinned client-side.** Arguably more useful, but it makes the GUI's list order
  differ from the CLI's and from the SQL, for a screen whose stated identity is "the same rows
  `valija show` prints".

**Default: Option 1.** Flagging it because a reviewer may reasonably expect Option 2 on seeing
accent-bordered cards mid-list.

### D-J. Test depth

- **Option 1 (default) — parser unit tests (Node env) + one screen DOM test** at
  `screens/__dom-tests__/project.dom.test.tsx`, following the two existing DOM tests. The DOM test
  covers what unit tests cannot: the toggle's interactive behaviour, the pinned class, pill count,
  and the literal-HTML escaping assertion.
- **Option 2 — parser unit tests only.** Cheaper; leaves the expand/collapse behaviour and the XSS
  property unverified by machine.
- **Option 3 — add a snapshot test of the rendered card.** Rejected: snapshots of a design in flux
  produce churn without asserting anything a reviewer cares about.

**Default: Option 1.** The XSS assertion in particular should be executable, not a review promise.

---

## 7. Security surfaces — must not be weakened

`content` is **untrusted input**. It is free text an AI wrote into the vault; nothing in the
product reviews it, and an item can also arrive through `import` from a third-party chat export.
Treating it as a rendering source is the one genuinely security-relevant change in this advance.

1. **No HTML string path, ever.** No `dangerouslySetInnerHTML`, no `innerHTML`/`outerHTML`, no
   `insertAdjacentHTML`, no `document.write`, no `new Function`/`eval`, no `DOMParser`. The
   renderer builds React elements only, where text nodes are escaped by construction. Biome's
   recommended ruleset already fails the build on `dangerouslySetInnerHtml`.
2. **No element type that can execute or fetch.** The emitted set is closed and reviewable:
   `p`, `strong`, `code`, `pre`, `ol`, `ul`, `li`, `span`, `div`, `button`, `svg`. **No `a`, no
   `img`, no `iframe`, no `style`, no `object`** — and therefore no attribute derived from user
   text (no `href`, `src`, `srcset`, `style`, `on*`). The only attributes on user-derived elements
   are static class names and `<ol start>` from a parsed integer.
3. **No URL handling anywhere in the parser** (D-A). Also enforced mechanically: `http://` and
   `https://` are forbidden strings in `desktop/src/**` per `no-network-surface.test.ts`.
4. **CSP and window hardening are untouched.** `main-window.ts` is not in scope. No
   `'unsafe-inline'` script relaxation, no new `img-src`/`connect-src` allowance. The CSS fade must
   be a gradient — `url(...)` is forbidden by the same test.
5. **No timers.** `setInterval` is a forbidden string in this tree; the expand/collapse is a pure
   state toggle, and any transition is CSS.
6. **No content leaves the renderer.** No logging of `content` (or of a parse failure containing
   it), no clipboard write added, no IPC call added, no new preload surface. The bridge is not
   modified.
7. **Expansion state stays in memory.** It must **not** be written to the preferences file: that
   file is plaintext on disk outside the vault, and persisting "which items are expanded" would
   leak item ids — vault metadata — into cleartext. Session-local `useState` only.
8. **Truncation is cosmetic, not redaction.** Collapsed text is still in the DOM and still read by
   assistive tech; nothing in the UI may imply that collapsing hides anything from anyone with
   access to the unlocked window.
9. **Availability counts too.** The parser runs on strings up to 32 KiB, once per visible item. It
   must be linear-ish and free of catastrophic-backtracking regexes (no nested quantifiers over
   user input); a pathological item must not freeze the window.
10. **Nothing in `src/**` changes**, so the encryption path, key handling, keychain use, MCP tool
    surface and data at rest are all untouched by construction. Any diff under `src/` in this
    advance is a bug in the plan.

---

## 8. Architecture notes (clean architecture in a renderer)

- The parser is the **pure core**: `string → Block[]`, total (never throws, never drops input), no
  React, no DOM, no i18n, no clock. It is the only place Markdown semantics live, and it is
  testable in the plain Node environment like `state/diagnostic-rows.ts`.
- The React components are **adapters** over that core: `markdown-content.tsx` maps `Block[]` to
  elements; `item-card.tsx` composes header, content, tags and the toggle; `project.tsx` shrinks
  back to data-fetching + list composition.
- The "is this long?" predicate is a second pure function beside the parser — a policy, not a
  component concern — so the truncation rule can be tuned and tested without rendering.
- Translated copy enters only through `useT()` in the components; the pure core is language-blind,
  matching the standing rule that domain vocabulary and user content are never translated.
- The `Block` model should be a small discriminated union (`paragraph | heading | ordered-list |
  unordered-list | code`) with inline spans as `text | bold | code`, so exhaustiveness is a
  typecheck rather than a default branch.

---

## 9. Acceptance criteria (reviewer checklist)

Each item traces back to a walkthrough step (§2) or a constraint (§3, §7).

**Rendering — cards (§2 steps 1–2, 5)**
- [ ] The item list renders one bordered card per item, in a vertical stack with `10px` gaps; no
      bullet markers and no default `<ul>` padding remain.
- [ ] Card border, radius and padding match §5 and use only existing tokens; `tokens.css` is
      unchanged and no new custom property is introduced.
- [ ] Header row shows the type label left and the `formatDate` date right, on one line, with
      visible separation (the run-together spans of today are gone).
- [ ] The type label is the raw domain value (`decision`, `progress`, …, `imported`),
      untranslated, in both languages.
- [ ] The date is absolute (`dateStyle: "medium"`); no relative-time copy was introduced.
- [ ] A pinned item's card border is `var(--color-accent)`; its header shows an `aria-hidden` star
      SVG, the translated pinned word, a muted `·`, and the type label, all in the accent colour.
- [ ] An unpinned item has no star, no pinned word, and the default border colour.
- [ ] Each tag renders as its own pill; an item with 5 tags renders 5 elements, not one
      comma-joined string. An item with no tags renders no pill row.

**Rendering — Markdown (§2 steps 2–3)**
- [ ] Content with no supported syntax renders as plain paragraph text; no `##`, `**` or `1.`
      characters are invented and no structure is imposed.
- [ ] A leading `## …` line renders as a bold lead-in line with the `##` characters absent, and
      does **not** emit an `<h1>`/`<h2>`/`<h3>` element (D-C).
- [ ] `**Síntoma:**` renders as `<strong>Síntoma:</strong>` with no literal asterisks.
- [ ] A run of `1. ` / `2. ` lines renders as a single `<ol>` with one `<li>` each; a list whose
      first number is not 1 keeps its starting number.
- [ ] Under the D-A default: `- ` / `* ` runs render as `<ul>`; `` `x` `` renders as `<code>`;
      a ```` ``` ```` fence renders as `<pre><code>` with its contents unparsed.
- [ ] Unsupported syntax is preserved verbatim: a `[text](example)` link, `_snake_case_`
      identifiers, `> quotes`, `| tables |` and `#### h4` all appear as literal characters, with
      **no** `<a>`/`<em>` element and no character dropped.
- [ ] Round-trip property: concatenating the visible text of a rendered card reproduces the source
      content minus only the consumed marker characters — no truncation, no reordering, no loss.
- [ ] Content is escaped: an item whose content contains `<img src=x onerror=alert(1)>` displays
      that string as visible text and creates **zero** `img` elements in the DOM (executable test).
- [ ] A very long unbroken token does not widen the card or introduce horizontal scrolling.

**Truncation (§2 steps 3–4)**
- [ ] A long item renders collapsed at the specified max-height with a gradient fade and a visible
      toggle; the toggle carries `aria-expanded` and a translated label.
- [ ] Clicking the toggle expands the card in place — full content, no fade, no clipping — and the
      label switches to the show-less string; clicking again collapses it.
- [ ] **Invariant:** no card is clipped without a visible toggle. If the predicate says "short",
      the content is rendered unclamped.
- [ ] Expanding one card does not affect any other card; a filter change or window-focus reload
      resets cards to collapsed, and nothing about expansion is persisted anywhere.

**i18n (§2 step 7)**
- [ ] `en.ts` and `es.ts` both gain the show-more/show-less keys; `catalogs.test.ts` and the
      `Catalog` typecheck pass.
- [ ] Switching language changes only the toggle label and the pinned word — never the type label
      and never the saved content.

**Scope and non-regression**
- [ ] `git diff --stat` shows **no** file under `src/`, no `desktop/src/main/**`, no preload, no
      `desktop/package.json` dependency change (unless D-F was decided against its default).
- [ ] `search.tsx`, `pack-preview.tsx` and `dashboard.tsx` are untouched.
- [ ] The pack preview still shows the export verbatim; export output is byte-identical to before
      the change.
- [ ] New CSS lives in a single, commented `/* project.tsx */` section of `screens.css`.
- [ ] `docs/gui.md` gains the card-rendering paragraph in the same commit, and states that the
      pack/export is unaffected.

**Security (§7)**
- [ ] No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or `DOMParser` anywhere in
      the new code.
- [ ] No `<a>`, `<img>`, `<iframe>` or `style` attribute is ever emitted from user content; the
      only user-derived attribute value is `<ol start>` from a parsed integer.
- [ ] `no-network-surface.test.ts` passes: no `http://`/`https://`/`fetch(`/`setInterval` in the
      new `.ts`/`.tsx`/`.css` files, and the fade uses a CSS gradient, not `url(...)`.
- [ ] `main-window.ts`'s CSP and navigation handlers are unchanged.
- [ ] A 32 KiB pathological content string (deep repetition of `**`, backticks and `1.` lines)
      parses in well under a frame's budget and does not hang the renderer — covered by a test.
- [ ] `npm run typecheck && npm run lint && npm run test` pass at repo root and in `desktop/`.

---

## 10. Deliverables summary (for the planner, not a plan)

| Deliverable | Nature |
|---|---|
| Pure light-Markdown parser + "is long" predicate | New, renderer-local, dependency-free, unit-tested |
| React renderer for the block model | New component |
| Item card component (header, content, tags, toggle) | New component |
| `project.tsx` list section | Rewritten to compose the card |
| `screens.css` `/* project.tsx */` section | New rules, existing tokens only |
| `en.ts` / `es.ts` | Two new keys each |
| Tests | Parser unit tests (incl. adversarial + escaping) + one screen DOM test |
| `docs/gui.md` | One updated paragraph, same commit |

---

## 11. Biggest risk

**The hand-rolled parser silently corrupts or drops a user's saved text.** This screen is, for a
non-terminal user, the *only* window onto content that has no backup outside the vault — if a
parsing bug swallows a line, mis-pairs a `**`, or eats a `_` inside `VALIJA_STATE_HOME`, the user
sees a subtly wrong version of their own memory and has no reason to distrust it. The stored bytes
are safe (nothing writes), so this is a trust-and-legibility failure rather than data loss, but it
is the failure this advance can actually cause. Mitigations, all mandatory: the emit-verbatim rule
for anything unrecognised, the no-character-loss round-trip test, the exclusion of `_italic_` and
links, and the escaping test — plus the fallback position that any card whose parse looks
suspicious can always be rendered as a plain paragraph, which is strictly today's behaviour.

*Runner-up:* the truncation predicate is a heuristic on characters, not measured pixels — mitigated
structurally by tying the clamp and the toggle to the same predicate, so mis-prediction can only
show a needless toggle, never hide content.
