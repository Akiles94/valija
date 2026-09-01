import { describe, expect, it } from "vitest";
import { type Block, type Inline, parseInline, parseLightMarkdown } from "./light-markdown.js";

/** Concatenates every span's/block's visible text, for the round-trip property below. */
function flatten(blocks: Block[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "code") return block.text;
      const spanText = (spans: Inline[]) => spans.map((s) => s.text).join("");
      if (block.kind === "ordered-list" || block.kind === "unordered-list") {
        return block.items.map(spanText).join("\n");
      }
      return spanText(block.spans);
    })
    .join("\n");
}

describe("parseLightMarkdown — headings", () => {
  it("a leading '## ' line becomes one heading block with the marker characters absent", () => {
    const blocks = parseLightMarkdown("## Diagnóstico y fix");
    expect(blocks).toEqual([
      { kind: "heading", spans: [{ kind: "text", text: "Diagnóstico y fix" }] },
    ]);
  });

  it("'#' and '###' also match; '####' does not and falls back to a paragraph", () => {
    expect(parseLightMarkdown("# Title")[0]?.kind).toBe("heading");
    expect(parseLightMarkdown("### Title")[0]?.kind).toBe("heading");
    expect(parseLightMarkdown("#### Title")[0]?.kind).toBe("paragraph");
    expect(flatten(parseLightMarkdown("#### Title"))).toBe("#### Title");
  });
});

describe("parseLightMarkdown — bold", () => {
  it("'**Síntoma:**' becomes one bold span with no literal asterisks", () => {
    const blocks = parseLightMarkdown('**Síntoma:** la GUI mostraba "Conectado"');
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        spans: [
          { kind: "bold", text: "Síntoma:" },
          { kind: "text", text: ' la GUI mostraba "Conectado"' },
        ],
      },
    ]);
  });

  it("an unmatched '**' stays literal", () => {
    expect(flatten(parseLightMarkdown("a **b"))).toBe("a **b");
  });

  it("'****' (an empty bold span) stays literal", () => {
    expect(flatten(parseLightMarkdown("a ****b"))).toBe("a ****b");
  });

  it("'2**32**5' splits into text/bold/text, as a documented decision", () => {
    expect(parseInline("2**32**5")).toEqual([
      { kind: "text", text: "2" },
      { kind: "bold", text: "32" },
      { kind: "text", text: "5" },
    ]);
  });
});

describe("parseLightMarkdown — ordered lists", () => {
  it("a run of '1. '/'2. ' lines becomes one block with two items, start 1", () => {
    const blocks = parseLightMarkdown("1. uno\n2. dos");
    expect(blocks).toEqual([
      {
        kind: "ordered-list",
        start: 1,
        items: [[{ kind: "text", text: "uno" }], [{ kind: "text", text: "dos" }]],
      },
    ]);
  });

  it("a list starting at '2.' keeps start === 2, not renumbered to 1", () => {
    const blocks = parseLightMarkdown("2. dos\n3. tres");
    expect(blocks[0]).toMatchObject({ kind: "ordered-list", start: 2 });
  });

  it("a 13-digit 'number' does not match the {1,9}-bounded regex, so it is a paragraph", () => {
    const blocks = parseLightMarkdown("1234567890123. not a list");
    expect(blocks[0]?.kind).toBe("paragraph");
  });
});

describe("parseLightMarkdown — unordered lists", () => {
  it("'- ' and '* ' runs become one unordered-list block", () => {
    const blocks = parseLightMarkdown("- uno\n- dos");
    expect(blocks).toEqual([
      {
        kind: "unordered-list",
        items: [[{ kind: "text", text: "uno" }], [{ kind: "text", text: "dos" }]],
      },
    ]);
  });

  it("a mixed '-'/'*' run is still a single list", () => {
    const blocks = parseLightMarkdown("- uno\n* dos");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("unordered-list");
  });

  it("an indented item is flattened into the same list, not nested", () => {
    const blocks = parseLightMarkdown("- uno\n  - dos");
    expect(blocks).toHaveLength(1);
    if (blocks[0]?.kind !== "unordered-list") throw new Error("expected unordered-list");
    expect(blocks[0].items).toHaveLength(2);
  });
});

describe("parseLightMarkdown — inline code", () => {
  it("'`x`' becomes a code span", () => {
    expect(parseInline("run `npx -y valija mcp` now")).toEqual([
      { kind: "text", text: "run " },
      { kind: "code", text: "npx -y valija mcp" },
      { kind: "text", text: " now" },
    ]);
  });

  it("code wins over bold: '`**a**`' is a code span containing literal asterisks", () => {
    expect(parseInline("`**a**`")).toEqual([{ kind: "code", text: "**a**" }]);
  });

  it("an unmatched backtick stays literal", () => {
    expect(flatten(parseLightMarkdown("a `b"))).toBe("a `b");
  });

  it("an empty backtick pair stays literal", () => {
    expect(flatten(parseLightMarkdown("a ``b"))).toBe("a ``b");
  });
});

describe("parseLightMarkdown — fenced code", () => {
  it("fences its content literally, with no inline parsing inside", () => {
    const blocks = parseLightMarkdown("```\n**b** stays literal\n```");
    expect(blocks).toEqual([{ kind: "code", text: "**b** stays literal" }]);
  });

  it("ignores the info string", () => {
    const blocks = parseLightMarkdown("```ts\nconst x = 1;\n```");
    expect(blocks).toEqual([{ kind: "code", text: "const x = 1;" }]);
  });

  it("an unterminated fence swallows the remainder instead of hanging or throwing", () => {
    const blocks = parseLightMarkdown("```\nline one\nline two");
    expect(blocks).toEqual([{ kind: "code", text: "line one\nline two" }]);
  });
});

describe("parseLightMarkdown — preservation (unsupported syntax stays literal)", () => {
  it.each([
    "_snake_case_",
    "VALIJA_STATE_HOME",
    "[text](example)",
    "> a quote",
    "| a | b |",
    "#### not a heading",
  ])("%s comes back unchanged, with no invented span", (text) => {
    expect(flatten(parseLightMarkdown(text))).toBe(text);
  });
});

describe("parseLightMarkdown — round-trip (no character loss)", () => {
  it.each([
    "plain sentence, no syntax at all",
    "VALIJA_STATE_HOME and save_context and created_at",
    "",
  ])("marker-free input flattens back to itself exactly: %s", (text) => {
    expect(flatten(parseLightMarkdown(text))).toBe(text);
  });

  it("a mixed real-world note flattens to its visible text with only the markers consumed", () => {
    const content = "## Title\n\n**Bold** and `code` and plain.\n\n1. one\n2. two";
    expect(flatten(parseLightMarkdown(content))).toBe("Title\nBold and code and plain.\none\ntwo");
  });
});

describe("parseLightMarkdown — totality (never throws, never drops input)", () => {
  it.each(["", "\n\n\n", "`", "*", "```", "**", "- ", "1. "])("does not throw on: %j", (text) => {
    expect(() => parseLightMarkdown(text)).not.toThrow();
  });

  it("CRLF and lone-CR line endings parse identically to LF", () => {
    expect(parseLightMarkdown("a\r\nb")).toEqual(parseLightMarkdown("a\nb"));
    expect(parseLightMarkdown("a\rb")).toEqual(parseLightMarkdown("a\nb"));
  });
});

describe("parseLightMarkdown — availability on adversarial input", () => {
  it("a 32 KiB pathological string parses well under a frame budget", () => {
    const pathological = `${"**".repeat(4000)}\n${"`".repeat(4000)}\n${Array.from(
      { length: 2000 },
      (_, n) => `${n + 1}. line`,
    ).join("\n")}`;
    const start = performance.now();
    const blocks = parseLightMarkdown(pathological);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
    expect(blocks.length).toBeGreaterThan(0);
  });
});
