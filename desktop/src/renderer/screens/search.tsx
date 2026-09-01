import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { formatDate } from "../../shared/i18n/format.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";

interface SearchHit {
  id: string;
  project: string;
  type: string;
  content: string;
  createdAt: string;
}

const ALL_PROJECTS = "";

/** `SearchContext`, with optional project narrowing (§9 item 54). */
export function SearchScreen({ bridge }: { bridge: ValijaBridge }) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();
  const [projects, setProjects] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [projectScope, setProjectScope] = useState<string>(ALL_PROJECTS);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          {results.length === 0 && <p className="empty-title">{t("search.noResults")}</p>}
          <ul className="search-results">
            {results.map((hit) => (
              <li key={hit.id} className="search-result">
                <span className="hit-project">{hit.project}</span>
                <span className="hit-type">{hit.type}</span>
                <span className="hit-date">{formatDate(new Date(hit.createdAt), language)}</span>
                <p className="hit-content">{hit.content}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
