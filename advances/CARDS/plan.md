# CARDS — Project item cards with light Markdown rendering · Implementation Plan

**Spec:** `advances/CARDS/refined.md` — Gate R **approved** (Oscar, 2026-08-29), all ten decisions
D-A … D-J adopted with their stated defaults, no changes. This plan implements those defaults; it
does not reopen them.

**Branch — read this before anything else.** This advance does **not** get a new
`{feature}/{ADVANCE}` branch. It continues on the branch this session is already on:

```
feat/desktop-GUI          ← continue here; do NOT create feat/cards-CARDS or any other branch
```

This is a deliberate, explicit override of the repo's usual branch-per-advance convention
(`CLAUDE.md` §"The advance ritual" step 3, and the branch lines in `advances/GUI/plan.md` and
`advances/M2/plan.md`). `feat/desktop-GUI` is the branch the GUI advance shipped on and the branch
this repo has continued desktop work on since — e.g. `ef8baa7` *"testing in windows, improving and
polishing UI"* landed straight onto it after the GUI advance's own close commit `51841d8`. It is up
to date with `origin` as of `fcd3060` (Gate R closing for this advance). **Do not re-derive a
branch name from the generic convention later in the advance.**

> **Implementation must NOT begin until Oscar has reviewed this file and recorded an `Approved:`
> line at its top.** The gate is machine-enforced: `.claude/hooks/guard-implementation.sh` matches
> `*/src/*`, which covers every file this advance touches under `desktop/src/**`. Do not work
> around it. The planner never writes that line.

---

## 0. Spec-vs-repo reconciliation (read before starting)

Everything `refined.md` §3 asserts about the repo was re-verified against the working tree. All of
it holds. Six additional facts the spec does not state, and three small spec wrinkles, follow —
each one changes how a slice is written.

**Verified as stated in §3**

1. `project.tsx:99-108` renders `<ul className="item-list">` with five sibling spans and a `<p>`,
   `tags.join(", ")` included. Data-fetching (`useEffect` + `wireFocusRefresh`) is untouched by this
   advance.
2. `screens.css` has no `.item-*` rule; the file is organised one commented section per screen
   (`/* dashboard.tsx */`, `/* recovery-kit.tsx */`, …, `/* diagnostics.tsx */`). There is no
   `/* project.tsx */` section. `.check-row` / `.client-card` establish the bordered-box vocabulary
   and the "swap the border colour to signal state" technique.
3. `<p>{item.content}</p>` has no `white-space` rule → newlines currently collapse to spaces.
4. `no-network-surface.test.ts` scans every `.ts`/`.tsx`/`.css` under `desktop/src` for
   `crashReporter`, `setInterval`, `fetch(`, `XMLHttpRequest`, `http://`, `https://`.
5. `item-repo.ts` orders `created_at DESC` with no pinned hoist (D-I Option 1 stands).
6. `connect-tools.tsx`'s chevron is the icon house style: inline `<svg aria-hidden="true">`, size in
   the markup, `stroke`/`fill="currentColor"`.
7. Catalog parity is enforced twice (`es: Catalog` typecheck + `catalogs.test.ts`' deep walk and
   placeholder parity).
8. `biome.json` sets `linter.rules.recommended: true` with only `suspicious/noConsole` disabled, so
   `noDangerouslySetInnerHtml` is live.
9. DOM tests: `recovery-kit.dom.test.tsx` and `relocate-vault.dom.test.tsx`, both
   `// @vitest-environment jsdom` + `@testing-library/react`, both driving a **screen** through a
   fake `ValijaBridge`.

**Additional facts this plan depends on (not in §3)**

- **F1 — `no-network-surface.test.ts` skips `*.test.ts` but NOT `*.test.tsx`.** Its filter is
  `!full.endsWith(".test.ts")`. The new `project.dom.test.tsx` **will be scanned**. Its XSS fixture
  must therefore contain no URL: use `<img src=x onerror=alert(1)>`, never `src="http://…"`.
  (`light-markdown.test.ts` ends in `.test.ts` and is skipped — keep it clean anyway.)
- **F2 — tsconfig strictness.** The root `tsconfig.json` (which `desktop/tsconfig.web.json` extends)
  sets `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true`. In the parser,
  `lines[i]` is `string | undefined` and every regex capture group is `string | undefined`; the code
  must handle that explicitly (`const line = lines[i] ?? ""` / `match[1] ?? ""`), not with `!`.
- **F3 — tags are already de-duplicated** (`src/context/domain/values/tag.ts:27` pushes only when
  `!tags.includes(...)`), so `key={tag}` on a pill is safe — no duplicate-key warning.
- **F4 — `load()` calls `setItems(null)` before every fetch** (`project.tsx:48`), and the fetch
  resolves in a later microtask. The list therefore genuinely unmounts between a filter change /
  focus refresh and the new data, so per-card `useState` expansion resets by construction — no
  extra code, and §9's "a reload resets cards to collapsed" is testable.
- **F5 — `wireFocusRefresh` listens for `"focus"` on `window`**, so `fireEvent.focus(window)` in
  jsdom triggers a reload — that is how the reset-on-reload criterion gets machine-checked.
- **F6 — `app-main.tsx` imports `screens.css` globally**; new rules apply with no wiring.

**Spec wrinkles (none blocking — recorded so the reviewer isn't surprised)**

- **W1 — §3 fact 5 says "exactly 8 custom properties per theme" and then lists nine**
  (`--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`,
  `--color-accent`, `--color-accent-text`, `--color-danger`, `--color-warning`). `tokens.css` has
  **nine**. Immaterial: this advance adds **none**, which is what the criterion actually checks.
- **W2 — §2.1 row 3 writes the header as `PROGRESS · 28 ago 2026`**, but §5's header row is
  `justify-content: space-between` with the date on the right and the middot used only between the
  pinned word and the type label. **§5 governs** (it is declared the visual source of truth); row 3's
  middot is prose shorthand.
- **W3 — §5 gives no values for the fenced-code block** (`<pre>`): only inline code is specified.
  This plan fills that gap by mirroring the existing `.connect-tools … pre` rule (surface
  background, radius, `white-space: pre-wrap`, the same monospace stack at `0.85rem`) — see P-C7.

---

## 1. Summary

Four slices, all inside `desktop/src/renderer/**` plus two catalog files, one stylesheet section and
one documentation paragraph. **Zero files under `src/`, zero under `desktop/src/main/**`, zero
preload, zero dependency changes** — that is an acceptance criterion, not just an intention.

The shape is D-E's hexagon in miniature and the slice order follows it:

1. **A pure core, proved first.** `parseLightMarkdown` (string → `Block[]`) and `isLongContent` are
   plain functions with no React, no DOM, no i18n, no clock. They are written and adversarially
   tested **before** any component imports them, so untrusted content never reaches a rendering path
   whose verbatim-emission property hasn't already been proved in the Node test environment.
2. **Adapters over that core.** `markdown-content.tsx` maps `Block[]` onto a closed set of React
   elements; `item-card.tsx` composes header, content, toggle and tags; `project.tsx` shrinks back to
   fetching and list composition. The one screen DOM test lands in the same slice as the components
   it proves.
3. **Style last, because it changes no behaviour.** One new `/* project.tsx */` section in
   `screens.css`, existing tokens only, gradient fade (never `url(...)`).
4. **Docs with the code, then the gate.** The `docs/gui.md` paragraph ships with the final code
   slice; the last step is the full two-workspace verification loop and a walk of §9.

The whole advance is roughly **495 production lines** (135 of them CSS), **~440 test lines**, and
**~8 documentation lines**.

---

## 2. Ordered slices

Each slice ends green: `npm run typecheck && npm run lint && npm run test` inside `desktop/`, plus
`npm run lint` at the repo root (root Biome covers `desktop/**`). Exact commands in §4.3.

---

### Slice 1 — The pure core: light-Markdown parser + "is this long" predicate

**Rationale.** This is the only genuinely security-relevant logic in the advance and the one place
`refined.md` §11 names as the real risk (silent corruption of the user's own memory). It is written
first, in isolation, with no React in the file, so every rule in D-A's table and every
degrade-to-literal path is proved by a Node-environment unit test before a single character of it
reaches the screen.

**Files**

| File | Nature |
|---|---|
| `desktop/src/renderer/content/light-markdown.ts` | new, ~170 lines |
| `desktop/src/renderer/content/long-content.ts` | new, ~20 lines |
| `desktop/src/renderer/content/light-markdown.test.ts` | new, ~210 lines |
| `desktop/src/renderer/content/long-content.test.ts` | new, ~30 lines |

`content/` is a new top-level renderer folder, alongside `components/`, `screens/`, `state/`,
`styles/`, `testing/` — D-E Option 1, approved at Gate R. See §7 for why the name fits.

**1.1 The block model** (`light-markdown.ts`, exported types — §8's union, verbatim; `kind` is the
repo's established discriminant, cf. `state/unlock-outcome.ts`):

```ts
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string };

export type Block =
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "heading"; spans: Inline[] }
  | { kind: "ordered-list"; start: number; items: Inline[][] }
  | { kind: "unordered-list"; items: Inline[][] }
  | { kind: "code"; text: string };
```

**1.2 The block scanner** — `parseLightMarkdown(content: string): Block[]`, total, never throws.

- Normalise first: `content.replace(/\r\n?/g, "\n").split("\n")`. (CRLF and lone CR are invisible
  characters; folding them is the only normalisation the parser performs.)
- One `while` loop over line indices, five small `readX(lines, start, blocks): number` helpers that
  each consume one run and push exactly one block, returning the next index. No classes.
- Line matchers, all anchored, all single-quantifier (no nested quantifier over user input, §7.9):

  ```ts
  const FENCE = /^[ \t]*```/;
  const HEADING = /^#{1,3}[ \t]+(.*)$/;         // #### … does not match → literal paragraph
  const ORDERED_ITEM = /^[ \t]*(\d{1,9})\.[ \t]+(.*)$/;   // the {1,9} bound is what makes
  const UNORDERED_ITEM = /^[ \t]*[-*][ \t]+(.*)$/;        // `start` a provably safe integer
  ```

- Dispatch order per line: **fence → blank (flush) → heading → ordered item → unordered item →
  paragraph.**
- **A list interrupts a paragraph without a blank line** (P-C9) — §2.1 row 3's note goes straight
  from a "Síntoma:" paragraph into items 1 and 2. So `readParagraph` stops at a blank line, a fence,
  a heading, or a list item.
- `readFence`: consumes from the opening fence to the next line matching `FENCE`, or to EOF if there
  is none (D-A: "unterminated fence swallows the rest"). Info string ignored. Body joined with
  `"\n"`, **never inline-parsed**.
- `readOrderedList`: `start = Number.parseInt(firstMatch[1] ?? "1", 10)` — bounded to nine digits by
  the regex, so it is the only user-derived attribute value and it is provably an integer.
- `readParagraph`: parses each line's inlines and joins consecutive lines with a literal
  `{ kind: "text", text: "\n" }` span. The newline is **preserved as a character**, not turned into
  an element — rendering it as a line break is CSS's job (P-C2), because `<br>` is not in §7.2's
  closed element set.

**1.3 The inline scanner** — `parseInline(line: string): Inline[]`, linear.

- Left-to-right scan with a literal-text buffer. At each position:
  - `` ` `` → `indexOf("`", i + 1)`. Found at `j > i + 1` → `code` span of `slice(i+1, j)`, jump to
    `j + 1`. Found at `j === i + 1` (empty) → the backtick is literal, advance **one** character.
    Not found → the backtick is literal **and a `codePossible` latch goes false** so no further
    forward scan for a backtick happens on this line.
  - `**` → `indexOf("**", i + 2)`. Found at `j > i + 2` → `bold` span of `slice(i+2, j)`, jump to
    `j + 2`. Empty or not found → the `*` is literal, advance **one** character, and on
    not-found set the `boldPossible` latch false.
  - anything else → append to the buffer, advance one.
- **The two latches are what make the scanner linear** on adversarial input: after one failed
  forward search per marker kind per line, no further full-line scans happen. A 32 KiB line of
  `**` therefore costs two scans, not sixteen thousand.
- **Advance-by-one-on-failure is what makes it total**: progress is guaranteed and no character is
  ever dropped.
- **Inline code wins over bold** by construction: whichever marker is met first while scanning left
  to right consumes its span, and a code span's contents are never re-parsed.
- **No inline parsing inside `**bold**`** (P-C3): the `Inline` union stays flat, so
  `` **run `x`** `` renders bold with visible backticks — wrong-looking, but nothing is lost and the
  model has no recursion.

**1.4 The truncation policy** — `long-content.ts`:

```ts
/** D-D Option A. Tied to `.item-content.collapsed`'s 176px cap in screens.css — change both or
 *  neither: the clamp and the toggle must be governed by the same predicate. */
export const LONG_CONTENT_CHARS = 420;
export const LONG_CONTENT_NEWLINES = 6;

export function isLongContent(content: string): boolean { … }
```

Newline count via a single pass (`content.split("\n").length - 1`), no regex.

**1.5 Tests** (Node environment, no jsdom — the default for `*.test.ts`):

`light-markdown.test.ts`, grouped by D-A's rule table:
- headings `#`/`##`/`###` → one `heading` block, `#` characters absent; `####` → literal paragraph.
- `**Síntoma:**` → one `bold` span, no asterisks. Unmatched `**` → literal. `****` → literal.
  `2**32**5` → the documented text/bold/text split (asserted, so the behaviour is a decision, not an
  accident).
- ordered list of `1.`/`2.` → one block, `start === 1`, two items; a list starting at `2.` keeps
  `start === 2`; a 13-digit "number" is a paragraph.
- `- ` and `* ` runs → one `unordered-list`; a mixed run is still one list; indented items flatten.
- `` `x` `` → `code` span; `` `**a**` `` → `code` span containing literal asterisks (code wins).
- fence: contents literal (a `**b**` inside stays literal text), info string ignored, unterminated
  fence swallows the remainder.
- **preservation:** `_snake_case_`, `VALIJA_STATE_HOME`, `[text](example)`, `> quote`,
  `| a | b |`, `#### h4` all come back as literal characters, with no `bold`/`code` span invented.
- **round-trip:** a `flatten(blocks): string` test helper concatenates every span's text and every
  code block's text; for a corpus of *marker-free* inputs `flatten(parse(s)) === s` exactly, and for
  each marker-bearing fixture the expected flattened string is written out by hand.
- **totality:** `""`, `"\n\n\n"`, a lone `` ` ``, a lone `*`, `"```"` alone — none throws, none
  loses a character.
- **CRLF:** `"a\r\nb"` parses identically to `"a\nb"`.
- **availability (§9):** a 32 KiB pathological string (`"**".repeat(…)` + backticks + `1. ` lines)
  parses in well under a frame — assert elapsed `< 250 ms` (a deliberately loose CI-safe bound on an
  operation that should take single-digit milliseconds) and that the result is non-empty.

`long-content.test.ts`: 419/420/421 characters around the `>` boundary; 5 vs 6 newlines around the
`>=` boundary; a short string with many newlines is long; the empty string is not.

**Done when:** `cd desktop && npm run typecheck && npm run lint && npm run test` is green; no file
outside `desktop/src/renderer/content/` changed; `light-markdown.ts` contains no `import` of React,
no DOM identifier, and no `http`/`fetch(`/`setInterval` string.

---

### Slice 2 — Renderer adapters, catalog keys, screen composition, and the DOM test

**Rationale.** The three deliverables here are one behaviour (a card that renders parsed content and
can expand), and the DOM test is the only machine check for the XSS property, the toggle and the
pinned/tag markup. They ship together so the reviewer sees the claim and its proof in one diff.

**Files**

| File | Nature |
|---|---|
| `desktop/src/renderer/components/markdown-content.tsx` | new, ~62 lines |
| `desktop/src/renderer/components/item-card.tsx` | new, ~92 lines |
| `desktop/src/shared/i18n/catalogs/en.ts` | +2 lines |
| `desktop/src/shared/i18n/catalogs/es.ts` | +2 lines |
| `desktop/src/renderer/screens/project.tsx` | ~14 lines changed |
| `desktop/src/renderer/screens/__dom-tests__/project.dom.test.tsx` | new, ~200 lines |

**2.1 `markdown-content.tsx` — the Block→element adapter.**

```tsx
export function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseLightMarkdown(content), [content]);
  return <div className="md-content">{blocks.map(/* keyed Fragment */)}</div>;
}

function renderBlock(block: Block): ReactElement { /* switch over 5 kinds, no default */ }
function renderSpan(span: Inline): ReactElement | string { /* switch over 3 kinds, no default */ }
```

- **`useMemo` is not an optimisation flourish**: without it, every toggle click re-parses up to
  32 KiB, and §7.9 makes parse cost a stated concern.
- **Exhaustiveness by typecheck, not by a default branch** (§8): both helpers carry an explicit
  return type that excludes `undefined`, so a sixth `Block` kind added later fails compilation with
  "lacks ending return statement" instead of silently rendering nothing.
- **The emitted element set is exactly §7.2's list and nothing else:**
  `paragraph → <p className="md-p">`, `heading → <p className="md-heading">` (D-C Option 2 — never
  `<h1>`/`<h2>`/`<h3>`), `ordered-list → <ol className="md-list" start={block.start}>`,
  `unordered-list → <ul className="md-list">`, items → `<li>`, `code → <pre className="md-pre"><code>`,
  and inline `bold → <strong>`, `code → <code className="md-code">`, `text → the raw string`.
  **No `href`, `src`, `style` or `on*` attribute anywhere; `start` is the only user-derived
  attribute value and it came from `\d{1,9}`.**
- Keys: each mapped child is wrapped in `<Fragment key={index}>` (P-C5). A `Fragment` emits no DOM
  node, so the closed element set is unaffected and the flex layout still sees the block elements as
  direct children of `.md-content`. **Add a `// biome-ignore lint/suspicious/noArrayIndexKey: …`
  comment only if lint actually reports it** — Biome flags *unused* suppressions, so write the code
  first, run `npm run lint`, then add exactly the suppressions it asks for, each with the reason
  "blocks are a pure function of `content` and are never reordered; the array is rebuilt whole
  whenever content changes".
- Forbidden in this file, permanently: `dangerouslySetInnerHTML`, `innerHTML`, `DOMParser`, `eval`,
  `new Function`, and any `<a>`/`<img>`/`<iframe>`/`<style>`.

**2.2 `item-card.tsx` — the card.**

Props are explicit, not a shared row type: `{ type, content, tags, pinned, createdAt }` (all
primitives + `string[]`). Structure, top to bottom:

```tsx
<li className={pinned ? "item-row pinned" : "item-row"}>
  <div className="item-header">
    <span className="item-meta">
      {pinned && <><PinnedStar /><span className="item-pinned">{t("project.pinned")}</span>
                   <span className="item-sep">·</span></>}
      <span className="item-type">{type}</span>
    </span>
    <span className="item-date">{formatDate(new Date(createdAt), language)}</span>
  </div>

  <div className={collapsed ? "item-content collapsed" : "item-content"}>
    <MarkdownContent content={content} />
    {collapsed && <div className="item-fade" />}
  </div>

  {collapsible && (
    <button type="button" className="item-toggle" aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}>
      {expanded ? t("project.showLess") : t("project.showMore")}
    </button>
  )}

  {tags.length > 0 && (
    <div className="item-tags">
      {tags.map((tag) => <span key={tag} className="item-tag">{tag}</span>)}
    </div>
  )}
</li>
```

- `const collapsible = isLongContent(content); const collapsed = collapsible && !expanded;`
  **This single pair of consts is D-D's invariant made structural** — the clamp class and the toggle
  are both derived from `collapsible`, so a card can never be clipped without a control to open it.
- `expanded` is `useState(false)` and nothing else: never a preferences write, never IPC, never a
  timer (§7.5, §7.7).
- `PinnedStar` is a tiny non-exported component in the same file holding the inline
  `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">` with a single
  `fill="currentColor"` path — the `connect-tools.tsx` chevron house style. A serviceable path:
  `M6 .8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z` (tune if it looks off; it
  must stay a single `<path>` with no `fill` other than `currentColor`).
- `ItemCard` renders the `<li>` itself (P-C10), so `project.tsx`'s `<ul>` contains only
  `<ItemCard/>` elements and `search.tsx` can adopt it unchanged in the deferred follow-up.
- Toggle sits **under the content, above the tag pills** (P-C4 — §5 explicitly left the call here).

**2.3 Catalog keys** (D-H, both files in this same commit):

```ts
// en.ts, project:
showMore: "Show more",
showLess: "Show less",
// es.ts, project:
showMore: "Ver más",
showLess: "Ver menos",
```

No placeholders, so `catalogs.test.ts`' placeholder parity is trivially satisfied; the `Catalog`
annotation on `es` makes a missing key a typecheck failure.

**2.4 `project.tsx`** — the only change is inside the `<ul>`:

```tsx
<ul className="item-list">
  {items.map((item) => (
    <ItemCard key={item.id} type={item.type} content={item.content} tags={item.tags}
              pinned={item.pinned} createdAt={item.createdAt} />
  ))}
</ul>
```

Add the `ItemCard` import; **delete the now-unused `formatDate` and `useLanguage` imports and the
`language` const** (Biome's `correctness/noUnusedImports` will fail the build otherwise). The
`useEffect`, `wireFocusRefresh`, `handleTypeChange`, filter `<select>`, pack button, error paragraph
and empty state are untouched, character for character.

**2.5 `project.dom.test.tsx`** — `// @vitest-environment jsdom`, `@testing-library/react`, a
`fakeBridge` in the shape `relocate-vault.dom.test.tsx` uses (`content.show` →
`{ ok: true, value: items }`, everything else `vi.fn()`, one `as any as ValijaBridge` with the same
`biome-ignore lint/suspicious/noExplicitAny` note the existing suites carry). Cases:

1. **cards** — one `li.item-row` per item inside `ul.item-list`; three items → three cards.
2. **pinned** — the pinned item's `<li>` carries `pinned`, contains an `svg[aria-hidden="true"]` and
   the word `Pinned`; the unpinned item has neither, and no `.item-row.pinned`.
3. **type label untranslated** — the pinned `decision` card's `.item-type` has `textContent`
   exactly `decision` (uppercase is `text-transform`, which jsdom does not apply — this is the right
   assertion, not a bug).
4. **tags** — a 5-tag item renders 5 `.item-tag` elements (not one comma-joined string); a 0-tag
   item renders no `.item-tags`.
5. **Markdown** — an item whose content is `"## Diagnóstico\n\n**Síntoma:** el `mcp` no
   responde\n\n1. uno\n2. dos"` produces: a `.md-heading` whose text has no `#`; a `<strong>` reading
   `Síntoma:`; a `<code>`; one `<ol>` with two `<li>`; **zero** `h1/h2/h3` inside `.item-content`;
   and the card's `textContent` contains neither `##` nor `**`.
6. **XSS (executable)** — an item whose content is `<img src=x onerror=alert(1)>` renders
   `document.querySelectorAll("img").length === 0`, `…("a").length === 0`, and the literal string
   is visible text. **No URL anywhere in this file** (F1).
7. **toggle** — a long item shows a button with `aria-expanded="false"` labelled `Show more` and its
   `.item-content` carries `collapsed`; click → `aria-expanded="true"`, label `Show less`, no
   `collapsed` class, no `.item-fade`; click again → back.
8. **isolation** — with two long items, expanding the first leaves the second's `aria-expanded` at
   `"false"`.
9. **invariant** — a short item renders **no** toggle and **no** `collapsed` class.
10. **reset on reload** — expand, `fireEvent.focus(window)`, `waitFor` → the toggle reads
    `Show more` again (F4/F5).
11. **i18n** — the same render with `language: "es"` preferences shows `Ver más` and `Fijado` while
    `.item-type` still reads `decision` and the content string is byte-identical.

**Done when:** `cd desktop && npm run typecheck && npm run lint && npm run test` green; the new DOM
suite passes; `no-network-surface.test.ts` still passes **with the new `.tsx` files in the scan**;
`git diff --stat` shows nothing under `src/`, `desktop/src/main/`, `desktop/src/preload/`, or either
`package.json`.

---

### Slice 3 — `screens.css`: the `/* project.tsx */` section (and `docs/gui.md`)

**Rationale.** Style changes no behaviour and no test, so it lands last among the code slices and
can be reviewed purely visually. The documentation paragraph ships in this same commit, satisfying
`CLAUDE.md`'s "docs ship in the same commit as the code" for the advance's final code change.

**Files:** `desktop/src/renderer/styles/screens.css` (+~135 lines, appended as a new section — the
existing sections are not reordered or touched), `docs/gui.md` (+~8 lines).

Values are §5's, with D-G applied: **font sizes converted to rem** (`12px → 0.75rem`,
`12.5px → 0.78rem`, `11.5px → 0.72rem`, inline code stays `0.9em` because it is deliberately
relative), **structural values stay px** (borders, radii, padding, gaps, `176px`, `48px`, `20px`,
`100px`). Only existing tokens; `tokens.css` is not opened.

Section skeleton (declaration order follows the file's existing idiom — layout, then box, then
colour, then type):

```css
/* project.tsx — the item list as cards (CARDS). The .md-* rules belong to
   components/markdown-content.tsx, whose only consumer today is this screen's card;
   they live here until a second screen renders it. Existing tokens only. */
.item-list      { list-style: none; padding: 0; margin: 16px 0 0;
                  display: flex; flex-direction: column; gap: 10px; }
.item-row       { display: flex; flex-direction: column; gap: 10px;
                  border: 1px solid var(--color-border); border-radius: 6px; padding: 14px 16px; }
.item-row.pinned{ border-color: var(--color-accent); }
.item-header    { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.item-meta      { display: flex; align-items: center; gap: 6px; }
.item-type      { text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
                  font-size: 0.75rem; color: var(--color-text-muted); }
.item-pinned    { font-size: 0.75rem; font-weight: 600; }
.item-row.pinned .item-meta,
.item-row.pinned .item-type { color: var(--color-accent); }
.item-sep       { color: var(--color-text-muted); }
.item-date      { flex-shrink: 0; font-size: 0.78rem; color: var(--color-text-muted); }
.item-content   { position: relative; overflow-wrap: anywhere;
                  line-height: 1.5; color: var(--color-text); }
.item-content.collapsed { max-height: 176px; overflow: hidden; }
.item-fade      { position: absolute; right: 0; bottom: 0; left: 0; height: 48px;
                  background: linear-gradient(to bottom, transparent, var(--color-bg));
                  pointer-events: none; }
.item-toggle    { align-self: flex-start; padding: 0; border: none; border-radius: 0;
                  background: none; color: var(--color-accent); font-size: 0.78rem;
                  cursor: pointer; }
.item-tags      { display: flex; flex-wrap: wrap; gap: 6px; }
.item-tag       { border: 1px solid var(--color-border); border-radius: 100px;
                  background: var(--color-surface); padding: 3px 10px;
                  font-size: 0.72rem; color: var(--color-text-muted); }

.md-content     { display: flex; flex-direction: column; gap: 8px; }
.md-p, .md-heading { margin: 0; white-space: pre-line; }
.md-heading     { font-weight: 600; }
.md-list        { margin: 0; padding-left: 20px; }
.md-list li + li{ margin-top: 4px; }
.md-code        { border-radius: 4px; background: var(--color-surface); padding: 1px 4px;
                  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
                  font-size: 0.9em; }
.md-pre         { margin: 0; border-radius: 4px; background: var(--color-surface);
                  padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere;
                  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
                  font-size: 0.85rem; }
```

(Written one declaration per line in the file, as the rest of `screens.css` is.)

Four non-obvious points, each a bug avoided:

- **`.md-list` must not be a flex container.** Flex blockifies its items, which removes the `::marker`
  — the numbers and bullets would vanish. Hence `li + li { margin-top: 4px }` for the 4px item gap
  while `.md-content` keeps flex+gap for the 8px block gap.
- **`white-space: pre-line` on `.md-p`/`.md-heading` is what renders D-B's preserved newlines**,
  because `<br>` is outside §7.2's element set (P-C2). It collapses runs of spaces, which is the
  desired paragraph behaviour; `.md-pre` uses `pre-wrap` so code keeps its indentation.
- **The fade is a gradient, never `url(...)`** (§7.4 / the no-network test), and it is only in the
  DOM while `collapsed`.
- **`.item-toggle` must override base.css's heavy `button`** (`padding: 8px 16px`, border, surface
  background, radius) — the same override `.connect-tools .disclosure-header` already performs.

`docs/gui.md`, appended to §"Browsing, searching, and taking a pack" (one paragraph, after the
existing one), saying: each item is shown as a card with a type/date header, tags as pills and its
content rendered as light Markdown (headings, bold, lists, inline and fenced code); anything outside
that small set is shown exactly as it was typed; long items collapse behind a **Show more** control;
and **this is display only — the context pack, Copy, Export… and what an AI tool receives are
unchanged and still verbatim.** No URLs, no promise of link support.

**Done when:** both workspaces' full loops are green (§4.3); a manual look at the project screen in
light **and** dark themes shows: bordered cards 10px apart, no bullets on the card list, real
bullets/numbers *inside* card content, an accent border on a pinned card, pills, a fade that ends in
the page background (no grey band in dark mode), and a long unbroken token that wraps instead of
widening the card.

---

### Slice 4 — Final gate

**Rationale.** `refined.md` §9 is a reviewer checklist, and three of its criteria (no `src/` diff,
export unaffected, `main-window.ts` untouched) are properties of the *whole* diff, not of any one
slice. No file changes here.

1. Full loop, both workspaces (§4.3), plus the targeted `no-network-surface.test.ts` run.
2. `git diff --stat main...HEAD -- src/ desktop/src/main desktop/src/preload package.json
   desktop/package.json` must be **empty**.
3. `git diff --stat` must show `search.tsx`, `pack-preview.tsx`, `dashboard.tsx`, `tokens.css`,
   `base.css` and `main-window.ts` as untouched.
4. Grep the new files for the forbidden shapes: `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
   `new Function`, `DOMParser`, `<a `, `<img`, `setInterval`, `console.`, `preferences.write`.
5. Walk §9 item by item, ticking each against a test name, a file:line, or an explicit
   "verified by eye" (§4.2 says exactly which are which).
6. Hand off to `change-reviewer`.

---

## 3. Security-sensitive order of operations

No key is derived, no database is opened, no keychain entry is touched, no IPC channel is added.
The security question here is narrower and entirely about **one untrusted string reaching a
rendering path**. The order that keeps that path closed:

1. **Parser before adapter, adapter before screen.** Slice 1 proves — in the Node environment,
   with no DOM in the picture — that the parser is total, loses no characters, and emits only the
   five block kinds. Only then does Slice 2 give it a rendering surface. Never write the component
   first and "add the parser tests after".
2. **The element set is a closed allowlist decided up front, not an emergent property.**
   `renderBlock`/`renderSpan` are the only two functions in the codebase allowed to turn user text
   into elements, and both are `switch` statements over a five/three-arm union. Adding an arm is a
   deliberate act with a compile error behind it. `<a>`, `<img>`, `<iframe>`, `<style>` and any
   attribute derived from user text (`href`, `src`, `srcset`, `style`, `on*`) are never written —
   the sole user-derived attribute value in the whole advance is `<ol start>`, bounded to nine
   digits by the regex *before* it reaches `Number.parseInt`.
3. **No HTML-string path is ever introduced, not even transiently.** React text nodes escape by
   construction; the moment a string of markup exists, that property is gone. Biome's
   `noDangerouslySetInnerHtml` catches the obvious case; `innerHTML`, `insertAdjacentHTML`,
   `document.write`, `DOMParser`, `eval` and `new Function` are on the Slice 4 grep list because
   lint does not.
4. **Run `no-network-surface.test.ts` at the end of every slice that adds a `.ts`, `.tsx` or `.css`
   file — including the test slice.** F1: `*.test.tsx` is scanned. A URL in a fixture, a `fetch(` in
   a comment that isn't `//`-prefixed, or a CSS `url(...)` fade fails the suite.
5. **Expansion state never leaves memory.** `useState` in `ItemCard`, nothing else. No
   `bridge.preferences.write`, no IPC, no `localStorage`. Persisting which items are expanded would
   write item ids — vault metadata — into a plaintext preferences file outside the vault (§7.7).
6. **Nothing logs `content`.** No `console.*` in the new files, and no error path that could carry a
   fragment of content into a message — the parser has no error path at all, which is the point.
7. **No timers.** The toggle is a synchronous state update; any transition is CSS. `setInterval` is
   a forbidden string in this tree.
8. **Availability is part of security here.** The two `indexOf` latches (§2, 1.3) are the mechanism
   that keeps a 32 KiB adversarial string linear; the perf test is what stops that mechanism from
   being quietly removed later.
9. **Truncation is cosmetic and nothing in the UI may suggest otherwise** (§7.8). Collapsed text
   stays in the DOM and stays available to assistive tech; the toggle's copy is "Show more", not
   anything implying concealment.

---

## 4. Test plan

### 4.1 By layer

| Layer | Where | Environment | What it proves |
|---|---|---|---|
| Pure core — grammar | `renderer/content/light-markdown.test.ts` | node | D-A's rule table, degrade-to-literal, no character loss, totality, linear time on 32 KiB |
| Pure core — policy | `renderer/content/long-content.test.ts` | node | D-D's thresholds at their exact boundaries |
| Component + screen | `renderer/screens/__dom-tests__/project.dom.test.tsx` | jsdom | card markup, pinned styling, pill count, rendered Markdown, **the XSS property**, toggle behaviour + `aria-expanded`, per-card isolation, reset-on-reload, bilingual labels |
| Repo-wide invariants | `main/infra/no-network-surface.test.ts` (existing) | node | no URL/timer/fetch string in any new `.ts`/`.tsx`/`.css`, gradient-not-`url()` fade |
| i18n parity | `shared/i18n/catalogs/catalogs.test.ts` (existing) | node | both new keys exist in both catalogs with matching placeholders |
| Typecheck | `desktop`'s two `tsc` projects | — | exhaustiveness of both `switch`es; `Catalog` shape for `es.ts` |

No snapshot tests (D-J Option 3, rejected). No new test infrastructure, no new dependency.

### 4.2 §9 acceptance criteria → where each one is checked

| §9 criterion | Checked by |
|---|---|
| One bordered card per item, 10px stack, no bullets/`<ul>` padding | DOM case 1 (markup) + Slice 3 visual (CSS) |
| Border/radius/padding match §5, tokens unchanged | Slice 3 review; `git diff tokens.css` empty (Slice 4 step 3) |
| Header: type left, `formatDate` date right, visibly separated | DOM case 1/3 + Slice 3 visual |
| Type label is the raw domain value, untranslated, both languages | DOM cases 3 and 11 |
| Date is absolute (`dateStyle: "medium"`) | `formatDate` reused unchanged; DOM case 1 |
| Pinned: accent border, `aria-hidden` star, pinned word, muted `·`, accent type | DOM case 2 + Slice 3 visual (colour) |
| Unpinned: no star, no word, default border | DOM case 2 |
| Each tag its own pill; 5 tags → 5 elements; no tags → no row | DOM case 4 |
| Plain content stays plain; no structure invented | parser tests (preservation group) + DOM case 5 |
| `## …` → bold lead-in, no `#`, no `h1/h2/h3` | parser heading tests + DOM case 5 |
| `**Síntoma:**` → `<strong>`, no asterisks | parser bold tests + DOM case 5 |
| `1. `/`2. ` → one `<ol>`; non-1 start preserved | parser ordered-list tests |
| `- `/`* ` → `<ul>`; `` `x` `` → `<code>`; fence → `<pre><code>` unparsed | parser tests |
| Unsupported syntax verbatim, no `<a>`/`<em>`, nothing dropped | parser preservation tests + DOM case 6 (`a` count 0) |
| Round-trip: visible text reproduces the source minus consumed markers | parser round-trip test |
| `<img src=x onerror=…>` → zero `img` elements, string visible | **DOM case 6** |
| Long unbroken token doesn't widen the card | `overflow-wrap: anywhere`; **verified by eye** (jsdom has no layout) |
| Long item collapsed at max-height + fade + toggle with `aria-expanded` and translated label | DOM case 7 (markup/behaviour) + Slice 3 visual (the 176px/48px values) |
| Toggle expands in place, label switches, collapses again | DOM case 7 |
| **Invariant:** never clipped without a toggle | DOM case 9 + the single `collapsible` const in `item-card.tsx` |
| Expanding one card doesn't affect another; reload resets; nothing persisted | DOM cases 8 and 10 + Slice 4 grep for `preferences.write` |
| Both catalogs gain the keys; `catalogs.test.ts` + `Catalog` pass | existing catalogs suite + `npm run typecheck` |
| Language switch changes only toggle label and pinned word | DOM case 11 |
| No `src/`, no main, no preload, no dependency change | Slice 4 step 2 |
| `search.tsx`/`pack-preview.tsx`/`dashboard.tsx` untouched | Slice 4 step 3 |
| Pack preview verbatim; export byte-identical | untouched by construction (no file in that path is opened); Slice 4 step 3 |
| New CSS in a single commented `/* project.tsx */` section | Slice 3 review |
| `docs/gui.md` paragraph in the same commit, states pack/export unaffected | Slice 3 |
| No `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function`/`DOMParser` | Biome + Slice 4 step 4 |
| No `<a>`/`<img>`/`<iframe>`/`style` attr from user content; only `<ol start>` | code review of the two `switch`es + DOM case 6 |
| `no-network-surface.test.ts` passes, fade is a gradient | that suite, run in every slice |
| `main-window.ts` CSP/navigation unchanged | Slice 4 step 3 |
| 32 KiB pathological string parses well under a frame | parser availability test |
| Full loop green at root and in `desktop/` | §4.3 |

Three criteria are honestly **not machine-checkable** and are marked as review items rather than
pretended into a test: the pixel values in §5, the "no horizontal scrolling on a long token"
behaviour, and the fade's appearance in dark mode. jsdom reports zero for every layout measurement
(§3 fact 12), which is exactly why D-D chose a string predicate over `scrollHeight`.

### 4.3 The verification loop (exact commands)

This repo has **two** workspaces with **different** script sets — both were read, nothing is
assumed:

```bash
# repo root — package.json scripts: build | test | lint | format | typecheck
cd /home/user/valija
npm run typecheck      # tsc --noEmit, include: src/**/*.ts  → does NOT cover desktop/
npm run lint           # biome check .  → DOES cover desktop/** (biome.json includes "**")
npm run test           # vitest run, include: src/**/*.test.ts → does NOT run desktop tests

# desktop workspace — package.json scripts: dev | build | package | typecheck | test | test:watch | lint
cd /home/user/valija/desktop
npm run typecheck      # tsc -p tsconfig.json --noEmit && tsc -p tsconfig.web.json --noEmit
npm run lint           # biome check .
npm run test           # vitest run, include: src/**/*.test.ts + src/**/*.test.tsx

# the hard, machine-checked §7 constraint, run explicitly at the end of every slice
cd /home/user/valija/desktop
npx vitest run src/main/infra/no-network-surface.test.ts
```

Notes the implementer needs: the **renderer** is typechecked by `tsconfig.web.json` (which includes
`src/renderer/**/*.tsx`, so the new DOM test is typechecked too) — `tsconfig.json` alone would not
see any of these files. Root `npm run test` never runs a desktop test; running only the root loop
proves nothing about this advance.

---

## 5. Assumptions — each one a place this plan could be wrong

1. **Biome's `suspicious/noArrayIndexKey` is in `recommended`.** Not verified by running lint. If it
   is *not* enabled, the planned `biome-ignore` comments become *unused suppressions*, which Biome
   itself reports — hence the instruction in Slice 2.1 to write the code first and add only the
   suppressions lint asks for. Either way, `useJsxKeyInIterable` requires *some* key.
2. **`complexity/noUselessFragments` does not flag `<Fragment key={…}>`** (a keyed fragment is the
   documented exception). If it does, the fallback is a `<span>` wrapper — `span` is in §7.2's set —
   at the cost of one DOM node per span.
3. **Chromium interpolates `transparent → var(--color-bg)` in premultiplied space**, so the fade
   shows no grey band in dark mode. If it does show one on the target Electron version, the fix is
   `color-mix(in srgb, var(--color-bg) 0%, transparent)` as the first stop — still no `url()`, still
   token-only. Flagged as a look-at-it-in-dark-mode item in Slice 3.
4. **`setItems(null)` guarantees the card subtree unmounts on every reload** (F4), so expansion
   resets without any explicit reset code. DOM case 10 is what would catch this being wrong.
5. **`items` come from `ShowProject` with de-duplicated tags** (F3), so `key={tag}` is safe. A
   hand-crafted duplicate in the DOM test's fixtures would produce a React warning — don't write one.
6. **The 420-char / 6-newline / 176px numbers are as approved in D-D** and are not re-derived here.
   They are three constants in two files (plus a cross-reference comment in each) precisely so a
   Gate-P or review-time change is a two-line edit.
7. **`formatDate(new Date(createdAt), language)` keeps behaving exactly as today** — the call moves
   from `project.tsx` to `item-card.tsx` unchanged, same arguments, same import.
8. **jsdom renders `aria-expanded={boolean}` as the string `"true"`/`"false"`** — React's standard
   behaviour for ARIA attributes, relied on by DOM case 7.
9. **No existing test asserts the current `project.tsx` markup.** Searched: the `.item-*` classes
   appear only in `project.tsx` and in `refined.md`. If a test elsewhere queries `.item-content` as
   a `<p>`, it will break in Slice 2 and must be updated in the same slice, not deleted.
10. **The advance's diff is reviewed as a whole on `feat/desktop-GUI`,** whose baseline for
    "untouched files" is `fcd3060`, not `main`. If Slice 4's `git diff --stat main...HEAD` shows
    GUI-advance files, compare against `fcd3060` instead — the criterion is about *this* advance's
    changes.

---

## 6. Decisions to confirm

Everything `refined.md` decided is implemented as decided. These are the calls the spec left open
or did not reach, each with a recommended default already baked into the slices above.

**P-C1 — The "is this long" predicate lives in its own file.**
*Recommended:* `renderer/content/long-content.ts` (≈20 lines), separate from `light-markdown.ts`.
*Why:* §8 calls it "a policy, not a component concern"; a file named after a grammar shouldn't also
own a truncation threshold, and its two constants are the ones most likely to be tuned at review.
*Trade-off:* a fourth new file for twenty lines. The alternative (both in `light-markdown.ts`) is
one import fewer and one cohesion violation more.

**P-C2 — Paragraph line breaks come from CSS, not `<br>`.**
*Recommended:* preserve `\n` inside the span text and render with `white-space: pre-line`.
*Why:* §7.2's emitted element set is closed and does not contain `br`; widening it for a cosmetic
newline is exactly the kind of drift the closed list exists to prevent.
*Trade-off:* `pre-line` also collapses runs of spaces inside paragraphs (invisible in prose,
noticeable if someone hand-aligned text with spaces outside a code fence). `<br>` would preserve
them but would mean amending §7.2.

**P-C3 — No inline parsing inside `**bold**`.**
*Recommended:* `Inline` stays flat (`{kind, text}`); bold content is literal.
*Why:* no recursion in a parser over untrusted input; the union stays three arms; nothing is lost.
*Trade-off:* `` **run `x`** `` shows the backticks. Nesting would render it prettily at the cost of
a recursive model and a harder exhaustiveness story.

**P-C4 — The toggle sits under the content, above the tag pills.**
*Recommended:* content → toggle → tags. §5 explicitly left this to the planner.
*Why:* the control belongs to the thing it controls; the pills read as a card footer.
*Trade-off:* with a long, tag-heavy card the accent link sits mid-card rather than at the very
bottom. Below-the-pills is a one-line move if Oscar prefers it.

**P-C5 — React keys are array indices with a targeted `biome-ignore`.**
*Recommended:* `<Fragment key={index}>`, one suppression per map site (three at most), each with the
reason "blocks are a pure function of `content` and are never reordered".
*Why:* the alternative — the parser recording source offsets purely so React has a stable key —
pushes a rendering concern into the pure core the whole design keeps clean.
*Trade-off:* three suppression comments in a small file. If Oscar dislikes suppressions, the fallback
is `at: number` (source offset) on `Block` and on `Inline`, ~10 extra lines of bookkeeping.

**P-C6 — The `.md-*` rules are unscoped and live in the `/* project.tsx */` section.**
*Recommended:* plain `.md-p`, `.md-heading`, `.md-list`, `.md-code`, `.md-pre` selectors, with a
comment naming `markdown-content.tsx` as their owner.
*Why:* the component owns its own look, so the deferred `search.tsx` pass can render it with no CSS
change; §4 requires all new CSS in one section, and this respects both.
*Trade-off:* five class names briefly global in a per-screen file. Scoping them under
`.item-content` would keep the file's per-screen fiction intact but would silently un-style the
component the day a second screen uses it.

**P-C7 — Fenced-code block styling (a §5 gap, W3).**
*Recommended:* mirror the existing `.connect-tools … pre`: surface background, 4px radius,
`10px 12px` padding, `white-space: pre-wrap`, the repo's monospace stack at `0.85rem`.
*Trade-off:* invented values, not canvas-approved. They are one rule, easy to re-tune at review.

**P-C8 — The DOM test drives `ProjectScreen`, not `ItemCard` directly.**
*Recommended:* fake `ValijaBridge` + `I18nProvider`, exactly like the two existing DOM suites.
*Why:* §9's criteria are worded about the screen (list, filter reload, language switch), and a
card-only test could not check reset-on-reload at all.
*Trade-off:* ~50 lines of `fakeBridge` boilerplate, and each case pays one `findBy*` await.

**P-C9 — A list may interrupt a paragraph with no blank line between.**
*Recommended:* yes — a `1. ` line ends the paragraph and starts the list.
*Why:* §2.1 row 3's own example (a "Síntoma:" paragraph followed by items 1 and 2) is how LLMs
actually write, and requiring a blank line would render those items as literal `1.` text.
*Trade-off:* a paragraph that legitimately begins a line with `- ` or `1. ` becomes a list. That is
Markdown's own ambiguity and the failure is visible, not lossy.

**P-C10 — `ItemCard` renders its own `<li>`.**
*Recommended:* yes; `project.tsx`'s `<ul>` contains only `<ItemCard/>`.
*Why:* the whole card, including the `pinned` modifier on the row, stays in one file.
*Trade-off:* the component assumes list context. `search.tsx` (deferred) renders a list too, so the
assumption holds there as well.

---

## 7. Naming, placement, and ubiquitous language

Checked against `CLAUDE.md`'s conventions and against how the renderer is actually organised today.

**Placement.** `CLAUDE.md`'s "no bare files at a layer's root" rule is written for `src/` modules
(`domain/application/infra` + kind-folders). The renderer is not a DDD module; its top-level folders
already name kinds of renderer concern — `components/` (React elements), `screens/` (routed views),
`state/` (pure view logic + context), `styles/`, `testing/`. Every new file lands in one of those or
in `content/`:

- `renderer/content/` — new folder, D-E Option 1 as approved. It holds pure, React-free
  transformations of a `ContextItem`'s **`content`** — the domain's own word for the field being
  rendered, which is why the folder is named for it. It is the sibling of `state/` (pure state
  logic) rather than a bare file next to `components/`; `state/diagnostic-rows.ts` is the standing
  precedent for pure view logic living outside the component that uses it. Not `shared/`, which is
  the main↔renderer boundary and would imply the main process might parse Markdown (it must not).
- `components/markdown-content.tsx`, `components/item-card.tsx` — kebab-case files exporting
  PascalCase components, matching `components/nav-bar.tsx` → `NavBar`.
- `screens/__dom-tests__/project.dom.test.tsx` — the exact existing convention
  (`recovery-kit.dom.test.tsx`, `relocate-vault.dom.test.tsx`).
- Unit tests sit beside their subject (`light-markdown.test.ts` next to `light-markdown.ts`), as
  every other pure module in `renderer/state/` does.

**Names, and one deliberate deviation.**

| Name | Verdict |
|---|---|
| `parseLightMarkdown(content): Block[]` | **Deviates from `parseX → Result` on purpose, and this should be visible to the reviewer.** The repo's `parseX` convention is parse-don't-validate for *domain values*, where rejection is meaningful. This function is **total**: §8 requires it never to throw and never to drop input, so there is no failure to model and a `Result` would be a permanently-`ok` wrapper. The file's doc comment must say this in one sentence. (Alternatives considered and rejected: `toBlocks` — loses the "this is a parser" signal; `readLightMarkdown` — collides with the repo's I/O-flavoured `readX`.) |
| `isLongContent(content): boolean` | Fits: a predicate named for what it answers, not for what the caller does with it. The card decides to collapse; the policy only reports length. |
| `LONG_CONTENT_CHARS` / `LONG_CONTENT_NEWLINES` | Screaming-case module constants, as `MAX_CONTENT_BYTES`, `ITEM_TYPES`, `ALL_TYPES` already are. |
| `Block` / `Inline`, `kind` discriminant | `kind` matches `state/unlock-outcome.ts`. The five block kinds and three inline kinds are §8's own words, kept verbatim. |
| `MarkdownContent` / `ItemCard` / `PinnedStar` | Noun-phrase components; `ItemCard` is the ubiquitous term this advance's title uses. |
| CSS `.item-list` `.item-row` `.item-type` `.item-date` `.item-pinned` `.item-tags` `.item-content` | **Reused unchanged** — they already exist in the markup and in §3 fact 2. New siblings follow the same prefix: `.item-header`, `.item-meta`, `.item-sep`, `.item-tag`, `.item-fade`, `.item-toggle`. Modifiers are bare adjectives on the block (`.item-row.pinned`, `.item-content.collapsed`), exactly like `.check-row.warning` / `.check-row.fatal` and `.disclosure.open`. |
| `project.showMore` / `project.showLess` | D-H's default names, namespaced by screen like every other key. |

**Ubiquitous language.** `item`, `type`, `tags`, `pinned`, `content`, `project` are the domain's own
words and are used unchanged; the type label is rendered as the raw domain value and never
translated. `Block`/`Inline`/`heading`/`fence` are Markdown vocabulary and stay confined to
`content/` and `markdown-content.tsx` — they never leak into the card, the screen, or a catalog key.

---

## 8. Estimated line count and risks

### Production lines

| File | Lines |
|---|---|
| `desktop/src/renderer/content/light-markdown.ts` | ~170 |
| `desktop/src/renderer/content/long-content.ts` | ~20 |
| `desktop/src/renderer/components/markdown-content.tsx` | ~62 |
| `desktop/src/renderer/components/item-card.tsx` | ~92 |
| `desktop/src/renderer/screens/project.tsx` (changed) | ~14 |
| `desktop/src/renderer/styles/screens.css` (new section) | ~135 |
| `desktop/src/shared/i18n/catalogs/en.ts` + `es.ts` | 4 |
| **Total production** | **~497** |

| Non-production | Lines |
|---|---|
| `light-markdown.test.ts` | ~210 |
| `long-content.test.ts` | ~30 |
| `project.dom.test.tsx` | ~200 |
| `docs/gui.md` | ~8 |
| **Total** | **~448** |

### Risks

1. **The parser silently corrupts a user's saved text** (`refined.md` §11, unchanged and still the
   top risk). Mitigations are all in Slice 1 and all mandatory: advance-by-one on every failed
   marker so no character is ever dropped; the round-trip test; the preservation test covering
   `_snake_case_`, `VALIJA_STATE_HOME`, links, quotes, tables and `####`; and the exclusion of
   italics and links at the grammar level. If a bug is found post-ship, the fallback is one line —
   render the content as a single `paragraph` block — which is exactly today's behaviour.
2. **A lint rule this plan predicted wrong** (`noArrayIndexKey` enabled or not, `noUselessFragments`
   on keyed fragments). Cost is minutes, but it can look like plan drift in review; §5 assumptions 1
   and 2 name both and their fallbacks so the implementer doesn't improvise.
3. **The `no-network-surface` scan catching the new test file** (F1). Easy to trip by writing a
   realistic-looking `href="https://…"` XSS fixture. Named in Slice 2 and re-checked in Slice 4.
4. **The truncation heuristic mis-predicting.** Structurally bounded: clamp and toggle share one
   predicate, so the worst case is a toggle that reveals two lines — never hidden content.
5. **`white-space: pre-line` interacting badly with a block that expects collapsing** — e.g. a
   paragraph that the AI hard-wrapped at 80 columns will now show those hard wraps. This is D-B
   Option 2's accepted, spec-approved behaviour, not a defect, but it is the one visual change a
   reviewer might read as a bug; the docs paragraph and this line exist so nobody is surprised.
6. **Dark-mode fade banding** (assumption 3) — cosmetic, single-declaration fix, but only findable
   by looking at the running app in dark mode. Explicit in Slice 3's done-when.
7. **Branch confusion.** The one process risk: an agent later in the advance re-deriving
   `feat/cards-CARDS` from the generic convention. Stated at the top of this file, in the summary,
   and here.

---

## 9. Repo structure after execution

```
valija/
├── advances/
│   └── CARDS/
│       ├── refined.md                       (unchanged — Gate R approved)
│       ├── plan.md                          ← THIS FILE (new)
│       └── review.md                        (written later by change-reviewer)
├── docs/
│   └── gui.md                               ~ CHANGED: +1 paragraph in
│                                              "Browsing, searching, and taking a pack"
├── src/                                     UNCHANGED — every file, no exceptions
├── desktop/
│   ├── package.json                         UNCHANGED (no new dependency — D-F Option 1)
│   ├── tsconfig.json / tsconfig.web.json    UNCHANGED
│   ├── vitest.config.ts                     UNCHANGED
│   └── src/
│       ├── main/                            UNCHANGED (incl. windows/main-window.ts's CSP
│       │                                     and infra/no-network-surface.test.ts)
│       ├── preload/                         UNCHANGED
│       ├── shared/
│       │   ├── ipc/messages.ts              UNCHANGED
│       │   └── i18n/catalogs/
│       │       ├── en.ts                    ~ CHANGED: project.showMore / project.showLess
│       │       └── es.ts                    ~ CHANGED: project.showMore / project.showLess
│       └── renderer/
│           ├── app-main.tsx                 UNCHANGED (already imports screens.css)
│           ├── content/                     + NEW FOLDER — pure, React-free content logic
│           │   ├── light-markdown.ts        + NEW  parseLightMarkdown, Block, Inline
│           │   ├── light-markdown.test.ts   + NEW  grammar, preservation, round-trip, 32 KiB perf
│           │   ├── long-content.ts          + NEW  isLongContent + the two thresholds
│           │   └── long-content.test.ts     + NEW  boundary cases
│           ├── components/
│           │   ├── nav-bar.tsx              UNCHANGED
│           │   ├── markdown-content.tsx     + NEW  Block[] → closed React element set
│           │   └── item-card.tsx            + NEW  header · content · toggle · tag pills
│           ├── screens/
│           │   ├── project.tsx              ~ CHANGED: the <ul> body only (composes ItemCard);
│           │   │                              data fetching, filter, pack button untouched
│           │   ├── search.tsx               UNCHANGED (deferred on purpose — §4 Out)
│           │   ├── pack-preview.tsx         UNCHANGED (export shown verbatim)
│           │   ├── dashboard.tsx            UNCHANGED
│           │   └── __dom-tests__/
│           │       ├── recovery-kit.dom.test.tsx    UNCHANGED
│           │       ├── relocate-vault.dom.test.tsx  UNCHANGED
│           │       └── project.dom.test.tsx         + NEW  11 cases (§2, Slice 2.5)
│           ├── state/                       UNCHANGED (bridge, focus-refresh, i18n-context, …)
│           └── styles/
│               ├── tokens.css               UNCHANGED — no new custom property
│               ├── base.css                 UNCHANGED
│               └── screens.css              ~ CHANGED: one new /* project.tsx */ section
│                                              appended; no existing section touched
└── (everything else)                        UNCHANGED
```

**Net: 7 new files, 5 changed files (one of them documentation), 0 deletions, 0 dependency
changes, 0 files under `src/`.**
