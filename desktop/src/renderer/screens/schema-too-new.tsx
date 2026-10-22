import { useState } from "react";
import type { SchemaVersionsMessage } from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";

/**
 * Terminal (P-18 (b)): this vault was upgraded by a newer Valija, so this app will neither read nor
 * change it. Deliberately no unlock retry, no upgrade, no relocation, no delete — only Lock (drops
 * this device's session key; LockVault never migrates, F8) and Quit.
 */
export function SchemaTooNewScreen({
  bridge,
  versions,
  onOpenSettings,
  onQuit,
}: {
  bridge: ValijaBridge;
  versions: SchemaVersionsMessage;
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [lockNote, setLockNote] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  async function lockVault() {
    setLocking(true);
    const result = await bridge.vault.lock();
    setLocking(false);
    if (!result.ok) return setLockNote(errorCopy(result.error.code));
    setLockNote(t(result.value.wasUnlocked ? "schemaTooNew.locked" : "schemaTooNew.alreadyLocked"));
  }

  return (
    <div className="screen schema-too-new">
      <button type="button" className="settings-gear" onClick={onOpenSettings}>
        {t("common.settings")}
      </button>
      <h1>{t("schemaTooNew.title")}</h1>
      <p>{t("schemaTooNew.body")}</p>
      <dl className="schema-versions">
        <dt>{t("schemaTooNew.vaultVersion")}</dt>
        <dd>{versions.vaultVersion}</dd>
        <dt>{t("schemaTooNew.supportedVersion")}</dt>
        <dd>{versions.supportedVersion}</dd>
      </dl>
      <p>{t("schemaTooNew.nothingChanged")}</p>
      <p>{t("schemaTooNew.howToFix")}</p>
      {lockNote !== null && <p role="status">{lockNote}</p>}
      <div className="actions">
        <button type="button" onClick={() => void lockVault()} disabled={locking}>
          {t("schemaTooNew.lock")}
        </button>
        <button type="button" onClick={onQuit}>
          {t("schemaTooNew.quit")}
        </button>
      </div>
    </div>
  );
}
