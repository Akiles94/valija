import { type FormEvent, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { validateNewPassphrase } from "../state/create-vault-validation.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

export function CreateVaultScreen({
  bridge,
  onCreated,
}: {
  bridge: ValijaBridge;
  onCreated: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Caught here, in the renderer, before any IPC call (§9) — parsePassphrase's
    // own length rule is still enforced by CreateVault, never re-implemented a
    // second time here.
    const validation = validateNewPassphrase(passphrase, confirmation);
    if (validation === "tooShort") {
      setError(t("createVault.minLengthWarning"));
      return;
    }
    if (validation === "mismatch") {
      setError(t("createVault.mismatchError"));
      return;
    }
    setError(null);
    setDeriving(true);
    const result = await bridge.vault.init({ passphrase });
    setDeriving(false);
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    onCreated();
  }

  return (
    <div className="screen">
      <h1>{t("createVault.title")}</h1>
      <p className="warning">{t("createVault.lossWarning")}</p>
      <form onSubmit={handleSubmit}>
        <label>
          {t("createVault.passphraseLabel")}
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={deriving}
          />
        </label>
        <label>
          {t("createVault.passphraseConfirmLabel")}
          <input
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={deriving}
          />
        </label>
        {error !== null && <p className="error">{error}</p>}
        {deriving ? (
          <p>{t("createVault.deriving")}</p>
        ) : (
          <button type="submit">{t("createVault.submit")}</button>
        )}
      </form>
    </div>
  );
}
