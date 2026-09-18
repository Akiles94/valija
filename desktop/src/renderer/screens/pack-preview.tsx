import { useEffect, useState } from "react";
import { MarkdownContent } from "../components/markdown-content.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

type ExportFormat = "markdown" | "json";
type PackView = "rendered" | "raw";

/**
 * `exportProjectMarkdown` (Slice 4), rendered in the trusted process and
 * displayed as a plain string in the raw view — never translated (D-V(d),
 * §9 item 55). The rendered view (GUI-LAYOUT §5.4, D-7 Option 2) is the same
 * untrusted-content path `MarkdownContent` already uses for saved items;
 * `handleCopy`/`handleExport` never read it — both still read `markdown`
 * and `{project, format}` exactly as before, so Copy and Export always send
 * the raw saved text regardless of which view is showing (§7.1).
 */
export function PackPreviewScreen({ bridge, project }: { bridge: ValijaBridge; project: string }) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [view, setView] = useState<PackView>("rendered");

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
      <h1>{t("pack.title")}</h1>
      <div className="pack-toolbar">
        <p className="explainer">{t("pack.notTranslatedNotice")}</p>
        <div className="pack-view-toggle">
          <button
            type="button"
            aria-pressed={view === "rendered"}
            onClick={() => setView("rendered")}
          >
            {t("pack.viewRendered")}
          </button>
          <button type="button" aria-pressed={view === "raw"} onClick={() => setView("raw")}>
            {t("pack.viewRaw")}
          </button>
        </div>
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
      {error !== null && <p className="error">{error}</p>}
      {markdown !== null &&
        (view === "raw" ? (
          <pre className="pack-text">{markdown}</pre>
        ) : (
          <MarkdownContent content={markdown} />
        ))}
      {exportedPath !== null && (
        <p className="export-success">{t("pack.exportedTo", { path: exportedPath })}</p>
      )}
    </div>
  );
}
