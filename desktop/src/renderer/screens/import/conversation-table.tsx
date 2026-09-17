import { formatDate } from "../../../shared/i18n/format.js";
import type { Language } from "../../../shared/i18n/languages.js";
import type { ImportListingRow } from "../../../shared/ipc/messages.js";
import { SortArrowIcon } from "../../components/icons.js";
import { useT } from "../../state/i18n-context.js";
import type { SortDirection, VisibleSelectionState } from "../../state/import-selection.js";

/**
 * The listing as a table (GUI-LAYOUT §5.6, D-13's rider): a bounded, sticky-
 * header scroll region (IMPORT-FEEDBACK D-6's `max-height: 320px` carried
 * over unchanged) so 100+ rows stay navigable. The header checkbox's
 * indeterminate state is set imperatively through a ref callback — React has
 * no `indeterminate` prop, and a ref callback avoids adding a `useEffect`.
 */
export function ConversationTable({
  rows,
  checked,
  disabled,
  headerState,
  sortDirection,
  language,
  onToggleRow,
  onToggleVisible,
  onToggleSort,
}: {
  rows: readonly ImportListingRow[];
  checked: ReadonlySet<number>;
  disabled: boolean;
  headerState: VisibleSelectionState;
  sortDirection: SortDirection;
  language: Language;
  onToggleRow: (index: number) => void;
  onToggleVisible: () => void;
  onToggleSort: () => void;
}) {
  const t = useT();
  return (
    <div className="conversation-scroll">
      <table className="conversation-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label={
                  headerState === "all"
                    ? t("import.deselectAllVisible")
                    : t("import.selectAllVisible")
                }
                disabled={disabled}
                checked={headerState === "all"}
                ref={(el) => {
                  if (el) el.indeterminate = headerState === "some";
                }}
                onChange={onToggleVisible}
              />
            </th>
            <th>{t("import.columnTitle")}</th>
            <th aria-sort={sortDirection === "asc" ? "ascending" : "descending"}>
              <button
                type="button"
                className="sort-button"
                disabled={disabled}
                onClick={onToggleSort}
              >
                {t("import.columnDate")}
                <span className={`sort-arrow ${sortDirection}`}>
                  <SortArrowIcon />
                </span>
              </button>
            </th>
            <th>{t("import.columnChunks")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index}>
              <td>
                <input
                  type="checkbox"
                  aria-label={row.title}
                  disabled={disabled}
                  checked={checked.has(row.index)}
                  onChange={() => onToggleRow(row.index)}
                />
              </td>
              <td className="conversation-title">{row.title}</td>
              <td className="conversation-date">{formatDate(new Date(row.date), language)}</td>
              <td className="conversation-chunks">{row.estimatedChunks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
