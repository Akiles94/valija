import type { TranslationKey, Translator } from "../../shared/i18n/translate.js";
import type {
  DiagnosticCheckMessage,
  NodeStatusResponse,
  ToolsStatusEntry,
} from "../../shared/ipc/messages.js";
import { checkRowDetail } from "./diagnostic-detail.js";

export interface DiagnosticRow {
  key: string;
  name: string;
  status: string;
  explanation: string;
  detail: string;
  extra?: string | undefined;
  ok: boolean;
  /** Mirrors `doctor.ts`'s own `!check.ok && check.fatal` distinction (Slice 10 criterion 3) — carried onto the row so a stylesheet can tell a warning from a failure without reopening this module (S4, `review.md`). */
  fatal: boolean;
}

type Translate = Translator["t"];

const FIXED_CHECK_EXPLANATIONS: Partial<Record<string, TranslationKey>> = {
  node: "diagnostics.checkNode",
  sqlcipher: "diagnostics.checkSqlcipher",
  keychain: "diagnostics.checkKeychain",
  vault: "diagnostics.checkVault",
  journal: "diagnostics.checkJournal",
  sync: "diagnostics.checkSync",
  lineage: "diagnostics.checkLineage",
  "auto-lock": "diagnostics.checkAutoLock",
};

const FIXED_ROW_NAMES: Partial<Record<string, TranslationKey>> = {
  sqlcipher: "diagnostics.rowName.sqlcipher",
  keychain: "diagnostics.rowName.keychain",
  vault: "diagnostics.rowName.vault",
  journal: "diagnostics.rowName.journal",
  sync: "diagnostics.rowName.sync",
  lineage: "diagnostics.rowName.lineage",
  "auto-lock": "diagnostics.rowName.autoLock",
};

/** `knownClients` guards the fallback: a name that is neither a fixed check nor a client `tools:status` actually reported gets no explanation, rather than a confidently wrong one (refined.md §4.6 step 26). */
function explanationFor(name: string, knownClients: Set<string>, t: Translate): string {
  const key = FIXED_CHECK_EXPLANATIONS[name];
  if (key !== undefined) return t(key);
  return knownClients.has(name) ? t("diagnostics.checkClient", { client: name }) : "";
}

function rowNameFor(name: string, t: Translate): string {
  const key = FIXED_ROW_NAMES[name];
  return key !== undefined ? t(key) : name;
}

function statusLabel(check: DiagnosticCheckMessage, t: Translate): string {
  if (check.ok) return t("diagnostics.ok");
  return check.fatal === true ? t("diagnostics.fatal") : t("diagnostics.warning");
}

function isFatal(check: DiagnosticCheckMessage): boolean {
  return !check.ok && check.fatal === true;
}

/**
 * A client row's `extra` line: the vault path it points at, the default
 * location when it's installed with no explicit one (a `valija install`
 * entry deliberately carries no `env` block), or nothing when the client
 * simply isn't connected — never conflating "installed, default location"
 * with "path unreadable", which is the silent-detachment case §3 fact 6
 * warns about.
 */
function clientExtra(
  check: DiagnosticCheckMessage,
  knownClients: Set<string>,
  toolsStatus: ToolsStatusEntry[],
  t: Translate,
): string | undefined {
  if (!knownClients.has(check.name) || !check.ok) return undefined;
  const entry = toolsStatus.find((e) => e.client === check.name);
  return entry?.vaultPath === undefined
    ? t("diagnostics.clientVaultPathDefault")
    : t("diagnostics.clientVaultPath", { vaultPath: entry.vaultPath });
}

function toolNodeRow(nodeStatus: NodeStatusResponse, t: Translate): DiagnosticRow {
  const ok = nodeStatus.nodeRunnable && nodeStatus.npmRunnable;
  return {
    key: "tool-node",
    name: t("diagnostics.toolNodeRow"),
    status: ok ? t("diagnostics.ok") : t("diagnostics.warning"),
    explanation: "",
    detail: ok ? t("diagnostics.toolNodeOk") : t("diagnostics.toolNodeMissing"),
    ok,
    fatal: false, // D-W: the tool-Node probe warns, it never fails the screen
  };
}

/**
 * Assembles the Diagnostics screen's rows from `runDiagnostics`' own checks
 * plus the app-Node/tool-Node distinction (§3 fact 6, D-W) and each
 * connected client's vault path (refined.md §4.6 step 26) — pure, so every
 * derivation (which status word a check gets, which explanation, which
 * client shows which path) is unit-testable without a DOM (P-D5 confines
 * jsdom + Testing Library to `recovery-kit.tsx`/`relocate-vault.tsx`).
 */
export function diagnosticRows(input: {
  checks: DiagnosticCheckMessage[];
  toolsStatus: ToolsStatusEntry[];
  nodeStatus: NodeStatusResponse | null;
  t: Translate;
  errorCopy: (code: string) => string;
}): DiagnosticRow[] {
  const { checks, toolsStatus, nodeStatus, t, errorCopy } = input;
  const knownClients = new Set(toolsStatus.map((entry) => entry.client));
  const rows: DiagnosticRow[] = [];

  const appNodeCheck = checks.find((c) => c.name === "node");
  if (appNodeCheck !== undefined) {
    rows.push({
      key: "node",
      name: t("diagnostics.appNodeRow"),
      status: statusLabel(appNodeCheck, t),
      explanation: explanationFor("node", knownClients, t),
      detail: checkRowDetail(appNodeCheck, errorCopy),
      ok: appNodeCheck.ok,
      fatal: isFatal(appNodeCheck),
    });
  }

  if (nodeStatus !== null) rows.push(toolNodeRow(nodeStatus, t));

  for (const check of checks) {
    if (check.name === "node") continue;
    rows.push({
      key: check.name,
      name: rowNameFor(check.name, t),
      status: statusLabel(check, t),
      explanation: explanationFor(check.name, knownClients, t),
      detail: checkRowDetail(check, errorCopy),
      extra: clientExtra(check, knownClients, toolsStatus, t),
      ok: check.ok,
      fatal: isFatal(check),
    });
  }

  return rows;
}
