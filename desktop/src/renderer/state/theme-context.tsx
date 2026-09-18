import { createContext, type ReactNode, useContext, useMemo } from "react";
import { resolveTheme, type Theme } from "../../main/application/policies/theme-resolution.js";
import type { AppPreferencesMessage } from "../../shared/ipc/messages.js";

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  preferences,
  children,
}: {
  preferences: AppPreferencesMessage;
  children: ReactNode;
}) {
  const theme = useMemo(() => {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return resolveTheme(preferences, systemPrefersDark);
  }, [preferences]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/**
 * The recovery-kit screen deliberately never calls this (D-Q's exception,
 * enforced structurally by that screen not importing this hook at all,
 * rather than by a runtime check).
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error("useTheme() called outside a ThemeProvider");
  return theme;
}
