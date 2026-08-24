import { useEffect, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

type ExportFormat = "markdown" | "json";

/**
 * `exportProjectMarkdown` (Slice 4), rendered in the trusted process and
 * displayed as a plain string — never translated (D-V(d), §9 item 55). The
 * one wrapper sentence around it is the only translated copy on this screen.
 */
export function PackPreviewScreen({
  bridge,
  project,
  onBack,
}: {
  bridge: ValijaBridge;
  project: string;
  onBack: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge and errorCopy are stable across renders; project is the real input
  useEffect(() => {
    let cancelled = false;
    bridge.content.pack({ project }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(errorCopy(result.error.code));
        return;
      }
      setMarkdown(result.value.markdown);
    });
    return () => {
      cancelled = true;
    };
  }, [project]);

  function handleCopy() {
    if (markdown === null) return;
    void bridge.content.copy({ text: markdown });
    setCopied(true);
  }

  async function handleExport() {
    setExportedPath(null);
    const result = await bridge.content.export({ project, format });
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    if (!result.value.cancelled && result.value.path !== undefined) {
      setExportedPath(result.value.path);
    }
  }

  return (
    <div className="screen pack-preview">
      <button type="button" onClick={onBack}>
        {t("common.back")}
      </button>
      <h1>{t("pack.title")}</h1>
      <p className="explainer">{t("pack.notTranslatedNotice")}</p>
      {error !== null && <p className="error">{error}</p>}
      {markdown !== null && <pre className="pack-text">{markdown}</pre>}
      <div className="actions">
        <button type="button" onClick={handleCopy} disabled={markdown === null}>
          {copied ? t("common.copied") : t("pack.copy")}
        </button>
        <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="markdown">{t("pack.exportFormatMarkdown")}</option>
          <option value="json">{t("pack.exportFormatJson")}</option>
        </select>
        <button type="button" onClick={() => void handleExport()} disabled={markdown === null}>
          {t("pack.export")}
        </button>
      </div>
      {exportedPath !== null && (
        <p className="export-success">{t("pack.exportedTo", { path: exportedPath })}</p>
      )}
    </div>
  );
}
