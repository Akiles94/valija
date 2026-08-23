import { createContext, type ReactNode, useContext, useMemo } from "react";
import { resolveSystemOrOverride } from "../../main/application/policies/system-or-override.js";
import { copyForErrorCode } from "../../shared/i18n/error-copy.js";
import { type Language, matchLanguage } from "../../shared/i18n/languages.js";
import { createTranslator, type Translator } from "../../shared/i18n/translate.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";

/**
 * `resolveSystemOrOverride`/`matchLanguage` are pure, dependency-free
 * functions (no Electron/Node import) shared by main and renderer alike —
 * "build once, use twice" (D-Q) extends to a third consumer here rather than
 * re-deriving the resolution over IPC.
 */
interface I18nValue {
  language: Language;
  translator: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  preferences,
  children,
}: {
  preferences: AppPreferencesMessage;
  children: ReactNode;
}) {
  const value = useMemo((): I18nValue => {
    const osLanguage = matchLanguage(navigator.language);
    const language = resolveSystemOrOverride(preferences.language, osLanguage);
    return { language, translator: createTranslator(language) };
  }, [preferences.language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) throw new Error("useT()/useErrorCopy() called outside an I18nProvider");
  return value;
}

export function useT() {
  return useI18n().translator.t;
}

/** D-V(d) made structural: every screen renders an error's `code`, never `DomainError.message`, through this. */
export function useErrorCopy() {
  const { language } = useI18n();
  return (code: string) => copyForErrorCode(code, language);
}
