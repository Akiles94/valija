import { err, ok, type Result } from "../result.js";
import { createFinding, type Finding } from "../values/finding.js";
import { parseReference, type Reference } from "../values/reference.js";

/** The two reading levels of every flow page (D-15): business first, then technical. */
export const FLOW_SECTIONS = {
  business: ["Who", "Why", "Business rules", "What can go wrong"],
  technical: ["Entry points", "Steps", "Errors"],
} as const;

/** A `{{…}}` citation together with the source line it appeared on. */
export interface LocatedReference {
  readonly reference: Reference;
  readonly line: number;
}

/** The raw Markdown under one `## Heading`, with the heading's line. */
export interface SectionText {
  readonly heading: string;
  readonly text: string;
  readonly line: number;
}

/** One numbered step `N. [From → To] text`, the unit sequence diagrams are drawn from. */
export interface FlowStep {
  readonly number: number;
  readonly from: string;
  readonly to: string;
  readonly text: string;
  readonly references: readonly Reference[];
  readonly line: number;
}

/** A parsed business flow source: metadata, sections, steps and every citation it makes. */
export interface Flow {
  readonly slug: string;
  /** Repo-relative posix path of the source file. */
  readonly file: string;
  readonly title: string;
  readonly theme: string;
  readonly sections: ReadonlyMap<string, SectionText>;
  readonly steps: readonly FlowStep[];
  readonly references: readonly LocatedReference[];
}

const STEP = /^(\d+)\.\s+\[([^\]]+?)\s*(?:→|->)\s*([^\]]+?)\]\s+(.+)$/;
const REFERENCE = /\{\{([^{}]*)\}\}/g;

/** Parses a flow source; collects every problem it finds instead of stopping at the first. */
export function parseFlow(
  file: string,
  source: string,
  knownKinds: readonly string[],
): Result<Flow, Finding[]> {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const findings: Finding[] = [];
  const problem = (line: number | undefined, subject: string, message: string) =>
    findings.push(createFinding({ rule: "malformed-flow", file, line, subject, message }));

  const meta = readFrontMatter(lines);
  if (meta.title === undefined) problem(1, "front matter", "front matter needs a `title:` line");
  if (meta.theme === undefined) problem(1, "front matter", "front matter needs a `theme:` line");

  const references = collectReferences(file, lines, knownKinds, findings);
  const sections = splitSections(lines, meta.bodyStart);
  const steps = parseSteps(file, sections.get("Steps"), lines, knownKinds, problem);

  if (findings.length > 0) return err(findings);
  return ok({
    slug: slugOf(file),
    file,
    title: meta.title as string,
    theme: meta.theme as string,
    sections,
    steps,
    references,
  });
}

/** The flow's slug: its file name without the extension. */
export function slugOf(file: string): string {
  return (file.split("/").at(-1) ?? file).replace(/\.md$/, "");
}

function readFrontMatter(lines: string[]): { title?: string; theme?: string; bodyStart: number } {
  if (lines[0]?.trim() !== "---") return { bodyStart: 0 };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return { bodyStart: 0 };
  const values = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const match = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (match) values.set(match[1] as string, (match[2] as string).trim());
  }
  const meta: { title?: string; theme?: string; bodyStart: number } = { bodyStart: end + 1 };
  const title = values.get("title");
  const theme = values.get("theme");
  if (title) meta.title = title;
  if (theme) meta.theme = theme;
  return meta;
}

function splitSections(lines: string[], bodyStart: number): Map<string, SectionText> {
  const sections = new Map<string, SectionText>();
  let current: { heading: string; line: number; body: string[] } | null = null;
  const flush = () => {
    if (current) {
      const text = current.body.join("\n").trim();
      sections.set(current.heading, { heading: current.heading, text, line: current.line });
    }
  };
  lines.slice(bodyStart).forEach((line, i) => {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = { heading: heading[1] as string, line: bodyStart + i + 1, body: [] };
    } else {
      current?.body.push(line);
    }
  });
  flush();
  return sections;
}

function collectReferences(
  file: string,
  lines: string[],
  knownKinds: readonly string[],
  findings: Finding[],
): LocatedReference[] {
  const located: LocatedReference[] = [];
  lines.forEach((text, i) => {
    for (const match of text.matchAll(REFERENCE)) {
      const parsed = parseReference(match[1] as string, knownKinds);
      if (parsed.ok) {
        located.push({ reference: parsed.value, line: i + 1 });
      } else {
        const rule = parsed.error.startsWith("unknown reference kind")
          ? "unknown-reference-kind"
          : "malformed-flow";
        findings.push(
          createFinding({ rule, file, line: i + 1, subject: match[0], message: parsed.error }),
        );
      }
    }
  });
  return located;
}

function parseSteps(
  file: string,
  section: SectionText | undefined,
  lines: string[],
  knownKinds: readonly string[],
  problem: (line: number | undefined, subject: string, message: string) => void,
): FlowStep[] {
  if (!section) return [];
  const steps: FlowStep[] = [];
  const bodyLines = section.text.split("\n");
  const firstBodyLine = lines.indexOf(bodyLines[0] ?? "", section.line);
  bodyLines.forEach((text, i) => {
    if (!/^\d+\./.test(text)) return;
    const line = firstBodyLine + i + 1;
    const match = STEP.exec(text.trim());
    if (!match) {
      problem(line, `${file} step`, "a step must read `N. [From → To] text`");
      return;
    }
    const number = Number(match[1]);
    if (number !== steps.length + 1) {
      problem(
        line,
        `step ${number}`,
        `steps must be numbered from 1 without gaps (expected ${steps.length + 1})`,
      );
    }
    const references = [...(match[4] as string).matchAll(REFERENCE)]
      .map((r) => parseReference(r[1] as string, knownKinds))
      .flatMap((r) => (r.ok ? [r.value] : []));
    steps.push({
      number,
      from: (match[2] as string).trim(),
      to: (match[3] as string).trim(),
      text: (match[4] as string).trim(),
      references,
      line,
    });
  });
  return steps;
}
