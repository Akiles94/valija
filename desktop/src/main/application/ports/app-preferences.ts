import type { Language } from "../../shared/i18n/languages.js";

export type SystemOr<T> = "system" | T;

export interface AppPreferences {
  vaultPath: string | null; // D-R(a) — location hint, never configuration
  theme: SystemOr<"light" | "dark">; // D-Q
  language: SystemOr<Language>; // D-V
  tourSeen: boolean; // D-U(b)
}

export interface AppPreferencesStore {
  read(): AppPreferences;
  write(next: AppPreferences): void;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  vaultPath: null,
  theme: "system",
  language: "system",
  tourSeen: false,
};
