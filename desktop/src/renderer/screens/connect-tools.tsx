import { useEffect, useState } from "react";
import type {
  NodeStatusResponse,
  ToolsConnectResponse,
  ToolsStatusEntry,
} from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useT } from "../state/i18n-context.js";

/**
 * §9 item 71 — one card per client, `tools:status`'s own connected/not-connected
 * read, and `Connect` always writes the app's current vault path (D-R(a)
 * rider 5). §9 item 71a — the Node/npm warning is informational only: it
 * never disables Connect (D-W).
 */
export function ConnectToolsScreen({ bridge }: { bridge: ValijaBridge }) {
  const t = useT();
  const [entries, setEntries] = useState<ToolsStatusEntry[] | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatusResponse | null>(null);
  const [results, setResults] = useState<Record<string, ToolsConnectResponse>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    let cancelled = false;
    bridge.tools.status().then((v) => {
      if (!cancelled) setEntries(v);
    });
    bridge.tools.nodeStatus().then((v) => {
      if (!cancelled) setNodeStatus(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect(client: string) {
    setConnecting(client);
    const result = await bridge.tools.connect({ client });
    setConnecting(null);
    if (!result.ok) return;
    setResults((prev) => ({ ...prev, [client]: result.value }));
  }

  function handleCopy(client: string, snippet: string) {
    void bridge.content.copy({ text: snippet });
    setCopiedFor(client);
  }

  const nodeWarningNeeded =
    nodeStatus !== null && (!nodeStatus.nodeRunnable || !nodeStatus.npmRunnable);

  return (
    <div className="screen connect-tools">
      <h1>{t("connect.title")}</h1>

      {nodeWarningNeeded && (
        <div className="warning">
          <p className="warning-title">{t("connect.nodeMissingTitle")}</p>
          <p>{t("connect.nodeMissingBody")}</p>
          {/* Plain text, not a link: the app never opens a URL or makes a
              network request of any kind (§8.3), so there is no href here. */}
          <p className="docs-hint">{t("connect.nodeMissingDocsLink")}</p>
        </div>
      )}

      {entries === null && <p>{t("common.loading")}</p>}

      {entries !== null && (
        <ul className="client-cards">
          {entries.map((entry) => (
            <li key={entry.client} className="client-card">
              <span className="client-name">{entry.client}</span>
              <span className="client-status">
                {entry.connected ? t("common.connected") : t("common.notConnected")}
              </span>
              {entry.connected && entry.vaultPath !== undefined && (
                <p className="client-points-at">
                  {t("connect.pointsAt", { vaultPath: entry.vaultPath })}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleConnect(entry.client)}
                disabled={connecting === entry.client}
              >
                {t("connect.connectButton")}
              </button>

              {results[entry.client]?.outcome === "connected" && (
                <p className="connect-success">
                  {results[entry.client]?.backupPath === undefined
                    ? t("connect.connectedDetailNoBackup", {
                        configPath: results[entry.client]?.configPath ?? "",
                        client: entry.client,
                      })
                    : t("connect.connectedDetail", {
                        configPath: results[entry.client]?.configPath ?? "",
                        backupPath: results[entry.client]?.backupPath ?? "",
                        client: entry.client,
                      })}
                </p>
              )}

              {results[entry.client]?.outcome === "configUnreadable" && (
                <div className="connect-manual-fallback">
                  <p className="error">
                    {t("connect.failureInvalidConfig", { client: entry.client })}
                  </p>
                  <p>{t("connect.manualInstructionsIntro")}</p>
                  <pre>{results[entry.client]?.manualSnippet}</pre>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(entry.client, results[entry.client]?.manualSnippet ?? "")
                    }
                  >
                    {copiedFor === entry.client
                      ? t("connect.manualInstructionsCopied")
                      : t("common.copy")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
