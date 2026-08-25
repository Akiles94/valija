import type { Language } from "../../shared/i18n/languages.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import { useT } from "../state/i18n-context.js";

type ThemeChoice = AppPreferencesMessage["theme"];
type LanguageChoice = AppPreferencesMessage["language"];

/**
 * §4.8, D-U(d). Reachable while the vault is locked (item 88) — this
 * component never imports `bridge.js` and calls no IPC of any kind; the
 * caller in `app.tsx` owns reading and writing preferences. Exactly four
 * sections and no fifth. Vault & sync **links** to the existing Diagnostics
 * screen and the existing relocation wizard rather than re-rendering their
 * data (P-D12) — the environment-resolved values stay the Sync panel's one
 * display. Not a config editor: no field here can set `VALIJA_HOME`,
 * `VALIJA_STATE_HOME` or `VALIJA_AUTOLOCK_MINUTES`, and nothing here can
 * destroy, re-key or re-initialize a vault.
 */
export function SettingsScreen({
  preferences,
  unlocked,
  onUpdatePreferences,
  onClose,
  onReplayTour,
  onOpenDiagnostics,
  onOpenRelocate,
}: {
  preferences: AppPreferencesMessage;
  unlocked: boolean;
  onUpdatePreferences: (patch: { theme?: ThemeChoice; language?: LanguageChoice }) => void;
  onClose: () => void;
  onReplayTour: () => void;
  onOpenDiagnostics: () => void;
  onOpenRelocate: () => void;
}) {
  const t = useT();

  return (
    <div className="screen settings">
      <h1>{t("settings.title")}</h1>

      <section>
        <h2>{t("settings.appearance")}</h2>
        {(
          [
            ["system", "settings.appearanceSystem"],
            ["light", "settings.appearanceLight"],
            ["dark", "settings.appearanceDark"],
          ] as const
        ).map(([value, key]) => (
          <label key={value}>
            <input
              type="radio"
              name="theme"
              checked={preferences.theme === value}
              onChange={() => onUpdatePreferences({ theme: value })}
            />
            {t(key)}
          </label>
        ))}
      </section>

      <section>
        <h2>{t("settings.language")}</h2>
        {(
          [
            ["system", "settings.languageSystem"],
            ["en", "settings.languageEnglish"],
            ["es", "settings.languageSpanish"],
          ] as const
        ).map(([value, key]) => (
          <label key={value}>
            <input
              type="radio"
              name="language"
              checked={preferences.language === value}
              onChange={() => onUpdatePreferences({ language: value as Language })}
            />
            {t(key)}
          </label>
        ))}
      </section>

      <section>
        <h2>{t("settings.vaultAndSync")}</h2>
        {unlocked ? (
          <>
            <button type="button" onClick={onOpenDiagnostics}>
              {t("settings.openDiagnostics")}
            </button>
            <button type="button" onClick={onOpenRelocate}>
              {t("settings.openRelocate")}
            </button>
            <p className="explainer">{t("settings.vaultAndSyncSeeSync")}</p>
          </>
        ) : (
          <p className="explainer">{t("settings.vaultAndSyncLocked")}</p>
        )}
      </section>

      <section>
        <h2>{t("settings.help")}</h2>
        <button type="button" onClick={onReplayTour}>
          {t("settings.replayTour")}
        </button>
      </section>

      <button type="button" onClick={onClose}>
        {t("common.close")}
      </button>
    </div>
  );
}
