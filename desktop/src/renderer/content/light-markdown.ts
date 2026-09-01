/**
 * A small, closed Markdown-ish grammar for rendering saved context items
 * (D-A, `advances/CARDS/refined.md`). Not CommonMark, not a library: five
 * block kinds and three inline kinds, each matched by a single anchored,
 * single-quantifier regex so a 32 KiB adversarial string still parses in
 * linear time (§7.9). Anything outside the grammar is emitted verbatim —
 * that is the safety property this module exists for, not a gap.
 *
 * `parseLightMarkdown` deliberately does not follow the repo's `parseX ->
 * Result` convention: that convention exists for domain values where
 * rejection is meaningful, and this function is total by design (never
 * throws, never drops a character), so a `Result` would be a permanently-
 * `ok` wrapper around it.
 */

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

const FENCE = /^[ \t]*```/;
const HEADING = /^#{1,3}[ \t]+(.*)$/;
const ORDERED_ITEM = /^[ \t]*(\d{1,9})\.[ \t]+(.*)$/;
const UNORDERED_ITEM = /^[ \t]*[-*][ \t]+(.*)$/;

export function parseLightMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }
    if (FENCE.test(line)) {
      i = readFence(lines, i, blocks);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      i = readHeading(heading, i, blocks);
      continue;
    }
    if (ORDERED_ITEM.test(line)) {
      i = readOrderedList(lines, i, blocks);
      continue;
    }
    if (UNORDERED_ITEM.test(line)) {
      i = readUnorderedList(lines, i, blocks);
      continue;
    }
    i = readParagraph(lines, i, blocks);
  }
  return blocks;
}

function readHeading(match: RegExpExecArray, start: number, blocks: Block[]): number {
  blocks.push({ kind: "heading", spans: parseInline(match[1] ?? "") });
  return start + 1;
}

function readFence(lines: string[], start: number, blocks: Block[]): number {
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !FENCE.test(lines[i] ?? "")) {
    body.push(lines[i] ?? "");
    i += 1;
  }
  blocks.push({ kind: "code", text: body.join("\n") });
  // Unterminated fence swallows the remainder (D-A); `i` is already at
  // `lines.length` in that case, so the outer loop ends naturally.
  return i + 1;
}

function readOrderedList(lines: string[], start: number, blocks: Block[]): number {
  const items: Inline[][] = [];
  let listStart = 1;
  let i = start;
  let first = true;
  for (;;) {
    const line = lines[i] ?? "";
    const match = ORDERED_ITEM.exec(line);
    if (match === null) break;
    if (first) {
      listStart = Number.parseInt(match[1] ?? "1", 10);
      first = false;
    }
    items.push(parseInline(match[2] ?? ""));
    i += 1;
    if (i >= lines.length) break;
  }
  blocks.push({ kind: "ordered-list", start: listStart, items });
  return i;
}

function readUnorderedList(lines: string[], start: number, blocks: Block[]): number {
  const items: Inline[][] = [];
  let i = start;
  for (;;) {
    const line = lines[i] ?? "";
    const match = UNORDERED_ITEM.exec(line);
    if (match === null) break;
    items.push(parseInline(match[1] ?? ""));
    i += 1;
    if (i >= lines.length) break;
  }
  blocks.push({ kind: "unordered-list", items });
  return i;
}

/**
 * A list item, a heading, a fence or a blank line all end a paragraph with
 * no blank line required (D-A P-C9) — this is how an AI actually writes a
 * note (a lead-in sentence straight into a numbered list), and requiring a
 * blank line would render those list lines as literal text instead.
 */
function readParagraph(lines: string[], start: number, blocks: Block[]): number {
  const spans: Inline[] = [];
  let i = start;
  let first = true;
  for (;;) {
    const line = lines[i] ?? "";
    if (
      line.trim().length === 0 ||
      FENCE.test(line) ||
      HEADING.test(line) ||
      ORDERED_ITEM.test(line) ||
      UNORDERED_ITEM.test(line)
    ) {
      break;
    }
    if (!first) spans.push({ kind: "text", text: "\n" });
    spans.push(...parseInline(line));
    first = false;
    i += 1;
    if (i >= lines.length) break;
  }
  blocks.push({ kind: "paragraph", spans });
  return i;
}

/**
 * Left-to-right, linear scan: each marker kind gets at most one forward
 * `indexOf` search per unmatched attempt on a line, after which a latch
 * turns further attempts of that kind into a plain one-character advance.
 * That is what keeps a line of `"**".repeat(16000)` cheap instead of
 * quadratic, and advancing by exactly one character on every failed match
 * is what guarantees no character is ever dropped.
 */
export function parseInline(line: string): Inline[] {
  const spans: Inline[] = [];
  let buffer = "";
  let i = 0;
  let codePossible = true;
  let boldPossible = true;

  function flush(): void {
    if (buffer.length > 0) {
      spans.push({ kind: "text", text: buffer });
      buffer = "";
    }
  }

  while (i < line.length) {
    const ch = line[i];
    if (ch === "`" && codePossible) {
      const close = line.indexOf("`", i + 1);
      if (close > i + 1) {
        flush();
        spans.push({ kind: "code", text: line.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
      if (close === -1) codePossible = false;
      buffer += ch;
      i += 1;
      continue;
    }
    if (ch === "*" && line[i + 1] === "*" && boldPossible) {
      const close = line.indexOf("**", i + 2);
      if (close > i + 2) {
        flush();
        spans.push({ kind: "bold", text: line.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      if (close === -1) boldPossible = false;
      buffer += ch;
      i += 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return spans;
}
