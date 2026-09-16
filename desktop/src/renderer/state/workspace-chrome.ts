import type { TranslationKey } from "../../shared/i18n/translate.js";
import type { NavDestination, WorkspaceView } from "./workspace-nav.js";

export type BreadcrumbLabel = { key: TranslationKey } | { raw: string };

export interface BreadcrumbSegment {
  label: BreadcrumbLabel;
  /** Where this segment navigates; `null` on the final segment, which is plain text with aria-current="page". */
  target: WorkspaceView | null;
}

export interface WorkspaceChrome {
  sidebar: boolean;
  active: NavDestination | null;
  trail: readonly BreadcrumbSegment[];
}

const toDashboard: BreadcrumbSegment = {
  label: { key: "dashboard.title" },
  target: { screen: "dashboard" },
};

/**
 * Derives the shell's "where am I" chrome from a `WorkspaceView`. A switch
 * over `view.screen` with no `default` branch, so a new `WorkspaceView`
 * variant is a typecheck failure here rather than a silent "no chrome".
 */
export function workspaceChrome(view: WorkspaceView): WorkspaceChrome {
  switch (view.screen) {
    case "dashboard":
    case "search":
    case "connect-tools":
    case "sync":
      return { sidebar: true, active: view.screen, trail: [] };

    case "project":
      return {
        sidebar: true,
        active: null,
        trail: [toDashboard, { label: { raw: view.project }, target: null }],
      };

    case "pack-preview":
      return {
        sidebar: true,
        active: null,
        trail: [
          toDashboard,
          { label: { raw: view.project }, target: { screen: "project", project: view.project } },
          { label: { key: "pack.title" }, target: null },
        ],
      };

    case "import":
      return {
        sidebar: true,
        active: null,
        trail: [toDashboard, { label: { key: "import.title" }, target: null }],
      };

    case "diagnostics":
      return {
        sidebar: true,
        active: null,
        trail: [toDashboard, { label: { key: "diagnostics.title" }, target: null }],
      };

    case "relocate-vault":
      return { sidebar: false, active: null, trail: [] };
  }
}
