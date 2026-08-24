import { useState } from "react";
import type {
  DiagnosticCheckMessage,
  NodeStatusResponse,
  ToolsStatusEntry,
} from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import { diagnosticRows } from "../state/diagnostic-rows.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

function CheckRow({
  name,
  status,
  explanation,
  detail,
  extra,
  ok,
}: {
  name: string;
  status: string;
  explanation: string;
  detail: string;
  extra?: string | undefined;
  ok: boolean;
}) {
  return (
    <li className={`check-row ${ok ? "ok" : "problem"}`}>
      <span className="check-name">{name}</span>
      <span className="check-status">{status}</span>
      {explanation !== "" && <p className="check-explanation">{explanation}</p>}
      <p className="check-detail">{detail}</p>
      {extra !== undefined && <p className="check-extra">{extra}</p>}
    </li>
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

  return (
    <div className="screen diagnostics">
      <h1>{t("diagnostics.title")}</h1>
      <p className="explainer">{t("diagnostics.keychainProbeNotice")}</p>
      <p className="explainer">{t("diagnostics.nodeProbeNotice")}</p>

      <button type="button" onClick={() => void handleRunChecks()} disabled={running}>
        {t("diagnostics.run")}
      </button>
      {runError !== null && <p className="error">{runError}</p>}

      {checks !== null && (
        <>
          <ul className="diagnostic-checks">
            {rows.map((row) => (
              <CheckRow
                key={row.key}
                name={row.name}
                status={row.status}
                explanation={row.explanation}
                detail={row.detail}
                extra={row.extra}
                ok={row.ok}
              />
            ))}
          </ul>

          <button type="button" onClick={() => void handleCopyReport()}>
            {copied ? t("common.copied") : t("diagnostics.copyReport")}
          </button>
          {copyErrorText !== null && <p className="error">{copyErrorText}</p>}
          <p className="explainer">{t("diagnostics.copyReportNotice")}</p>
        </>
      )}
    </div>
  );
}
