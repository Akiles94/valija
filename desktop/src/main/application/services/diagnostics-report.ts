import type { DiagnosticCheckMessage } from "../../../shared/ipc/messages.js";

export interface DiagnosticsReportInput {
  checks: DiagnosticCheckMessage[];
  appVersion: string;
  electronVersion: string;
  osLabel: string;
  vaultPath: string;
  schemaVersion: number;
  generation: number | null;
}

function statusWord(check: DiagnosticCheckMessage): string {
  if (check.ok) return "OK";
  return check.fatal === true ? "FATAL" : "WARN";
}

/**
 * The Copy-report text (D-T, D-V(d)) — always English, built here in main
 * rather than returned to the renderer to compose: this is the one support
 * artifact allowed to carry a check's raw detail verbatim, which may itself
 * embed a raw `DomainError.message` (§4.6 step 26''). No vault content, no
 * project names, no item text, no key material — only the fields named
 * above.
 */
export function buildDiagnosticsReport(input: DiagnosticsReportInput): string {
  const lines = [
    "Valija diagnostics report",
    `App version: ${input.appVersion}`,
    `Electron version: ${input.electronVersion}`,
    `OS: ${input.osLabel}`,
    `Vault path: ${input.vaultPath}`,
    // The latest schema this build of the app knows how to read/write — not
    // necessarily the vault-on-disk's own version, which would need the
    // vault unlocked (and its key) to read.
    `App schema version (latest known): ${input.schemaVersion}`,
    `Generation: ${input.generation ?? "unknown"}`,
    "",
    "Checks:",
    ...input.checks.map((check) => `[${statusWord(check)}] ${check.name}: ${check.detail}`),
  ];
  return lines.join("\n");
}
