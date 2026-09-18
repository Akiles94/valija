import type { RefObject } from "react";
import type { ImportOutcomeResponse } from "../../../shared/ipc/messages.js";
import { useT } from "../../state/i18n-context.js";

/**
 * The single busy/error/result region (D-4), moved verbatim from import.tsx
 * (GUI-LAYOUT slice 10c) — always mounted, exactly one, so an assistive-tech
 * user gets it announced before it ever has content, and so a `loadListing`
 * error can land here even while `stage` is still "choose". `statusRef` is a
 * plain prop, not `forwardRef` — React 19 needs no wrapper for a ref this
 * component owns and never re-exposes.
 */
export function ImportStatus({
  ariaBusy,
  busyMessage,
  error,
  resultOutcome,
  resultMode,
  resolvedProjectName,
  statusRef,
}: {
  ariaBusy: boolean;
  busyMessage: string | null;
  error: string | null;
  resultOutcome: ImportOutcomeResponse | null;
  resultMode: "preview" | "import" | null;
  resolvedProjectName: string | null;
  statusRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
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
            {t(resultMode === "preview" ? "import.previewSummary" : "import.importSummary", {
              itemCount: resultOutcome.imported,
              conversationCount: resultOutcome.conversations,
              project: resolvedProjectName ?? "",
              skipped: resultOutcome.skipped,
              failed: resultOutcome.failed,
            })}
          </p>
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
          {resultMode === "import" && <p>{t("import.excludedFromPacksNotice")}</p>}
        </div>
      )}
    </div>
  );
}
