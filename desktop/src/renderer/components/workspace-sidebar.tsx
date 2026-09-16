import type { ReactNode } from "react";
import type { TranslationKey } from "../../shared/i18n/translate.js";
import { useT } from "../state/i18n-context.js";
import type { NavDestination } from "../state/workspace-nav.js";
import { NAV_DESTINATIONS } from "../state/workspace-nav.js";
import {
  BrandMark,
  ConnectIcon,
  DashboardIcon,
  GearIcon,
  LockIcon,
  SearchIcon,
  SyncIcon,
} from "./icons.js";

const NAV_LABELS: Record<NavDestination, TranslationKey> = {
  dashboard: "dashboard.title",
  search: "search.title",
  "connect-tools": "connect.navLabel",
  sync: "sync.title",
};

const NAV_ICONS: Record<NavDestination, ReactNode> = {
  dashboard: <DashboardIcon />,
  search: <SearchIcon />,
  "connect-tools": <ConnectIcon />,
  sync: <SyncIcon />,
};

/** The left-hand primary nav (GUI-LAYOUT §5.0, D-1, D-2). Driven from `NAV_DESTINATIONS` rather than four hardcoded buttons, so a future fifth destination is a list edit, not a rewrite (D-21a). */
export function WorkspaceSidebar({
  active,
  onNavigate,
  onOpenSettings,
  onLock,
}: {
  active: NavDestination | null;
  onNavigate: (destination: NavDestination) => void;
  onOpenSettings: () => void;
  onLock: () => void;
}) {
  const t = useT();
  return (
    <nav className="sidebar" aria-label={t("shell.primaryNav")}>
      <div className="brand">
        <BrandMark />
        <span>{t("common.appName")}</span>
      </div>
      {NAV_DESTINATIONS.map((destination) => (
        <button
          key={destination}
          type="button"
          className={active === destination ? "active" : ""}
          aria-current={active === destination ? "page" : undefined}
          onClick={() => onNavigate(destination)}
        >
          {NAV_ICONS[destination]}
          {t(NAV_LABELS[destination])}
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button type="button" className="lock-button" onClick={onLock}>
        <LockIcon />
        {t("common.lockNow")}
      </button>
      <button type="button" className="settings-gear" onClick={onOpenSettings}>
        <GearIcon />
        {t("common.settings")}
      </button>
    </nav>
  );
}
