// biome-ignore-all lint/suspicious/noTemplateCurlyInString: fixtures are TypeScript source text that deliberately contains template syntax.
import { describe, expect, it } from "vitest";
import { scanTypeScript } from "./typescript-scanner.js";

const ts = (text: string) => scanTypeScript(text, { jsx: false });
const tsx = (text: string) => scanTypeScript(text, { jsx: true });
const names = (text: string, jsx = false) => {
  const scanned = scanTypeScript(text, { jsx });
  if (!scanned.ok) throw new Error(`scan failed: ${JSON.stringify(scanned.error)}`);
  return scanned.value.declarations.filter((d) => d.exported).map((d) => d.name);
};

describe("scanTypeScript — templates", () => {
  it("survives nested template expressions", () => {
    expect(names("const t = `a ${ {b: `c ${d}`} } e`;\nexport const X = 1;\n")).toEqual(["X"]);
  });

  it("does not see declarations inside a template", () => {
    expect(names("const t = `\nexport function fake() {}\n`;\nexport const Real = t;\n")).toEqual([
      "Real",
    ]);
  });
});

describe("scanTypeScript — regex literals and division", () => {
  it("does not count braces inside regexes", () => {
    expect(names("const a = /[{]/;\nconst b = /\\/}/g;\nexport const X = a;\n")).toEqual(["X"]);
  });

  it("tells division from a regex", () => {
    expect(names("const q = a / b / c;\nx = y / 2; z = /}/;\nexport const X = q;\n")).toEqual([
      "X",
    ]);
  });
});

describe("scanTypeScript — comments and strings", () => {
  it("ignores code-looking comments and braces in strings", () => {
    const src = '// export const fake = 1;\n/* { */\nconst s = "{";\nexport const X = s;\n';
    expect(names(src)).toEqual(["X"]);
  });

  it("attaches the last doc block directly above a declaration", () => {
    const scanned = ts(
      "/** Not this. */\nconst a = 1;\n/**\n * Opens the vault.\n */\nexport function open() {}\n",
    );
    if (!scanned.ok) throw new Error("scan failed");
    expect(scanned.value.declarations.find((d) => d.name === "open")?.doc).toBe("Opens the vault.");
  });

  it("does not attach a doc separated by code", () => {
    const scanned = ts("/** Doc. */\nconst a = 1;\nexport const b = a;\n");
    if (!scanned.ok) throw new Error("scan failed");
    expect(scanned.value.declarations.find((d) => d.name === "b")?.doc).toBeNull();
  });
});

describe("scanTypeScript — export forms", () => {
  it("recognises every multi-line and modifier form", () => {
    const src = [
      "export const f = (",
      "  a: number,",
      ") => {",
      "  return a;",
      "};",
      "export type U =",
      '  | "A"',
      '  | "B";',
      "export function o(a: string): string;",
      "export function o(a: number): number;",
      "export function o(a: unknown) { return a; }",
      "export default function main() {}",
      "export abstract class Base {}",
      "export async function run() {}",
      "export declare const D: number;",
      "export function g<T extends Record<string, () => void>>(t: T) { return t; }",
      "export interface I { a: string }",
      "export enum E { A }",
      "",
    ].join("\n");
    expect(names(src)).toEqual(["f", "U", "o", "main", "Base", "run", "D", "g", "I", "E"]);
  });

  it("records re-exports as exempt and collects module specifiers", () => {
    const scanned = ts(
      'import { a } from "./a.js";\nimport "./side.js";\nexport { b } from "./b.js";\nexport * from "./c.js";\nexport type { T } from "./t.js";\n',
    );
    if (!scanned.ok) throw new Error("scan failed");
    expect(scanned.value.imports).toEqual(["./a.js", "./side.js", "./b.js", "./c.js", "./t.js"]);
    expect(scanned.value.declarations.every((d) => d.reexport)).toBe(true);
  });

  it("records non-exported top-level functions and consts", () => {
    const scanned = ts("function helper() {}\nconst k = 1;\nexport const X = k;\n");
    if (!scanned.ok) throw new Error("scan failed");
    expect(scanned.value.declarations.map((d) => [d.name, d.exported])).toEqual([
      ["helper", false],
      ["k", false],
      ["X", true],
    ]);
  });

  it("keeps the span's source and blanked code at identical offsets", () => {
    const scanned = ts('export const A = { key: "x;y" };\n');
    if (!scanned.ok) throw new Error("scan failed");
    const span = scanned.value.declarations[0]?.span;
    expect(span?.code.length).toBe(span?.source.length);
    expect(span?.code).not.toContain("x;y");
  });
});

describe("scanTypeScript — JSX", () => {
  it("treats an apostrophe in JSX text as prose", () => {
    const src =
      "export function C() {\n  return (\n    <p>Don't close {'{'} here</p>\n  );\n}\nexport const D = 1;\n";
    expect(names(src, true)).toEqual(["C", "D"]);
  });

  it("handles closing tags and attributes containing braces", () => {
    const src =
      'export function C() {\n  return <div title="}" onClick={() => go({ a: 1 })}><Child x={y} /></div>;\n}\nexport const D = 2;\n';
    expect(names(src, true)).toEqual(["C", "D"]);
  });
});

describe("scanTypeScript — fails closed", () => {
  it.each([
    ["an unterminated template", "const t = `abc\n", 1],
    ["an unterminated block comment", "const a = 1;\n/* never closed\n", 2],
    ["a stray closing brace", "const a = 1;\n}\n", 2],
    ["an unsupported export form", "const a = 1;\nexport = a;\n", 2],
    ["a .ts string broken by a newline", 'const s = "abc\ndef";\n', 1],
  ])("rejects %s with its line", (_label, src, line) => {
    const scanned = ts(src);
    expect(scanned.ok).toBe(false);
    if (!scanned.ok) expect(scanned.error.line).toBe(line);
  });

  it("reports an unclosed bracket at end of file", () => {
    expect(tsx("export function f() {\n")).toMatchObject({ ok: false });
  });
});
