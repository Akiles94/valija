import { type ChangeEvent, useEffect, useState } from "react";
import { ITEM_TYPES } from "../../../../src/context/domain/values/item-type.js";
import { formatDate } from "../../shared/i18n/format.js";
import type { ValijaBridge } from "../state/bridge.js";
import { wireFocusRefresh } from "../state/focus-refresh.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";

interface ItemRow {
  id: string;
  type: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
}

const ALL_TYPES = "";

/**
 * `ShowProject`, the same rows `valija show` prints, with a type filter
 * mirroring `--type` — `imported` included (§9 item 53). The five real item
 * types (`decision`/`progress`/`preference`/.../`handoff`) are domain
 * vocabulary, shown as-is in both languages, exactly like the CLI's own
 * output; only "All types" and "Imported" are catalog copy.
 */
export function ProjectScreen({
  bridge,
  project,
  onBack,
  onViewPack,
}: {
  bridge: ValijaBridge;
  project: string;
  onBack: () => void;
  onViewPack: (project: string) => void;
}) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge and errorCopy are stable across renders; project/typeFilter are the real inputs
  useEffect(() => {
    let cancelled = false;
    function load() {
      setItems(null);
      setError(null);
      bridge.content
        .show(typeFilter === ALL_TYPES ? { project } : { project, type: typeFilter })
        .then((result) => {
          if (cancelled) return;
          if (!result.ok) {
            setError(errorCopy(result.error.code));
            return;
          }
          setItems(result.value);
        });
    }
    load();
    // No setInterval anywhere — refreshes on mount, on a filter change, and on window focus only.
    const unwireFocus = wireFocusRefresh(window, load);
    return () => {
      cancelled = true;
      unwireFocus();
    };
  }, [project, typeFilter]);

  function handleTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    setTypeFilter(event.target.value);
  }

  return (
    <div className="screen project">
      <button type="button" onClick={onBack}>
        {t("common.back")}
      </button>
      <h1>{project}</h1>
      <div className="actions">
        <select value={typeFilter} onChange={handleTypeChange}>
          <option value={ALL_TYPES}>{t("project.typeFilterAll")}</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
          <option value="imported">{t("project.typeFilterImported")}</option>
        </select>
        <button type="button" onClick={() => onViewPack(project)}>
          {t("pack.title")}
        </button>
      </div>
      {error !== null && <p className="error">{error}</p>}
      {items !== null && items.length === 0 && (
        <p className="empty-title">{t("project.noItems")}</p>
      )}
      {items !== null && items.length > 0 && (
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id} className="item-row">
              <span className="item-type">{item.type}</span>
              <span className="item-date">{formatDate(new Date(item.createdAt), language)}</span>
              {item.pinned && <span className="item-pinned">{t("project.pinned")}</span>}
              {item.tags.length > 0 && <span className="item-tags">{item.tags.join(", ")}</span>}
              <p className="item-content">{item.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
