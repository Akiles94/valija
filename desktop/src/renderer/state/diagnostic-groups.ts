import type { DiagnosticRow } from "./diagnostic-rows.js";

export type DiagnosticGroupId = "system" | "vault" | "tools" | "other";

export interface DiagnosticGroup {
  id: DiagnosticGroupId;
  rows: DiagnosticRow[];
}

const SYSTEM_KEYS = new Set(["node", "tool-node", "sqlcipher", "keychain"]);
const VAULT_KEYS = new Set(["vault", "journal", "sync", "lineage", "auto-lock"]);

const GROUP_ORDER: readonly DiagnosticGroupId[] = ["system", "vault", "tools", "other"];

function groupFor(key: string, clients: Set<string>): DiagnosticGroupId {
  if (SYSTEM_KEYS.has(key)) return "system";
  if (VAULT_KEYS.has(key)) return "vault";
  if (clients.has(key)) return "tools";
  return "other";
}

/**
 * A pure client-side partition over diagnosticRows()' output — never a change to what
 * diagnostics.run() returns. Order inside a group is the order diagnosticRows() produced.
 * An unrecognised key lands in "other" so a check added to doctor.ts later appears somewhere
 * visible instead of vanishing (D-14). Empty groups are not emitted.
 */
export function groupDiagnosticRows(
  rows: readonly DiagnosticRow[],
  clients: readonly string[],
): DiagnosticGroup[] {
  const clientSet = new Set(clients);
  const byGroup: Record<DiagnosticGroupId, DiagnosticRow[]> = {
    system: [],
    vault: [],
    tools: [],
    other: [],
  };
  for (const row of rows) {
    byGroup[groupFor(row.key, clientSet)].push(row);
  }
  return GROUP_ORDER.filter((id) => byGroup[id].length > 0).map((id) => ({
    id,
    rows: byGroup[id],
  }));
}
