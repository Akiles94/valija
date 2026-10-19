import type { GuideStats } from "../../domain/entities/guide.js";
import { compareFindings, type Finding } from "../../domain/values/finding.js";

/** Outcome of one `docs` / `docs:check` run. */
export interface GuideReport {
  readonly mode: "write" | "check";
  readonly findings: readonly Finding[];
  readonly stats: GuideStats;
  readonly pagesWritten: number;
}

/** Total factory; findings come out in report order. */
export function createGuideReport(
  mode: "write" | "check",
  findings: readonly Finding[],
  stats: GuideStats,
  pagesWritten: number,
): GuideReport {
  return { mode, findings: [...findings].sort(compareFindings), stats, pagesWritten };
}

/** The console lines a run prints: one `✗` line per finding, then a one-line summary. */
export function formatGuideReport(report: GuideReport): string[] {
  const lines = report.findings.map((f) => {
    const at = f.line === undefined ? f.file : `${f.file}:${f.line}`;
    return `✗ [${f.rule}] ${at}  ${f.message}`;
  });
  const { exports, documented, flows, citations } = report.stats;
  if (report.findings.length > 0) {
    const noun = report.findings.length === 1 ? "problem" : "problems";
    lines.push(`${report.findings.length} ${noun}. Guide not up to date.`);
  } else {
    lines.push(
      `✓ Guide ${report.mode === "write" ? "written" : "up to date"}: ${flows} flows, ${citations} citations, ${documented}/${exports} exports documented.`,
    );
  }
  return lines;
}
