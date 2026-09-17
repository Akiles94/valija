import { useT } from "../state/i18n-context.js";
import type { BreadcrumbSegment } from "../state/workspace-chrome.js";
import type { WorkspaceView } from "../state/workspace-nav.js";

/** The drill-down trail above a screen (GUI-LAYOUT §5.0, D-6). Renders nothing for the four top-level nav destinations, whose `workspaceChrome` trail is always empty. */
export function Breadcrumb({
  trail,
  onNavigate,
}: {
  trail: readonly BreadcrumbSegment[];
  onNavigate: (view: WorkspaceView) => void;
}) {
  const t = useT();
  if (trail.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label={t("shell.breadcrumb")}>
      {trail.map((segment, index) => {
        const isFinal = index === trail.length - 1;
        const label = "key" in segment.label ? t(segment.label.key) : segment.label.raw;
        const { target } = segment;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: trail is a pure function of the current view and is never reordered or spliced independently — the whole array is rebuilt whenever the view changes, so an index is a stable key here (and two segments can otherwise share the same label text, e.g. a project named "dashboard").
          <span key={index}>
            {index > 0 && (
              <span className="crumb-sep" aria-hidden="true">
                /
              </span>
            )}
            {isFinal || target === null ? (
              <span aria-current="page">{label}</span>
            ) : (
              <button type="button" onClick={() => onNavigate(target)}>
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
