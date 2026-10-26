import { type FormEvent, useEffect, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { validateNewPassphrase } from "../state/create-vault-validation.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

/**
 * REKEY's dialog, an overlay above the phase switch so it works locked and unlocked (D-F): it always
 * asks for the current credential — the passphrase, or the recovery key behind the toggle (D-G) —
 * then the new passphrase twice and, in a synced folder, the other-devices confirmation (D-M). It
 * calls `sync.status` once (read-only, for `looksLikeCloud`) and `vault.changePassphrase`, nothing
 * else. On success the Router shows the new kit through the existing recovery-kit screen. Every
 * secret field is cleared after each submit and on cancel.
 */
export function ChangePassphraseScreen({
  bridge,
  onCancel,
  onChanged,
}: {
  bridge: ValijaBridge;
  onCancel: () => void;
  onChanged: (unlockedOnThisDevice: boolean) => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [devicesConfirmed, setDevicesConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is stable for the app's lifetime
  useEffect(() => {
    let cancelled = false;
    bridge.sync.status().then((status) => {
      if (!cancelled) setCloud(status.looksLikeCloud);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const validation = validateNewPassphrase(newPassphrase, confirmation);
  const hint =
    validation === "tooShort" && newPassphrase.length > 0
      ? t("changePassphrase.tooShort")
      : validation === "mismatch" && confirmation.length > 0
        ? t("changePassphrase.mismatch")
        : null;
  const canSubmit =
    !working &&
    cloud !== null &&
    current.length > 0 &&
    validation === null &&
    (!cloud || devicesConfirmed);

  function clearSecrets() {
    setCurrent("");
    setNewPassphrase("");
    setConfirmation("");
  }

  function toggleRecoveryKey(checked: boolean) {
    setUseRecoveryKey(checked);
    setCurrent("");
  }

  function cancel() {
    clearSecrets();
    onCancel();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const credential = useRecoveryKey
      ? { recoveryKeyHex: current.trim() }
      : { passphrase: current };
    setError(null);
    setWorking(true);
    const result = await bridge.vault.changePassphrase({
      current: credential,
      newPassphrase,
      otherDevicesConfirmed: devicesConfirmed,
    });
    clearSecrets();
    setWorking(false);
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    onChanged(result.value.unlockedOnThisDevice);
  }

  return (
    <div className="screen change-passphrase">
      <h1>{t("changePassphrase.title")}</h1>
      <p className="warning">{t("changePassphrase.explainer")}</p>
      <p className="explainer">{t("changePassphrase.oldCopies")}</p>
      <form onSubmit={handleSubmit}>
        <label>
          {useRecoveryKey
            ? t("changePassphrase.recoveryKeyLabel")
            : t("changePassphrase.currentLabel")}
          <input
            type="password"
            autoComplete="off"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={working}
          />
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={useRecoveryKey}
            onChange={(e) => toggleRecoveryKey(e.target.checked)}
            disabled={working}
          />
          {t("changePassphrase.useRecoveryKey")}
        </label>
        <label>
          {t("changePassphrase.newLabel")}
          <input
            type="password"
            autoComplete="new-password"
            value={newPassphrase}
            onChange={(e) => setNewPassphrase(e.target.value)}
            disabled={working}
          />
        </label>
        <label>
          {t("changePassphrase.confirmLabel")}
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={working}
          />
        </label>
        {hint !== null && <p className="error">{hint}</p>}
        {cloud === true && (
          <>
            <p className="warning">{t("changePassphrase.cloudWarning")}</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={devicesConfirmed}
                onChange={(e) => setDevicesConfirmed(e.target.checked)}
                disabled={working}
              />
              {t("changePassphrase.confirmOtherDevices")}
            </label>
          </>
        )}
        <p className="explainer">{t("changePassphrase.otherDevicesAfter")}</p>
        {error !== null && <p className="error">{error}</p>}
        {working ? (
          <p>{t("changePassphrase.working")}</p>
        ) : (
          <div className="actions">
            <button type="submit" disabled={!canSubmit}>
              {t("changePassphrase.submit")}
            </button>
            <button type="button" onClick={cancel}>
              {t("common.cancel")}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
