import { useEffect, useState } from "react";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";
import { toUnlockSuccess, type UnlockCredential, type UnlockSuccess } from "./locked.js";

/**
 * Shown only on `VAULT_UPGRADE_REQUIRED` (D-J(b)). Cancel leaves the vault
 * locked and untouched; Continue re-unlocks with `upgradeConfirmed: true`,
 * the same shared `migrate()` path every CLI command already takes. A
 * first-run vault (created by this app) never sees this screen — `CreateVault`
 * always migrates to `LATEST_SCHEMA_VERSION` before returning.
 */
export function MigrationConfirmScreen({
  bridge,
  credential,
  dbPath,
  onCancel,
  onUnlocked,
}: {
  bridge: ValijaBridge;
  credential: UnlockCredential;
  /** For the backup-path sentence, matching migrations.ts's own `${dbPath}.pre-NNN.bak` naming. */
  dbPath: string;
  onCancel: () => void;
  onUnlocked: (result: UnlockSuccess) => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: checked exactly once, on mount, against the credential that triggered VAULT_UPGRADE_REQUIRED
  useEffect(() => {
    let cancelled = false;
    bridge.vault.upgradeCheck(credential).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(errorCopy(result.error.code));
        return;
      }
      if (result.value.backsUpCiphertext) {
        const suffix = String(result.value.to).padStart(3, "0");
        setBackupPath(`${dbPath}.pre-${suffix}.bak`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirm() {
    setConfirming(true);
    const result = await bridge.vault.unlock({ ...credential, upgradeConfirmed: true });
    setConfirming(false);
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    onUnlocked(toUnlockSuccess(result.value.fork));
  }

  return (
    <div className="screen">
      <h1>{t("migration.title")}</h1>
      <p>{t("migration.body")}</p>
      {backupPath !== null && <p>{t("migration.backupNotice", { backupPath })}</p>}
      {error !== null && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={confirming}>
          {t("migration.cancel")}
        </button>
        <button type="button" onClick={handleConfirm} disabled={confirming}>
          {t("migration.confirm")}
        </button>
      </div>
    </div>
  );
}
