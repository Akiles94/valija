import { useT } from "../state/i18n-context.js";
import type { WorkspaceView } from "../state/workspace-nav.js";

/** The three top-level destinations inside the unlocked workspace; project/pack-preview are drill-downs, reached from Dashboard. The gear (Settings, §4.8 step 37) is reachable from every one of them. */
export function NavBar({
  active,
  onNavigate,
  onOpenSettings,
}: {
  active: WorkspaceView["screen"];
  onNavigate: (screen: "dashboard" | "search" | "sync") => void;
  onOpenSettings: () => void;
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
        className={active === "sync" ? "active" : ""}
        onClick={() => onNavigate("sync")}
      >
        {t("sync.title")}
      </button>
      <button type="button" className="settings-gear" onClick={onOpenSettings}>
        {t("common.settings")}
      </button>
    </nav>
  );
}
