import { useState } from "react";
import type { TranslationKey } from "../../shared/i18n/translate.js";
import type {
  RelocationClientResult,
  RelocationPreflightResponse,
} from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

type Stage =
  | { step: "choose" }
  | {
      step: "preflight";
      handle: string;
      displayName: string;
      preflight: RelocationPreflightResponse;
    }
  | { step: "moving"; handle: string }
  | {
      step: "moveFailed";
      handle: string;
      displayName: string;
      preflight: RelocationPreflightResponse;
    }
  | { step: "done"; root: string; clientResults: RelocationClientResult[] };

/**
 * §4.7 steps 28–36 — one screen, five stages. No refusal, no client-repoint
 * warning, and no write happens without the user seeing it first (D-R(a)).
 * Reachable from the Sync panel and from `no-vault.tsx`'s mirror flow
 * (Slice 8's `relocation:pointAtExisting`, wired by the caller, not here).
 */
export function RelocateVaultScreen({
  bridge,
  onDone,
}: {
  bridge: ValijaBridge;
  onDone: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [stage, setStage] = useState<Stage>({ step: "choose" });
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleChooseFolder() {
    const chosen = await bridge.dialog.chooseVaultFolder();
    if (chosen === null) return;
    setError(null);
    const result = await bridge.relocation.preflight({ handle: chosen.handle });
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    setStage({
      step: "preflight",
      handle: chosen.handle,
      displayName: chosen.displayName,
      preflight: result.value,
    });
  }

  async function handleConfirmMove() {
    if (stage.step !== "preflight") return;
    const { handle, displayName, preflight } = stage;
    setStage({ step: "moving", handle });
    const result = await bridge.relocation.move({ handle });
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      setStage({ step: "moveFailed", handle, displayName, preflight });
      return;
    }
    setStage({ step: "done", root: result.value.root, clientResults: result.value.clientResults });
  }

  async function handleRetryClient(client: string) {
    setRetrying(client);
    const result = await bridge.relocation.retryClient({ client });
    setRetrying(null);
    if (!result.ok || stage.step !== "done") return;
    setStage({
      ...stage,
      clientResults: stage.clientResults.map((r) => (r.client === client ? result.value : r)),
    });
  }

  function handleCopyEnvLine() {
    if (stage.step !== "done") return;
    void bridge.content.copy({ text: `export VALIJA_HOME="${stage.root}"` });
    setCopied(true);
  }

  return (
    <div className="screen relocate-vault">
      <h1>{t("relocate.title")}</h1>
      <p className="explainer">{t("relocate.explainer")}</p>
      {error !== null && <p className="error">{error}</p>}

      {stage.step === "choose" && (
        <button type="button" onClick={() => void handleChooseFolder()}>
          {t("relocate.chooseFolder")}
        </button>
      )}

      {(stage.step === "preflight" || stage.step === "moveFailed") && (
        <PreflightView stage={stage} onChooseAgain={() => setStage({ step: "choose" })} />
      )}

      {stage.step === "preflight" && stage.preflight.refusalCode === null && (
        <>
          <p className="warning">{t("relocate.lockNotice")}</p>
          <button type="button" onClick={() => void handleConfirmMove()}>
            {t("relocate.confirmMove")}
          </button>
        </>
      )}

      {stage.step === "moving" && <p>{t("relocate.moving")}</p>}

      {stage.step === "done" && (
        <DoneView
          root={stage.root}
          clientResults={stage.clientResults}
          retrying={retrying}
          copied={copied}
          onRetryClient={(client) => void handleRetryClient(client)}
          onCopyEnvLine={handleCopyEnvLine}
          onUnlockAgain={onDone}
        />
      )}
    </div>
  );
}

function PreflightView({
  stage,
  onChooseAgain,
}: {
  stage: Extract<Stage, { step: "preflight" | "moveFailed" }>;
  onChooseAgain: () => void;
}) {
  const t = useT();
  const { displayName, preflight } = stage;

  return (
    <div className="preflight">
      <p>{displayName}</p>
      <p>
        {preflight.looksLikeCloud
          ? t("relocate.folderRecognizedAsCloud")
          : t("relocate.folderNotRecognized")}
      </p>

      {preflight.refusalCode !== null && (
        <>
          <p className="error">{refusalCopy(t, preflight.refusalCode)}</p>
          <button type="button" onClick={onChooseAgain}>
            {t("relocate.chooseFolder")}
          </button>
        </>
      )}

      {stage.step === "moveFailed" && <p className="error">{t("relocate.moveFailed")}</p>}

      {preflight.refusalCode === null && preflight.clients.length > 0 && (
        <>
          <p>{t("relocate.clientsToRepoint")}</p>
          <ul>
            {preflight.clients
              .filter((c) => c.currentlyConnected || c.configUnreadable)
              .map((c) => (
                <li key={c.client}>
                  {c.client}
                  {c.configUnreadable && (
                    <span className="warning">
                      {" "}
                      {t("relocate.clientConfigUnreadable", { client: c.client })}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

function refusalCopy(t: Translate, code: string): string {
  switch (code) {
    case "RELOCATION_DESTINATION_OCCUPIED":
      return t("relocate.refusalOccupied");
    case "RELOCATION_DESTINATION_NESTED":
      return t("relocate.refusalNested");
    case "RELOCATION_SOURCE_UNSETTLED":
      return t("relocate.refusalSourceUnsettled");
    default:
      return t("relocate.refusalUnusable");
  }
}

function DoneView({
  root,
  clientResults,
  retrying,
  copied,
  onRetryClient,
  onCopyEnvLine,
  onUnlockAgain,
}: {
  root: string;
  clientResults: RelocationClientResult[];
  retrying: string | null;
  copied: boolean;
  onRetryClient: (client: string) => void;
  onCopyEnvLine: () => void;
  onUnlockAgain: () => void;
}) {
  const t = useT();
  const rewritten = clientResults.filter((r) => r.outcome === "rewritten").map((r) => r.client);
  const failed = clientResults.filter((r) => r.outcome !== "rewritten");

  return (
    <div className="relocate-done">
      {rewritten.length > 0 && (
        <p>{t("relocate.repointSuccess", { clients: rewritten.join(", ") })}</p>
      )}
      {failed.map((r) => (
        <div key={r.client} className="client-row">
          <p>{t("relocate.repointFailure", { client: r.client })}</p>
          {r.manualSnippet !== undefined && <pre>{r.manualSnippet}</pre>}
          <button
            type="button"
            onClick={() => onRetryClient(r.client)}
            disabled={retrying === r.client}
          >
            {t("common.tryAgain")}
          </button>
        </div>
      ))}
      <p>{t("relocate.envLineIntro")}</p>
      <pre>{`export VALIJA_HOME="${root}"`}</pre>
      <button type="button" onClick={onCopyEnvLine}>
        {copied ? t("relocate.envLineCopied") : t("common.copy")}
      </button>
      <button type="button" onClick={onUnlockAgain}>
        {t("relocate.unlockAgain")}
      </button>
    </div>
  );
}
