import type { RefObject } from "react";
import type { ImportOutcomeResponse } from "../../../shared/ipc/messages.js";
import { useT } from "../../state/i18n-context.js";
import { BlockingChunkList } from "./blocking-chunk-list.js";

/**
 * The single busy/error/result region (D-4), moved verbatim from import.tsx
 * (GUI-LAYOUT slice 10c) — always mounted, exactly one, so an assistive-tech
 * user gets it announced before it ever has content, and so a `loadListing`
 * error can land here even while `stage` is still "choose". `statusRef` is a
 * plain prop, not `forwardRef` — React 19 needs no wrapper for a ref this
 * component owns and never re-exposes.
 *
 * SECRET-WARN: a refused Preview adds the would-be-refused line and the
 * blocking list (no buttons — Preview never writes). A refused Import shows
 * the refusal in place of the summary, the list, and the two ways forward.
 */
export function ImportStatus({
  ariaBusy,
  busyMessage,
  error,
  resultOutcome,
  resultMode,
  resolvedProjectName,
  statusRef,
  onUncheckBlocking,
  onImportAnyway,
}: {
  ariaBusy: boolean;
  busyMessage: string | null;
  error: string | null;
  resultOutcome: ImportOutcomeResponse | null;
  resultMode: "preview" | "import" | null;
  resolvedProjectName: string | null;
  statusRef: RefObject<HTMLDivElement | null>;
  onUncheckBlocking: () => void;
  onImportAnyway: () => void;
}) {
  const t = useT();
  const refusedImport = resultMode === "import" && resultOutcome?.refused === true;
  return (
    <div className="import-status" aria-live="polite" aria-busy={ariaBusy} ref={statusRef}>
      {busyMessage !== null && (
        <>
          <p className="import-busy">{busyMessage}</p>
          <p className="explainer">{t("import.mayStopResponding")}</p>
        </>
      )}
      {error !== null && <p className="error">{error}</p>}
      {resultOutcome !== null && resultMode !== null && (
        <div className="import-result">
          <p>
            {refusedImport
              ? t("import.refused", { count: resultOutcome.blockingChunks.length })
              : t(resultMode === "preview" ? "import.previewSummary" : "import.importSummary", {
                  itemCount: resultOutcome.imported,
                  conversationCount: resultOutcome.conversations,
                  project: resolvedProjectName ?? "",
                  skipped: resultOutcome.skipped,
                  failed: resultOutcome.failed,
                })}
          </p>
          {resultMode === "preview" && resultOutcome.refused && (
            <p>{t("import.wouldBeRefused", { count: resultOutcome.blockingChunks.length })}</p>
          )}
          {resultOutcome.refused && <BlockingChunkList chunks={resultOutcome.blockingChunks} />}
          {refusedImport && (
            <>
              <p>{t("import.blockingRemedy")}</p>
              <div className="actions">
                <button type="button" onClick={onUncheckBlocking}>
                  {t("import.uncheckBlocking")}
                </button>
                <button type="button" onClick={onImportAnyway}>
                  {t("import.importAnyway")}
                </button>
              </div>
            </>
          )}
          {resultOutcome.failures.length > 0 && (
            <ul className="import-failures">
              {resultOutcome.failures.map((failure) => (
                <li key={`${failure.conversation}-${failure.reason}`}>
                  {t("import.perConversationFailure", {
                    title: failure.conversation,
                    reason: failure.reason,
                  })}
                </li>
              ))}
            </ul>
          )}
          {resultMode === "import" && !refusedImport && (
            <p>{t("import.excludedFromPacksNotice")}</p>
          )}
        </div>
      )}
    </div>
  );
}
