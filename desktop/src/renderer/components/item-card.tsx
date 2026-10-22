import { useState } from "react";
import { formatDate } from "../../shared/i18n/format.js";
import { isLongContent } from "../content/long-content.js";
import { useLanguage, useT } from "../state/i18n-context.js";
import type { CardAction } from "../state/item-actions.js";
import { MarkdownContent } from "./markdown-content.js";

/**
 * One saved context item, as a card: header (pinned state · type · date),
 * content rendered as light Markdown, an expand/collapse toggle for long
 * content, and tags as individual pills. Renders its own `<li>` so
 * `project.tsx`'s `<ul>` composes it directly — and so a later `search.tsx`
 * pass (deferred, `advances/CARDS/refined.md` §4 Out) can reuse it unchanged.
 *
 * `expanded` is the only state here: never written to preferences, never
 * IPC, never a timer — a filter change or window-focus reload remounts the
 * list (`project.tsx`'s `setItems(null)` before every fetch), which is what
 * resets every card to collapsed with no extra code.
 *
 * The curation props (CURATION) are all optional: with no `actions`, the
 * card renders exactly as before.
 */
export function ItemCard({
  type,
  content,
  tags,
  pinned,
  createdAt,
  archived = false,
  actions = [],
  onAction,
  busy = false,
}: {
  type: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  archived?: boolean;
  actions?: CardAction[];
  onAction?: (action: CardAction) => void;
  busy?: boolean;
}) {
  const t = useT();
  const language = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const collapsible = isLongContent(content);
  const collapsed = collapsible && !expanded;

  return (
    <li className={`item-row${pinned ? " pinned" : ""}${archived ? " archived" : ""}`}>
      <div className="item-header">
        <span className="item-meta">
          {pinned && (
            <>
              <PinnedStar />
              <span className="item-pinned">{t("project.pinned")}</span>
              <span className="item-sep">·</span>
            </>
          )}
          <span className="item-type">{type}</span>
          {archived && (
            <>
              <span className="item-sep">·</span>
              <span className="item-archived">{t("project.archivedBadge")}</span>
            </>
          )}
        </span>
        <span className="item-date">{formatDate(new Date(createdAt), language)}</span>
      </div>

      <div className={collapsed ? "item-content collapsed" : "item-content"}>
        <MarkdownContent content={content} />
        {collapsed && <div className="item-fade" />}
      </div>

      {collapsible && (
        <button
          type="button"
          className="item-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? t("project.showLess") : t("project.showMore")}
        </button>
      )}

      {tags.length > 0 && (
        <div className="item-tags">
          {tags.map((tag) => (
            <span key={tag} className="item-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="item-actions">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="item-action"
              disabled={busy}
              title={action === "archive" ? t("project.archiveHint") : undefined}
              onClick={() => onAction?.(action)}
            >
              {t(`project.${action}`)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function PinnedStar() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 .8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z"
      />
    </svg>
  );
}
