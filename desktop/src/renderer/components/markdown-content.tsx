import { Fragment, type ReactElement, useMemo } from "react";
import { type Block, type Inline, parseLightMarkdown } from "../content/light-markdown.js";

/**
 * The only place in the app that turns a saved item's free-text `content`
 * into elements. `renderBlock`/`renderSpan` are closed `switch`es over
 * `Block`/`Inline` — the emitted element set is exactly
 * `p`/`strong`/`code`/`pre`/`ol`/`ul`/`li` and nothing else: no `<a>`,
 * `<img>`, `<iframe>` or `style`/`href`/`src`/`on*` attribute is ever
 * written from user text, and the only user-derived attribute value is
 * `<ol start>`, which the parser already bounds to nine digits. Content is
 * untrusted (an AI wrote it, an import can carry it) — every string here
 * reaches the DOM as a React text node, never as HTML.
 *
 * Suppressing `noArrayIndexKey`: blocks and spans are a pure function of
 * `content` and are never reordered, inserted, or removed independently —
 * the whole array is rebuilt from scratch whenever `content` changes, so an
 * index is a stable key here.
 */
export function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseLightMarkdown(content), [content]);
  return (
    <div className="md-content">
      {blocks.map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are a pure function of content and are never reordered; the array is rebuilt whole whenever content changes
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: Block): ReactElement {
  switch (block.kind) {
    case "paragraph":
      return <p className="md-p">{renderSpans(block.spans)}</p>;
    case "heading":
      return <p className="md-heading">{renderSpans(block.spans)}</p>;
    case "ordered-list":
      return (
        <ol className="md-list" start={block.start}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items are a pure function of content and are never reordered
            <li key={index}>{renderSpans(item)}</li>
          ))}
        </ol>
      );
    case "unordered-list":
      return (
        <ul className="md-list">
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items are a pure function of content and are never reordered
            <li key={index}>{renderSpans(item)}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre className="md-pre">
          <code>{block.text}</code>
        </pre>
      );
  }
}

function renderSpans(spans: Inline[]) {
  return spans.map((span, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: spans are a pure function of content and are never reordered
    <Fragment key={index}>{renderSpan(span)}</Fragment>
  ));
}

function renderSpan(span: Inline): ReactElement | string {
  switch (span.kind) {
    case "text":
      return span.text;
    case "bold":
      return <strong>{span.text}</strong>;
    case "code":
      return <code className="md-code">{span.text}</code>;
  }
}
