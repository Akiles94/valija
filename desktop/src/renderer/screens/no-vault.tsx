import { useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

/**
 * The mirror flow (§4.7's last line): "I already have one" records where an
 * existing vault lives — and re-points already-connected clients — without
 * moving anything. It shares `relocation:pointAtExisting` with the full
 * wizard's own final step rather than a second implementation.
 */
export function NoVaultScreen({
  bridge,
  onCreateVault,
  onPointedAtExisting,
}: {
  bridge: ValijaBridge;
  onCreateVault: () => void;
  onPointedAtExisting: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handlePointAtExisting() {
    const chosen = await bridge.dialog.chooseVaultFolder();
    if (chosen === null) return;
    setError(null);
    setChecking(true);
    const result = await bridge.relocation.pointAtExisting({ handle: chosen.handle });
    setChecking(false);
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    onPointedAtExisting();
  }

  return (
    <div className="screen">
      <h1>{t("noVault.title")}</h1>
      <div className="actions">
        <button type="button" onClick={onCreateVault} disabled={checking}>
          {t("noVault.createVault")}
        </button>
        <button type="button" onClick={() => void handlePointAtExisting()} disabled={checking}>
          {t("noVault.haveOne")}
        </button>
      </div>
      <p className="explainer">{t("noVault.haveOneExplainer")}</p>
      {error !== null && <p className="error">{error}</p>}
    </div>
  );
}
