import { useT } from "../state/i18n-context.js";
import type { WorkspaceView } from "../state/workspace-nav.js";

/** The four top-level destinations inside the unlocked workspace; project/pack-preview/relocate-vault/import/diagnostics are drill-downs, reached from Dashboard/Sync. The gear (Settings, §4.8 step 37) and the lock button are reachable from every one of them. */
export function NavBar({
  active,
  onNavigate,
  onOpenSettings,
  onLock,
}: {
  active: WorkspaceView["screen"];
  onNavigate: (screen: "dashboard" | "search" | "connect-tools" | "sync") => void;
  onOpenSettings: () => void;
  onLock: () => void;
}) {
  const t = useT();
  return (
    <nav className="nav-bar">
      <button
        type="button"
        className={active === "dashboard" ? "active" : ""}
        onClick={() => onNavigate("dashboard")}
      >
        {t("dashboard.title")}
      </button>
      <button
        type="button"
        className={active === "search" ? "active" : ""}
        onClick={() => onNavigate("search")}
      >
        {t("search.title")}
      </button>
      <button
        type="button"
        className={active === "connect-tools" ? "active" : ""}
        onClick={() => onNavigate("connect-tools")}
      >
        {t("connect.navLabel")}
      </button>
      <button
        type="button"
        className={active === "sync" ? "active" : ""}
        onClick={() => onNavigate("sync")}
      >
        {t("sync.title")}
      </button>
      <button type="button" className="lock-button" onClick={onLock}>
        {t("common.lockNow")}
      </button>
      <button type="button" className="settings-gear" onClick={onOpenSettings}>
        {t("common.settings")}
      </button>
    </nav>
  );
}
