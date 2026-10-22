import { useEffect, useState } from "react";
import { ITEM_TYPES } from "../../../../src/context/domain/values/item-type.js";
import { BindingsSection } from "../components/bindings-section.js";
import { ItemCard } from "../components/item-card.js";
import { ItemEditDialog } from "../components/item-edit-dialog.js";
import type { ValijaBridge } from "../state/bridge.js";
import { wireFocusRefresh } from "../state/focus-refresh.js";
import { useErrorCopy, useT } from "../state/i18n-context.js";
import {
  type CardAction,
  type ItemAction,
  itemActionsFor,
  performItemAction,
} from "../state/item-actions.js";
import { draftFor, type EditDraft, editRequestFor } from "../state/item-edit.js";
import { partitionPinnedItems } from "../state/pinned-partition.js";

interface ItemRow {
  id: string;
  type: string;
  content: string;
  tags: string[];
  pinned: boolean;
  archived?: boolean;
  createdAt: string;
}

const ALL_TYPES = "";

/**
 * `ShowProject`, the same rows `valija show` prints, with a type filter
 * mirroring `--type` — `imported` included (§9 item 53). The five real item
 * types (`decision`/`progress`/`preference`/.../`handoff`) are domain
 * vocabulary, shown as-is in both languages, exactly like the CLI's own
 * output; only "All types" and "Imported" are catalog copy.
 *
 * Curation (CURATION): each card offers pin/unpin and archive/unarchive; the
 * list reloads after every action. "Show archived" and the Undo notice are
 * in-memory only — never written to preferences.
 *
 * Links (PROJECT-DETECT): the folders and repositories linked to this
 * project, managed by `BindingsSection` right under the toolbar.
 */
export function ProjectScreen({
  bridge,
  project,
  onViewPack,
}: {
  bridge: ValijaBridge;
  project: string;
  onViewPack: (project: string) => void;
}) {
  const t = useT();
  const errorCopy = useErrorCopy();
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [items, setItems] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Kept apart from `error`, which every reload clears — a refused action must outlive the reload it triggers.
  const [actionError, setActionError] = useState<string | null>(null);
  // The item in the edit dialog, plus its save state — in memory only, like everything above.
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge and errorCopy are stable across renders; project/typeFilter/showArchived/reloadToken are the real inputs
  useEffect(() => {
    let cancelled = false;
    function load() {
      setItems(null);
      setError(null);
      bridge.content
        .show({
          project,
          ...(typeFilter === ALL_TYPES ? {} : { type: typeFilter }),
          ...(showArchived ? { includeArchived: true } : {}),
        })
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
  }, [project, typeFilter, showArchived, reloadToken]);

  async function runAction(id: string, action: ItemAction) {
    setBusyId(id);
    setActionError(null);
    try {
      const result = await performItemAction(bridge, id, action);
      if (!result.ok) setActionError(errorCopy(result.error.code));
      setNotice(result.ok && action === "archive" ? id : null);
    } finally {
      setBusyId(null);
      setReloadToken((n) => n + 1);
    }
  }

  function onCardAction(item: ItemRow, action: CardAction) {
    if (action === "edit") {
      setEditError(null);
      setEditing(item);
      return;
    }
    void runAction(item.id, action);
  }

  async function saveEdit(item: ItemRow, draft: EditDraft) {
    const request = editRequestFor(item.id, item, draft);
    if (request === null) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const result = await bridge.content.edit(request);
      if (!result.ok) {
        setEditError(errorCopy(result.error.code));
        return;
      }
      setEditing(null);
      setNotice(null);
      setReloadToken((n) => n + 1);
    } catch {
      // A rejected call (a schema throw, a lost main process) — the same generic copy the import screen uses.
      setEditError(errorCopy("UNEXPECTED"));
    } finally {
      setSaving(false);
    }
  }

  function itemList(rows: ItemRow[]) {
    return (
      <ul className="item-list">
        {rows.map((item) => (
          <ItemCard
            key={item.id}
            type={item.type}
            content={item.content}
            tags={item.tags}
            pinned={item.pinned}
            createdAt={item.createdAt}
            archived={item.archived === true}
            actions={itemActionsFor(item)}
            onAction={(action) => onCardAction(item, action)}
            busy={busyId === item.id}
          />
        ))}
      </ul>
    );
  }

  const live = (items ?? []).filter((item) => !item.archived);
  const archived = (items ?? []).filter((item) => item.archived);
  const { pinned, rest } = partitionPinnedItems(live);

  return (
    <div className="screen project">
      <h1>{project}</h1>
      <div className="project-toolbar">
        <fieldset className="chip-row">
          <legend className="sr-only">{t("project.typeFilterLabel")}</legend>
          <label className="chip">
            <input
              type="radio"
              name="type-filter"
              value={ALL_TYPES}
              checked={typeFilter === ALL_TYPES}
              onChange={() => setTypeFilter(ALL_TYPES)}
            />
            {t("project.typeFilterAll")}
          </label>
          {ITEM_TYPES.map((type) => (
            <label key={type} className="chip">
              <input
                type="radio"
                name="type-filter"
                value={type}
                checked={typeFilter === type}
                onChange={() => setTypeFilter(type)}
              />
              {type}
            </label>
          ))}
          <label className="chip">
            <input
              type="radio"
              name="type-filter"
              value="imported"
              checked={typeFilter === "imported"}
              onChange={() => setTypeFilter("imported")}
            />
            {t("project.typeFilterImported")}
          </label>
          <label className="chip">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            {t("project.showArchived")}
          </label>
        </fieldset>
        <button type="button" onClick={() => onViewPack(project)}>
          {t("pack.title")}
        </button>
      </div>
      <BindingsSection bridge={bridge} project={project} />
      {error !== null && <p className="error">{error}</p>}
      {actionError !== null && <p className="error">{actionError}</p>}
      {notice !== null && (
        <p className="notice">
          {t("project.archivedNotice")}{" "}
          <button
            type="button"
            className="item-action"
            onClick={() => runAction(notice, "unarchive")}
          >
            {t("project.undo")}
          </button>
        </p>
      )}
      {items !== null && items.length === 0 && (
        <p className="empty-title">{t("project.noItems")}</p>
      )}
      {live.length > 0 &&
        (pinned.length === 0 ? (
          itemList(live)
        ) : (
          <>
            <h2 className="item-section-title">{t("project.pinnedSection")}</h2>
            {itemList(pinned)}
            {rest.length > 0 && (
              <>
                <h2 className="item-section-title">{t("project.otherItems")}</h2>
                {itemList(rest)}
              </>
            )}
          </>
        ))}
      {showArchived && archived.length > 0 && (
        <>
          <h2 className="item-section-title">{t("project.archivedSection")}</h2>
          {itemList(archived)}
        </>
      )}
      {editing !== null && (
        <ItemEditDialog
          initial={draftFor(editing)}
          error={editError}
          saving={saving}
          onSave={(draft) => void saveEdit(editing, draft)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
