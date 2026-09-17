import { useState } from "react";
import type { TranslationKey } from "../../shared/i18n/translate.js";
import type {
  DiagnosticCheckMessage,
  NodeStatusResponse,
  ToolsStatusEntry,
} from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import type { DiagnosticGroupId } from "../state/diagnostic-groups.js";
import { groupDiagnosticRows } from "../state/diagnostic-groups.js";
import { diagnosticRows } from "../state/diagnostic-rows.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

const SECTION_LABELS: Record<DiagnosticGroupId, TranslationKey> = {
  system: "diagnostics.sectionSystem",
  vault: "diagnostics.sectionVault",
  tools: "diagnostics.sectionTools",
  other: "diagnostics.sectionOther",
};

function CheckRow({
  name,
  status,
  explanation,
  detail,
  extra,
  ok,
  fatal,
}: {
  name: string;
  status: string;
  explanation: string;
  detail: string;
  extra?: string | undefined;
  ok: boolean;
  fatal: boolean;
}) {
  const severity = ok ? "ok" : fatal ? "fatal" : "warning";
  return (
    <tr className={`check-row ${severity}`}>
      <td className="check-status-cell">
        <span className={`status-dot ${severity}`} aria-hidden="true" />
        <span className="check-status">{status}</span>
      </td>
      <td className="check-name">{name}</td>
      <td className="check-detail-cell">
        {explanation !== "" && <p className="check-explanation">{explanation}</p>}
        <p className="check-detail">{detail}</p>
        {extra !== undefined && <p className="check-extra">{extra}</p>}
      </td>
    </tr>
  );
}

/**
 * §4.6 steps 26–26''': the checks `valija doctor` already runs, read through
 * `bridge.diagnostics.run` (never re-derived here) with a plain-language
 * explanation per row. Both keychain- and Node-probe side effects (D-H, D-W,
 * §8 item 13) are disclosed *before* the user asks for them to run — nothing
 * on this screen fetches anything probe-backed on mount, only on the
 * explicit "Run checks" click. Row assembly itself lives in
 * `state/diagnostic-rows.ts`, pure and unit-tested, so this component is
 * just a render of that list.
 */
export function DiagnosticsScreen({ bridge }: { bridge: ValijaBridge }) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [checks, setChecks] = useState<DiagnosticCheckMessage[] | null>(null);
  const [toolsStatus, setToolsStatus] = useState<ToolsStatusEntry[] | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyErrorText, setCopyErrorText] = useState<string | null>(null);

  async function handleRunChecks() {
    setRunning(true);
    setRunError(null);
    setCopied(false);
    setCopyErrorText(null);
    try {
      const [diagnosticsResponse, statusEntries, nodeProbe] = await Promise.all([
        bridge.diagnostics.run(),
        bridge.tools.status(),
        bridge.tools.nodeStatus(),
      ]);
      setChecks(diagnosticsResponse.checks);
      setToolsStatus(statusEntries);
      setNodeStatus(nodeProbe);
    } catch {
      setRunError(errorCopy("IPC_FAILURE"));
    } finally {
      setRunning(false);
    }
  }

  async function handleCopyReport() {
    if (checks === null) return;
    setCopied(false);
    setCopyErrorText(null);
    try {
      await bridge.diagnostics.copyReport({ checks });
      setCopied(true);
    } catch {
      setCopyErrorText(errorCopy("IPC_FAILURE"));
    }
  }

  const rows =
    checks === null
      ? []
      : diagnosticRows({ checks, toolsStatus: toolsStatus ?? [], nodeStatus, t, errorCopy });
  const groups = groupDiagnosticRows(
    rows,
    (toolsStatus ?? []).map((entry) => entry.client),
  );

  return (
    <div className="screen diagnostics">
      <div className="screen-toolbar">
        <h1>{t("diagnostics.title")}</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={() => void handleRunChecks()} disabled={running}>
            {t("diagnostics.run")}
          </button>
          {checks !== null && (
            <button type="button" onClick={() => void handleCopyReport()}>
              {copied ? t("common.copied") : t("diagnostics.copyReport")}
            </button>
          )}
        </div>
      </div>
      <p className="explainer">{t("diagnostics.keychainProbeNotice")}</p>
      <p className="explainer">{t("diagnostics.nodeProbeNotice")}</p>
      {runError !== null && <p className="error">{runError}</p>}

      {checks !== null && (
        <>
          {groups.map((group) => (
            <section key={group.id} className="diagnostic-section">
              <h2>{t(SECTION_LABELS[group.id])}</h2>
              <table className="diagnostic-table">
                <caption className="sr-only">{t(SECTION_LABELS[group.id])}</caption>
                <tbody>
                  {group.rows.map((row) => (
                    <CheckRow
                      key={row.key}
                      name={row.name}
                      status={row.status}
                      explanation={row.explanation}
                      detail={row.detail}
                      extra={row.extra}
                      ok={row.ok}
                      fatal={row.fatal}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {copyErrorText !== null && <p className="error">{copyErrorText}</p>}
          <p className="explainer">{t("diagnostics.copyReportNotice")}</p>
        </>
      )}
    </div>
  );
}
