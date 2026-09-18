import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { formatDate } from "../../shared/i18n/format.js";
import { MarkdownContent } from "../components/markdown-content.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";
import { selectedHit } from "../state/search-selection.js";

interface SearchHit {
  id: string;
  project: string;
  type: string;
  content: string;
  createdAt: string;
}

const ALL_PROJECTS = "";

/** `SearchContext`, with optional project narrowing (§9 item 54), as a master-detail split (§5.3, D-7 Option 2). */
export function SearchScreen({
  bridge,
  onOpenProject,
}: {
  bridge: ValijaBridge;
  onOpenProject: (project: string) => void;
}) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();
  const [projects, setProjects] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [projectScope, setProjectScope] = useState<string>(ALL_PROJECTS);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    let cancelled = false;
    bridge.content.projects().then((result) => {
      if (!cancelled && result.ok) setProjects(result.value.map((p) => p.name));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch(nextQuery: string, nextScope: string) {
    if (nextQuery.trim().length === 0) {
      setResults(null);
      setError(null);
      setSelectedId(null);
      return;
    }
    const result = await bridge.content.search(
      nextScope === ALL_PROJECTS ? { query: nextQuery } : { query: nextQuery, project: nextScope },
    );
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    setError(null);
    setResults(result.value);
    setSelectedId(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query, projectScope);
  }

  function handleScopeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextScope = event.target.value;
    setProjectScope(nextScope);
    void runSearch(query, nextScope);
  }

  const hit = results !== null ? selectedHit(results, selectedId) : null;

  return (
    <div className="screen search">
      <h1>{t("search.title")}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={projectScope} onChange={handleScopeChange}>
          <option value={ALL_PROJECTS}>{t("search.scopeAllProjects")}</option>
          {projects.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button type="submit">{t("search.title")}</button>
      </form>
      {error !== null && <p className="error">{error}</p>}
      {results !== null && (
        <>
          <p className="result-count">{t("search.resultCount", { count: results.length })}</p>
          <div className="search-split">
            {results.length === 0 ? (
              <p className="empty-title">{t("search.noResults")}</p>
            ) : (
              <ul className="hit-list">
                {results.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="hit-row"
                      aria-current={row.id === hit?.id}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <span className="hit-project">{row.project}</span>
                      <span className="hit-type">{row.type}</span>
                      <span className="hit-date">
                        {formatDate(new Date(row.createdAt), language)}
                      </span>
                      <span className="hit-preview">{row.content}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="hit-detail">
              {hit === null ? (
                <p className="empty-title">{t("search.noSelection")}</p>
              ) : (
                <>
                  <MarkdownContent content={hit.content} />
                  <button type="button" onClick={() => onOpenProject(hit.project)}>
                    {t("search.openProject")}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
