import { useEffect, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { useT } from "../state/i18n-context.js";

/**
 * §8.2's most consequential screen. Deliberately does NOT import
 * `useTheme` — this screen stays permanently high-contrast dark regardless
 * of the app's theme (D-Q's exception, made structural by the absence of
 * that import, not by a runtime check). The kit text itself is never
 * translated (D-V(d)): only the one explanatory sentence above it is.
 *
 * Before acknowledgement, the only interactive elements on this screen are
 * the Copy key button and the acknowledgement checkbox — no route change is
 * reachable until it is checked (D-U(a)'s hard requirement, enforced here by
 * `onAcknowledged` being the only way this component ever calls out).
 */
export function RecoveryKitScreen({
  bridge,
  onAcknowledged,
}: {
  bridge: ValijaBridge;
  onAcknowledged: () => void;
}) {
  const t = useT();
  const [kitText, setKitText] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Fetched exactly once, on mount — a second read would find the slot
  // already consumed and get null (§8.2).
  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    let cancelled = false;
    bridge.vault.readRecoveryKit().then((response) => {
      if (!cancelled) setKitText(response?.text ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCopy() {
    if (kitText === null) return;
    void bridge.content.copy({ text: kitText });
  }

  function handleContinue() {
    setKitText(null); // renderer state cleared on dismissal (§8.2)
    onAcknowledged();
  }

  return (
    <div className="screen recovery-kit" data-theme="dark">
      <h1>{t("recoveryKit.title")}</h1>
      <p className="explainer">{t("recoveryKit.englishNotice")}</p>
      <pre className="kit-text">{kitText ?? ""}</pre>
      <button type="button" onClick={handleCopy} disabled={kitText === null}>
        {t("recoveryKit.copyKey")}
      </button>
      <p className="warning">{t("recoveryKit.copyKeyWarning")}</p>
      <label>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        {t("recoveryKit.acknowledge")}
      </label>
      <button type="button" disabled={!acknowledged} onClick={handleContinue}>
        {t("recoveryKit.confirm")}
      </button>
    </div>
  );
}
