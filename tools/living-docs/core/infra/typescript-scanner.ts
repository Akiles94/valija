import { err, ok, type Result } from "../domain/result.js";
import type { DeclarationKind } from "../domain/values/documented-symbol.js";

/** One top-level declaration found by the scanner. */
export interface ScannedDeclaration {
  /** Declared name; `default` for `export default <expression>`. */
  readonly name: string;
  readonly declaration: DeclarationKind;
  readonly exported: boolean;
  /** `export { … }` / `export * from` — recorded but exempt from the doc rule. */
  readonly reexport: boolean;
  readonly line: number;
  readonly doc: string | null;
  /** Declaration text; `code` has comment and string contents blanked, at identical offsets. */
  readonly span: { readonly source: string; readonly code: string };
}

/** Everything the scanner learned about one file. */
export interface ScannedFile {
  readonly declarations: readonly ScannedDeclaration[];
  /** Module specifiers of top-level `import … from` / `export … from` statements. */
  readonly imports: readonly string[];
  /** The whole file with comment and string contents blanked (same offsets as the source). */
  readonly code: string;
}

/** Why a file could not be scanned with confidence; `docs:check` reports it, never skips it. */
export interface ScanFailure {
  readonly line: number;
  readonly reason: string;
}

const REGEX_KEYWORDS = new Set([
  "return",
  "typeof",
  "case",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "instanceof",
  "yield",
  "await",
  "else",
  "do",
]);

const EXPORT_DECL =
  /^export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(class|function\*?|interface|type|const|let|var|enum|namespace)\s+([A-Za-z_$][\w$]*)/;
const LOCAL_DECL = /^(?:declare\s+)?(?:async\s+)?(function\*?|const|class)\s+([A-Za-z_$][\w$]*)/;

interface Lexed {
  readonly code: string;
  readonly depth: Int32Array;
  readonly docs: readonly { start: number; end: number; text: string }[];
}

/**
 * Comment-, string-, template- and regex-aware lexical scan of a TypeScript file. It is not a
 * parser: it recognises top-level declarations only, and fails closed on anything it cannot read
 * with confidence instead of guessing.
 */
export function scanTypeScript(
  text: string,
  options: { jsx: boolean },
): Result<ScannedFile, ScanFailure> {
  const lexed = lex(text, options.jsx);
  if (!lexed.ok) return lexed;
  return collect(text, lexed.value);
}

function lex(src: string, jsx: boolean): Result<Lexed, ScanFailure> {
  const code = src.split("");
  const depth = new Int32Array(src.length + 1);
  const docs: { start: number; end: number; text: string }[] = [];
  const stack: string[] = [];
  let line = 1;
  let operand = false;
  let word = "";
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (code[k] !== "\n") code[k] = " ";
  };
  const fail = (reason: string, at = line) => err({ line: at, reason });

  let i = 0;
  let inTemplate = false;
  let templateLine = 0;
  while (i < src.length) {
    depth[i] = stack.length;
    const c = src[i] as string;
    const next = src[i + 1];

    if (inTemplate) {
      const start = i;
      while (i < src.length && src[i] !== "`" && !(src[i] === "$" && src[i + 1] === "{")) {
        if (src[i] === "\\") i++;
        else if (src[i] === "\n") line++;
        i++;
      }
      blank(start, Math.min(i, src.length));
      for (let k = start; k < i; k++) depth[k] = stack.length;
      if (i >= src.length) return fail("unterminated template literal", templateLine);
      if (src[i] === "`") {
        inTemplate = false;
        operand = true;
        i++;
      } else {
        stack.push("${");
        inTemplate = false;
        i += 2;
        operand = false;
      }
      continue;
    }

    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }

    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) return fail("unterminated block comment");
      if (src[i + 2] === "*" && src[i + 3] !== "/") {
        docs.push({ start: i, end: end + 2, text: cleanDoc(src.slice(i + 3, end)) });
      }
      for (let k = i; k < end + 2; k++) {
        depth[k] = stack.length;
        if (src[k] === "\n") line++;
      }
      blank(i, end + 2);
      i = end + 2;
      continue;
    }

    if ((c === '"' || c === "'") && jsx && /\w/.test(src[i - 1] ?? "")) {
      i++; // JSX text apostrophe (`Don't`): code never puts a quote right after a word character.
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") i++;
        else if (src[i] === "\n") break;
        i++;
      }
      if (i >= src.length) return fail("unterminated string");
      if (src[i] === "\n") {
        if (!jsx) return fail("newline inside a string literal");
        blank(start, i); // JSX text such as <p>Don't…</p>: the quote was prose, not a string.
        operand = false;
        continue;
      }
      blank(start + 1, i);
      i++;
      operand = true;
      continue;
    }

    if (c === "`") {
      inTemplate = true;
      templateLine = line;
      i++;
      continue;
    }

    if (c === "/") {
      const jsxClose = jsx && src[i - 1] === "<";
      if (!operand && !jsxClose) {
        const start = i;
        i++;
        let inClass = false;
        while (i < src.length) {
          const r = src[i];
          if (r === "\\") i++;
          else if (r === "\n") break;
          else if (r === "[") inClass = true;
          else if (r === "]") inClass = false;
          else if (r === "/" && !inClass) break;
          i++;
        }
        if (src[i] === "\n" && jsx) {
          i = start + 1; // a lone `/` in JSX text, not a regex
          operand = false;
          continue;
        }
        if (i >= src.length || src[i] === "\n") return fail("unterminated regular expression");
        blank(start + 1, i);
        i++;
        while (i < src.length && /[a-z]/.test(src[i] as string)) i++;
        operand = true;
        continue;
      }
      operand = false;
      i++;
      continue;
    }

    if (c === "{" || c === "(" || c === "[") {
      stack.push(c);
      operand = false;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      const open = stack.pop();
      const expected = c === "}" ? ["{", "${"] : c === ")" ? ["("] : ["["];
      if (open === undefined || !expected.includes(open)) {
        return fail(`unbalanced \`${c}\``);
      }
      depth[i] = stack.length;
      i++;
      if (open === "${") {
        inTemplate = true;
        continue;
      }
      operand = true;
      continue;
    }

    if (/[\w$#]/.test(c)) {
      const start = i;
      while (i < src.length && /[\w$#]/.test(src[i] as string)) {
        depth[i] = stack.length;
        i++;
      }
      word = src.slice(start, i);
      operand = !REGEX_KEYWORDS.has(word);
      continue;
    }

    operand = false;
    i++;
  }
  depth[src.length] = stack.length;
  if (inTemplate) return fail("unterminated template literal", templateLine);
  if (stack.length > 0) return fail(`unclosed \`${stack.at(-1)}\` at end of file`);
  return ok({ code: code.join(""), depth, docs });
}

function cleanDoc(body: string): string {
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*\*?\s?/, "").trimEnd())
    .join("\n")
    .trim();
}

function collect(src: string, lexed: Lexed): Result<ScannedFile, ScanFailure> {
  const { code, depth, docs } = lexed;
  const lineStarts = [0];
  for (let k = 0; k < src.length; k++) if (src[k] === "\n") lineStarts.push(k + 1);

  const declarations: ScannedDeclaration[] = [];
  const imports: string[] = [];

  for (let n = 0; n < lineStarts.length; n++) {
    const at = lineStarts[n] as number;
    if (depth[at] !== 0) continue;
    const rest = code.slice(at, lineStarts[n + 1] ?? code.length);
    const lineNo = n + 1;

    if (rest.startsWith("import") || rest.startsWith("export")) {
      const specifier = moduleSpecifier(statementSpan(src, code, depth, lineStarts, n));
      if (specifier !== null) imports.push(specifier);
    }

    if (rest.startsWith("export ") || rest.startsWith("export{") || rest.startsWith("export*")) {
      const span = statementSpan(src, code, depth, lineStarts, n);
      const head = span.code.replace(/\s+/g, " ");
      if (/^export ?(type ?)?\{|^export ?\*/.test(head)) {
        declarations.push(decl("*", "const", true, true, lineNo, null, span));
        continue;
      }
      const match = EXPORT_DECL.exec(head);
      if (match) {
        const kind = (match[1] as string).replace("*", "") as DeclarationKind;
        declarations.push(decl(match[2] as string, kind, true, false, lineNo, docBefore(at), span));
        continue;
      }
      if (/^export default (?!function|class)/.test(head)) {
        declarations.push(decl("default", "const", true, false, lineNo, docBefore(at), span));
        continue;
      }
      if (/^export default (async )?(function|class)\b/.test(head)) {
        declarations.push(decl("default", "function", true, false, lineNo, docBefore(at), span));
        continue;
      }
      return err({ line: lineNo, reason: `unsupported export form: ${head.slice(0, 40)}` });
    }

    const local = LOCAL_DECL.exec(rest);
    if (local) {
      const span = statementSpan(src, code, depth, lineStarts, n);
      const kind = (local[1] as string).replace("*", "") as DeclarationKind;
      declarations.push(decl(local[2] as string, kind, false, false, lineNo, docBefore(at), span));
    }
  }

  return ok({ declarations: mergeOverloads(declarations), imports, code });

  function docBefore(at: number): string | null {
    const doc = docs.filter((d) => d.end <= at).at(-1);
    if (!doc || src.slice(doc.end, at).trim() !== "") return null;
    return doc.text;
  }
}

function decl(
  name: string,
  declaration: DeclarationKind,
  exported: boolean,
  reexport: boolean,
  line: number,
  doc: string | null,
  span: { source: string; code: string },
): ScannedDeclaration {
  return { name, declaration, exported, reexport, line, doc, span };
}

/** A statement ends at the first line end, at depth 0, whose code ends in `;` or `}`. */
function statementSpan(
  src: string,
  code: string,
  depth: Int32Array,
  lineStarts: number[],
  n: number,
): { source: string; code: string } {
  const start = lineStarts[n] as number;
  for (let m = n; m < lineStarts.length; m++) {
    const end = (lineStarts[m + 1] ?? src.length + 1) - 1;
    const tail = code.slice(lineStarts[m], end).trimEnd();
    if (depth[end] === 0 && (tail.endsWith(";") || tail.endsWith("}"))) {
      return { source: src.slice(start, end), code: code.slice(start, end) };
    }
  }
  return { source: src.slice(start), code: code.slice(start) };
}

function moduleSpecifier(span: { source: string; code: string }): string | null {
  if (!/^(import|export)\b/.test(span.code)) return null;
  const match = /\bfrom\s*(["'])|^import\s*(["'])/.exec(span.code);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  const close = span.source.indexOf(span.source[open] as string, open + 1);
  return close < 0 ? null : span.source.slice(open + 1, close);
}

function mergeOverloads(declarations: ScannedDeclaration[]): ScannedDeclaration[] {
  const seen = new Map<string, number>();
  const merged: ScannedDeclaration[] = [];
  for (const d of declarations) {
    if (d.reexport) {
      merged.push(d);
      continue;
    }
    const key = `${d.exported}:${d.name}`;
    const index = seen.get(key);
    if (index === undefined) {
      seen.set(key, merged.length);
      merged.push(d);
    } else if ((merged[index] as ScannedDeclaration).doc === null && d.doc !== null) {
      merged[index] = { ...(merged[index] as ScannedDeclaration), doc: d.doc };
    }
  }
  return merged;
}
