import { byCodeUnit } from "../result.js";

/** Every rule `docs:check` can report; one name per way the guide can be wrong. */
export type FindingRule =
  | "undocumented-export"
  | "trivial-doc"
  | "broken-reference"
  | "ambiguous-reference"
  | "unknown-reference-kind"
  | "unreferenced-item"
  | "missing-section"
  | "malformed-flow"
  | "unscannable-source"
  | "stale-page"
  | "orphan-page"
  | "extractor-failure";

/** One problem with the guide or the code it documents, located as precisely as possible. */
export interface Finding {
  readonly rule: FindingRule;
  readonly file: string;
  readonly line?: number;
  readonly subject: string;
  readonly message: string;
}

/** Total factory for a finding; `line` is omitted rather than set to `undefined`. */
export function createFinding(input: {
  rule: FindingRule;
  file: string;
  line?: number | undefined;
  subject: string;
  message: string;
}): Finding {
  const { line, ...rest } = input;
  return line === undefined ? rest : { ...rest, line };
}

/** Stable order for reports: file, then line, then rule, then subject. */
export function compareFindings(a: Finding, b: Finding): number {
  return (
    byCodeUnit(a.file, b.file) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    byCodeUnit(a.rule, b.rule) ||
    byCodeUnit(a.subject, b.subject)
  );
}
