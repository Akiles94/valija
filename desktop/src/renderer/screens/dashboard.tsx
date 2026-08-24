import { useEffect, useState } from "react";
import { formatDate } from "../../shared/i18n/format.js";
import type { ValijaBridge } from "../state/bridge.js";
import { wireFocusRefresh } from "../state/focus-refresh.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";

interface ProjectRow {
  name: string;
  description?: string;
  itemCount: number;
  lastActivityAt: string | null;
}

/** `ListProjects`, the same rows `valija projects` prints — same use case, same order (§9). */
export function DashboardScreen({
  bridge,
  onSelectProject,
  onConnectTool,
  onImportHistory,
}: {
  bridge: ValijaBridge;
  onSelectProject: (project: string) => void;
  onConnectTool: () => void;
  onImportHistory: () => void;
}) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    let cancelled = false;
    function load() {
      bridge.content.projects().then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(errorCopy(result.error.code));
          return;
        }
        setProjects(result.value);
      });
    }
    load();
    // No setInterval anywhere — refreshes on mount and on window focus only.
    const unwireFocus = wireFocusRefresh(window, load);
    return () => {
      cancelled = true;
      unwireFocus();
    };
  }, []);

  if (error !== null) {
    return (
      <div className="screen dashboard">
        <h1>{t("dashboard.title")}</h1>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (projects === null) {
    return (
      <div className="screen dashboard">
        <h1>{t("dashboard.title")}</h1>
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="screen dashboard">
        <h1>{t("dashboard.title")}</h1>
        <p className="empty-title">{t("dashboard.emptyTitle")}</p>
        <div className="actions">
          <button type="button" onClick={onConnectTool}>
            {t("dashboard.connectATool")}
          </button>
          <button type="button" onClick={onImportHistory}>
            {t("dashboard.importHistory")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen dashboard">
      <h1>{t("dashboard.title")}</h1>
      <ul className="project-cards">
        {projects.map((project) => (
          <li key={project.name}>
            <button
              type="button"
              className="project-card"
              onClick={() => onSelectProject(project.name)}
            >
              <span className="project-name">{project.name}</span>
              <span className="project-item-count">
                {t("dashboard.itemCount", { count: project.itemCount })}
              </span>
              {project.lastActivityAt !== null && (
                <span className="project-last-activity">
                  {t("dashboard.lastActivity", {
                    date: formatDate(new Date(project.lastActivityAt), language),
                  })}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
