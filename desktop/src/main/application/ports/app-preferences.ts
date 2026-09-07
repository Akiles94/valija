import type { Language } from "../../../shared/i18n/languages.js";
import type { SystemOr } from "../policies/system-or-override.js";

/**
 * Device-local UI preferences (D-R(a), D-Q, D-U(b), D-V(a)) — never vault
 * content, never key material, never configuration. Originally exactly four
 * keys (§8.4): no "last project viewed", no "resume where you left off", no
 * tour progress counter. CONNECT (D5) deliberately amends that to five,
 * because a device-local, user-chosen auto-lock TTL is a legitimate
 * preference in the same sense as theme/language — not vault content or a
 * secret.
 */
export interface AppPreferences {
  /** D-R(a) — a location hint the app itself remembers; never a resolution rule. `VALIJA_HOME` always wins over it. */
  vaultPath: string | null;
  /** D-Q — follows the OS by default, with a manual override. */
  theme: SystemOr<"light" | "dark">;
  /** D-V — follows the OS by default, with a manual override. */
  language: SystemOr<Language>;
  /** D-U(b) — has this installation seen the welcome tour? Skip sets it too. */
  tourSeen: boolean;
  /** CONNECT D-D/D5 — idle auto-lock TTL in minutes; `null` disables. Feeds the desktop's own SessionGuard directly and, on each client's next Connect press, that client's `env.VALIJA_AUTOLOCK_MINUTES` (D-F: never a silent background rewrite). Default stays 15 — never silently widened. */
  autoLockMinutes: number | null;
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
  autoLockMinutes: 15,
};
