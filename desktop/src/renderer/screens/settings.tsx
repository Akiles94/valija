import { type KeyboardEvent, useRef, useState } from "react";
import type { TranslationKey } from "../../shared/i18n/translate.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";
import { useT } from "../state/i18n-context.js";
import { nextTabId } from "../state/tab-navigation.js";

type ThemeChoice = AppPreferencesMessage["theme"];
type LanguageChoice = AppPreferencesMessage["language"];

/** D-21b: a list, not four hardcoded branches — a fifth section (CONNECT's forward-compat seam) becomes an addition here, never added in this advance. */
const SECTIONS = [
  { id: "appearance", title: "settings.appearance" },
  { id: "language", title: "settings.language" },
  { id: "vaultAndSync", title: "settings.vaultAndSync" },
  { id: "help", title: "settings.help" },
] as const satisfies ReadonlyArray<{ id: string; title: TranslationKey }>;

type SectionId = (typeof SECTIONS)[number]["id"];
const SECTION_IDS = SECTIONS.map((section) => section.id);

/**
 * §4.8, D-U(d). Reachable while the vault is locked (item 88) — this
 * component never imports `bridge.js` and calls no IPC of any kind; the
 * caller in `app.tsx` owns reading and writing preferences. Exactly four
 * sections and no fifth. Vault & sync **links** to the existing Diagnostics
 * screen and the existing relocation wizard rather than re-rendering their
 * data (P-D12) — the environment-resolved values stay the Sync panel's one
 * display. Not a config editor: no field here can set `VALIJA_HOME`,
 * `VALIJA_STATE_HOME` or `VALIJA_AUTOLOCK_MINUTES`, and nothing here can
 * destroy, re-key or re-initialize a vault. GUI-LAYOUT §5.10, D-16: still a
 * full-screen replacement, restyled as mini-tabs — not a layered modal.
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
  const [active, setActive] = useState<SectionId>("appearance");
  const tabRefs = useRef<Partial<Record<SectionId, HTMLButtonElement>>>({});

  function handleTablistKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabId(SECTION_IDS, active, event.key);
    if (next === active) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="screen settings">
      <h1>{t("settings.title")}</h1>

      <div
        role="tablist"
        aria-label={t("settings.title")}
        className="settings-tabs"
        onKeyDown={handleTablistKeyDown}
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`settings-tab-${section.id}`}
            aria-selected={active === section.id}
            aria-controls={`settings-panel-${section.id}`}
            tabIndex={active === section.id ? 0 : -1}
            ref={(el) => {
              if (el) tabRefs.current[section.id] = el;
            }}
            onClick={() => setActive(section.id)}
          >
            {t(section.title)}
          </button>
        ))}
      </div>

      {active === "appearance" && (
        <div
          role="tabpanel"
          id="settings-panel-appearance"
          aria-labelledby="settings-tab-appearance"
        >
          <fieldset className="segmented">
            <legend className="sr-only">{t("settings.appearance")}</legend>
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
                <span>{t(key)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {active === "language" && (
        <div role="tabpanel" id="settings-panel-language" aria-labelledby="settings-tab-language">
          <fieldset className="segmented">
            <legend className="sr-only">{t("settings.language")}</legend>
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
                  onChange={() => onUpdatePreferences({ language: value })}
                />
                <span>{t(key)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}

      {active === "vaultAndSync" && (
        <div
          role="tabpanel"
          id="settings-panel-vaultAndSync"
          aria-labelledby="settings-tab-vaultAndSync"
        >
          {/* Both actions mount an existing, already-reviewed screen inside
              `Workspace`, which exists only while unlocked — so they're
              hidden rather than reachable-but-broken while locked. This is a
              known narrowing of refined.md §4.8 step 40 (recorded per
              review.md's W1, not silently shipped): it leaves someone who
              cannot unlock with no route to "Check my setup", even though
              diagnostics itself runs fine on a locked vault. Carried forward
              for Slice 12 (docs.gui.md) and a refined.md amendment, rather
              than hoisting either screen to overlay level in this slice. */}
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
        </div>
      )}

      {active === "help" && (
        <div role="tabpanel" id="settings-panel-help" aria-labelledby="settings-tab-help">
          <button type="button" onClick={onReplayTour}>
            {t("settings.replayTour")}
          </button>
        </div>
      )}

      <button type="button" onClick={onClose}>
        {t("common.close")}
      </button>
    </div>
  );
}
