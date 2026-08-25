import { type FormEvent, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";
import { classifyUnlockResult } from "../state/unlock-outcome.js";

export interface UnlockSuccess {
  fork?: { generation: number; writer: string; noticeCode: string };
}

export interface UnlockCredential {
  passphrase?: string;
  recoveryKeyHex?: string;
}

type ForkNotice = NonNullable<UnlockSuccess["fork"]>;

/** `exactOptionalPropertyTypes` needs the key omitted entirely, not set to `undefined`. */
export function toUnlockSuccess(fork: ForkNotice | undefined): UnlockSuccess {
  return fork === undefined ? {} : { fork };
}

export function LockedScreen({
  bridge,
  onUnlocked,
  onUpgradeRequired,
  onOpenSettings,
}: {
  bridge: ValijaBridge;
  onUnlocked: (result: UnlockSuccess) => void;
  onUpgradeRequired: (credential: UnlockCredential) => void;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setUnlocking(true);
    // The passphrase/recovery key crosses renderer -> main once and is not
    // retained here afterwards (§5.1) — `value` is only cleared on
    // unmount/navigation, never re-sent or logged.
    const credential = useRecoveryKey ? { recoveryKeyHex: value } : { passphrase: value };
    const result = await bridge.vault.unlock(credential);
    setUnlocking(false);
    const outcome = classifyUnlockResult(result);
    switch (outcome.kind) {
      case "upgrade-required":
        onUpgradeRequired(credential);
        return;
      case "error":
        setError(errorCopy(outcome.code));
        return;
      case "unlocked":
        onUnlocked(toUnlockSuccess(outcome.fork));
    }
  }

  return (
    <div className="screen">
      {/* The gear reaches the locked screen too (§4.8 step 37, item 89) — it's
          one of the screens that has to be readable in the user's language
          and theme. */}
      <button type="button" className="settings-gear" onClick={onOpenSettings}>
        {t("common.settings")}
      </button>
      <h1>{t("locked.title")}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          {useRecoveryKey ? t("locked.recoveryKeyLabel") : t("locked.passphraseLabel")}
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={unlocking}
          />
        </label>
        {error !== null && <p className="error">{error}</p>}
        <button type="submit" disabled={unlocking}>
          {t("locked.unlock")}
        </button>
      </form>
      <button type="button" onClick={() => setUseRecoveryKey((v) => !v)}>
        {t("locked.useRecoveryKey")}
      </button>
    </div>
  );
}

/** VAULT_FORK_DETECTED, rendered from the code (D-I) — no merge, no "keep this one", no delete affordance. */
export function ForkNoticeBanner({
  writer,
  vaultPath,
  onOpenSync,
}: {
  writer: string;
  vaultPath: string;
  onOpenSync: () => void;
}) {
  const t = useT();
  return (
    <div className="fork-notice">
      <h2>{t("locked.forkTitle")}</h2>
      <p>{t("locked.forkBody", { vaultPath })}</p>
      <button type="button" onClick={onOpenSync}>
        {t("locked.goToSync")}
      </button>
      <span className="sr-only">{writer}</span>
    </div>
  );
}
