import { useEffect, useState } from "react";
import { formatCount } from "../../shared/i18n/format.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";

interface SyncData {
  dbPath: string;
  atRest: boolean;
  generation?: number;
  lastWriterIsThisDevice?: boolean;
  autoLockTtlMinutes: number | null;
  looksLikeCloud: boolean;
  conflictedCopiesCount: number;
  staleBackupsCount: number;
  resolvedStateHome: string;
}

/**
 * A pure read over `VaultStatusOutput` + `VaultFolderInspection` (§9 item 56)
 * — displayed, never editable (D-U(d)). No "resolve" button for a conflict
 * (D-I): `sync.conflictGuidance` is the only guidance this screen gives.
 */
export function SyncScreen({
  bridge,
  onMoveVault,
}: {
  bridge: ValijaBridge;
  onMoveVault: () => void;
}) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();
  const [data, setData] = useState<SyncData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    let cancelled = false;
    Promise.all([bridge.vault.status(), bridge.sync.status()]).then(([statusResult, sync]) => {
      if (cancelled) return;
      if (!statusResult.ok) {
        setError(errorCopy(statusResult.error.code));
        return;
      }
      const status = statusResult.value;
      setData({
        dbPath: status.dbPath,
        atRest: status.sidecars.length === 0,
        ...(status.generation === undefined ? {} : { generation: status.generation }),
        ...(status.lastWriterIsThisDevice === undefined
          ? {}
          : { lastWriterIsThisDevice: status.lastWriterIsThisDevice }),
        autoLockTtlMinutes: status.autoLock.ttlMinutes,
        looksLikeCloud: sync.looksLikeCloud,
        conflictedCopiesCount: sync.conflictedCopies.length,
        staleBackupsCount: sync.staleBackups.length,
        resolvedStateHome: sync.resolvedStateHome,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return (
      <div className="screen sync">
        <h1>{t("sync.title")}</h1>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="screen sync">
        <h1>{t("sync.title")}</h1>
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="screen sync">
      <h1>{t("sync.title")}</h1>

      <p>
        <span className="label">{t("sync.vaultFolder")}</span> <span>{data.dbPath}</span>
      </p>
      <p>{data.looksLikeCloud ? t("sync.looksLikeCloud") : t("sync.notRecognizedAsCloud")}</p>

      {data.conflictedCopiesCount > 0 && (
        <p className="warning">
          {t("sync.conflictedCopiesFound", { count: data.conflictedCopiesCount })}
        </p>
      )}
      {data.staleBackupsCount > 0 && (
        <p className="warning">{t("sync.staleBackupsFound", { count: data.staleBackupsCount })}</p>
      )}
      {(data.conflictedCopiesCount > 0 || data.staleBackupsCount > 0) && (
        <p className="explainer">{t("sync.conflictGuidance")}</p>
      )}

      <p>{data.atRest ? t("sync.atRest") : t("sync.notAtRest")}</p>

      {data.generation !== undefined && (
        <p>
          {t("sync.generation", { generation: formatCount(data.generation, language) })}
          {" — "}
          {data.lastWriterIsThisDevice === true
            ? t("sync.lastWriterThisDevice")
            : t("sync.lastWriterOtherDevice")}
        </p>
      )}

      <p>
        {data.autoLockTtlMinutes === null
          ? t("sync.autoLockDisabled")
          : t("sync.autoLock", { minutes: formatCount(data.autoLockTtlMinutes, language) })}
      </p>

      <p>
        <span className="label">{t("sync.stateHome")}</span> <span>{data.resolvedStateHome}</span>
      </p>

      <button type="button" onClick={onMoveVault}>
        {t("sync.moveVault")}
      </button>
    </div>
  );
}
