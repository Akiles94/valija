import type { ReactNode } from "react";
import { useT } from "../state/i18n-context.js";
import { BrandMark } from "./icons.js";

/**
 * The pre-unlock entry cluster's split shell (No vault / Create vault /
 * Locked / Migration confirm — GUI-LAYOUT §5.11, D-20). The brand panel is a
 * static dark subtree via the existing `data-theme` mechanism, the same one
 * `recovery-kit.tsx` uses (D-Q) — no new custom property, and this file must
 * never import theme-context.
 */
export function EntryShell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="entry-shell">
      <aside className="entry-brand" data-theme="dark">
        <div className="entry-brand-mark">
          <BrandMark />
          <span>{t("common.appName")}</span>
        </div>
        <p className="entry-tagline">{t("entry.tagline")}</p>
        <ul className="entry-trust">
          <li>{t("entry.trustEncrypted")}</li>
          <li>{t("entry.trustPassphrase")}</li>
          <li>{t("entry.trustTools")}</li>
        </ul>
      </aside>
      <div className="entry-content">{children}</div>
    </div>
  );
}
