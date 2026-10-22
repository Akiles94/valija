import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ITEM_TYPES } from "../../../../src/context/domain/values/item-type.js";
import { useT } from "../state/i18n-context.js";
import type { EditDraft } from "../state/item-edit.js";

/**
 * The edit dialog (CURATION A1): content, tags and type of one item, mirroring
 * `valija edit`. The draft lives only in this component's state — never in
 * preferences, never a file. Escape or Cancel closes without saving, and focus
 * goes back to whatever opened the dialog. On a refused save the parent passes
 * `error` and the dialog stays open with the user's text intact.
 */
export function ItemEditDialog({
  initial,
  error,
  saving,
  onSave,
  onCancel,
}: {
  initial: EditDraft;
  error: string | null;
  saving: boolean;
  onSave: (draft: EditDraft) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(initial);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    contentRef.current?.focus();
    // The opener may have been unmounted by a reload; only return focus to it if it is still there.
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Keep Tab inside the dialog, so focus never reaches the screen behind it (and Escape keeps working).
  function trapTab(event: KeyboardEvent) {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "textarea, input, select, button:not([disabled])",
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const set = (field: keyof EditDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-edit-title"
        onKeyDown={(event) => {
          if (event.key === "Tab") trapTab(event);
          // Not while saving: a refusal arriving after an Escape would never be seen.
          if (event.key === "Escape" && !saving) onCancel();
        }}
      >
        <h2 id="item-edit-title">{t("project.editTitle")}</h2>
        <form
          className="item-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <label>
            {t("project.editContent")}
            <textarea
              ref={contentRef}
              rows={10}
              value={draft.content}
              onChange={(event) => set("content")(event.target.value)}
            />
          </label>
          <label>
            {t("project.editTags")}
            <input
              type="text"
              value={draft.tags}
              aria-describedby="item-edit-tags-hint"
              onChange={(event) => set("tags")(event.target.value)}
            />
            <span id="item-edit-tags-hint" className="hint">
              {t("project.editTagsHint")}
            </span>
          </label>
          <label>
            {t("project.editType")}
            <select value={draft.type} onChange={(event) => set("type")(event.target.value)}>
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {error !== null && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onCancel} disabled={saving}>
              {t("project.cancel")}
            </button>
            <button type="submit" className="active" disabled={saving}>
              {t("project.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
