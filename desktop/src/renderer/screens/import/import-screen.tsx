import { useEffect, useRef, useState } from "react";
import type {
  ImportFormatOverride,
  ImportListingRow,
  ImportOutcomeResponse,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { useErrorCopy, useLanguage, useT } from "../../state/i18n-context.js";
import {
  allChecked,
  buildPickSpec,
  countSelection,
  type SortDirection,
  sortListingByDate,
  toggleVisibleSelection,
  visibleSelectionState,
} from "../../state/import-selection.js";
import { waitForNextPaint } from "../../state/next-paint.js";
import { previewProjectSlug, slugifyProjectName } from "../../state/project-slug.js";
import { ConversationTable } from "./conversation-table.js";
import { DestinationPicker, NEW_PROJECT } from "./destination-picker.js";
import { ImportStatus } from "./import-status.js";

const FORMAT_OPTIONS: readonly ImportFormatOverride[] = ["chatgpt", "claude", "generic"];

type Working = "reading" | "preview" | "import" | null;

/**
 * Not a `DomainError.code` from `src/` — the renderer's own label for "the IPC call itself
 * rejected" (a schema-validation throw in `register-handlers.ts` never becomes a Result).
 * Rendered through `errors.generic`; the caught error is never read, so no raw driver or zod
 * string can reach the screen (§7).
 */
const REJECTED_CALL_CODE = "UNEXPECTED";

/**
 * §9 items 72–77 — one screen: choose a file, resolve the format (auto, or a
 * manual override offered only once auto-detection fails), list, filter,
 * sort, select, and either Preview (a dry run) or Import. Every write routes
 * through `bridge.import.run`, which wraps the same `ImportConversations`
 * the CLI uses (§9 item 77) — nothing here re-parses or re-chunks a
 * conversation. GUI-LAYOUT slice 10c split the table, the destination
 * controls and the status region into `conversation-table.tsx` /
 * `destination-picker.tsx` / `import-status.tsx`; this file keeps every
 * handler and every piece of state.
 */
export function ImportScreen({ bridge }: { bridge: ValijaBridge }) {
  const t = useT();
  const language = useLanguage();
  const errorCopy = useErrorCopy();

  const [stage, setStage] = useState<"choose" | "formatOverride" | "listed">("choose");
  const [handle, setHandle] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [listing, setListing] = useState<ImportListingRow[] | null>(null);
  const [from, setFrom] = useState<ImportFormatOverride | undefined>(undefined);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [projectChoice, setProjectChoice] = useState<string>(NEW_PROJECT);
  const [newProjectName, setNewProjectName] = useState("");

  const [working, setWorking] = useState<Working>(null);
  const workingRef = useRef<Working>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [resultOutcome, setResultOutcome] = useState<ImportOutcomeResponse | null>(null);
  const [resultMode, setResultMode] = useState<"preview" | "import" | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    bridge.content.projects().then((result) => {
      if (result.ok) setExistingProjects(result.value.map((p) => p.name));
    });
  }, []);

  useEffect(() => {
    if (working !== null) return;
    if (resultOutcome === null && error === null) return;
    statusRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [working, resultOutcome, error]);

  /** Start a run: gate first (synchronously), then clear whatever the last run left on screen (D-7). */
  function beginWork(mode: Exclude<Working, null>) {
    workingRef.current = mode;
    setWorking(mode);
    setError(null);
    setResultOutcome(null);
    setResultMode(null);
  }

  /** Always reached — from success, from a failed `Result`, and from a rejection (D-9). */
  function endWork() {
    workingRef.current = null;
    setWorking(null);
  }

  async function handleChooseFile() {
    if (workingRef.current !== null) return;
    try {
      const chosen = await bridge.dialog.chooseImportFile();
      if (chosen === null) return; // the user pressed Cancel — a silent no-op
      setHandle(chosen.handle);
      setDisplayName(chosen.displayName);
      await loadListing(chosen.handle, undefined);
    } catch {
      setError(errorCopy(REJECTED_CALL_CODE));
    }
  }

  async function loadListing(theHandle: string, override: ImportFormatOverride | undefined) {
    if (workingRef.current !== null) return;
    beginWork("reading");
    await waitForNextPaint(); // D-2 = O1: present the busy frame before main blocks
    try {
      const result = await bridge.import.list({
        handle: theHandle,
        ...(override === undefined ? {} : { from: override }),
      });
      if (!result.ok) {
        if (result.error.code === "UNSUPPORTED_SOURCE") {
          setStage("formatOverride");
          return;
        }
        setError(errorCopy(result.error.code));
        return;
      }
      setFrom(override);
      setDetectedFormat(result.value.source);
      setListing(result.value.listing);
      setChecked(allChecked(result.value.listing));
      setStage("listed");
    } catch {
      setError(errorCopy(REJECTED_CALL_CODE));
    } finally {
      endWork();
    }
  }

  function handleFormatChoice(chosenFormat: ImportFormatOverride) {
    if (handle === null) return;
    void loadListing(handle, chosenFormat);
  }

  function toggleChecked(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function resolvedProjectName(): string | null {
    const name = projectChoice === NEW_PROJECT ? slugifyProjectName(newProjectName) : projectChoice;
    return name.length === 0 ? null : name;
  }

  /** Empty string when there is nothing to say — `.project-slug-hint:empty` then hides it (D-1). */
  function projectSlugHintText(): string {
    const hint = previewProjectSlug(newProjectName, existingProjects);
    switch (hint.kind) {
      case "hidden":
        return "";
      case "empty":
        return t("import.projectSlugEmpty");
      case "existing":
        return t("import.projectSlugExisting", { slug: hint.slug });
      case "preview":
        return t("import.projectSlugPreview", { slug: hint.slug });
    }
  }

  async function runSelection(mode: "preview" | "import") {
    if (workingRef.current !== null) return; // D-9: immune to an OS-buffered second click
    const projectName = resolvedProjectName();
    const pick = buildPickSpec(checked);
    if (handle === null || projectName === null || pick === undefined) return;

    const request = {
      handle,
      projectName,
      pick,
      ...(filterText.trim().length === 0 ? {} : { query: filterText.trim() }),
      ...(from === undefined ? {} : { from }),
    };
    beginWork(mode);
    await waitForNextPaint(); // D-2 = O1: present the busy frame before main blocks
    try {
      const result =
        mode === "preview"
          ? await bridge.import.preview(request)
          : await bridge.import.run(request);
      if (!result.ok) {
        setError(errorCopy(result.error.code));
        return;
      }
      setResultOutcome(result.value);
      setResultMode(mode);
    } catch {
      setError(errorCopy(REJECTED_CALL_CODE));
    } finally {
      endWork();
    }
  }

  function busyMessage(): string | null {
    if (working === null) return null;
    if (working === "reading") return t("import.detectingFormat");
    const counts = countSelection(listing ?? [], checked);
    return t(working === "preview" ? "import.previewing" : "import.importing", { ...counts });
  }

  const canSubmit = resolvedProjectName() !== null && buildPickSpec(checked) !== undefined;
  const displayedListing = listing === null ? [] : sortListingByDate(listing, sortDirection);
  const visibleListing =
    filterText.trim().length === 0
      ? displayedListing
      : displayedListing.filter((row) =>
          row.title.toLowerCase().includes(filterText.trim().toLowerCase()),
        );
  const headerState = visibleSelectionState(checked, visibleListing);
  const busy = busyMessage();
  const disabled = working !== null;

  function handleToggleVisible() {
    setChecked((prev) => toggleVisibleSelection(prev, visibleListing));
  }

  return (
    <div className="screen import">
      <h1>{t("import.title")}</h1>
      <p className="explainer">{t("import.explainer")}</p>

      <div className={stage === "listed" ? "import-body" : "import-body single"}>
        <div className="import-main">
          {stage === "choose" && (
            <button type="button" disabled={disabled} onClick={() => void handleChooseFile()}>
              {t("import.chooseFile")}
            </button>
          )}

          {stage === "formatOverride" && (
            <div className="format-override">
              <p>{displayName}</p>
              <p>{t("import.formatOverridePrompt")}</p>
              {FORMAT_OPTIONS.map((format) => (
                <button
                  type="button"
                  key={format}
                  disabled={disabled}
                  onClick={() => handleFormatChoice(format)}
                >
                  {format}
                </button>
              ))}
            </div>
          )}

          {stage === "listed" && listing !== null && (
            <>
              <p>{displayName}</p>
              <p className="conversation-count">
                {t("import.conversationCount", { count: listing.length })}
              </p>

              <input
                type="search"
                placeholder={t("import.filterPlaceholder")}
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <button
                type="button"
                className="link-button"
                disabled={disabled}
                onClick={handleToggleVisible}
              >
                {headerState === "all"
                  ? t("import.deselectAllVisible")
                  : t("import.selectAllVisible")}
              </button>

              <ConversationTable
                rows={visibleListing}
                checked={checked}
                disabled={disabled}
                headerState={headerState}
                sortDirection={sortDirection}
                language={language}
                onToggleRow={toggleChecked}
                onToggleVisible={handleToggleVisible}
                onToggleSort={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              />
            </>
          )}
        </div>

        <aside className="import-rail">
          {stage === "listed" && listing !== null && (
            <>
              <p>
                <span className="label">{t("import.fileLabel")}</span> <span>{displayName}</span>
              </p>
              {detectedFormat !== null && (
                <p>
                  <span className="label">{t("import.formatLabel")}</span>{" "}
                  <span>{detectedFormat}</span>
                </p>
              )}
              <p className="selected-count">
                {t("import.selectedCount", { count: checked.size, total: listing.length })}
              </p>
              <DestinationPicker
                existingProjects={existingProjects}
                projectChoice={projectChoice}
                newProjectName={newProjectName}
                hintText={projectSlugHintText()}
                onProjectChoiceChange={setProjectChoice}
                onNewProjectNameChange={setNewProjectName}
              />
            </>
          )}

          {/* ALWAYS mounted, exactly one — a loadListing error or the "Reading
              the file…" busy line can land here while stage is still "choose". */}
          <ImportStatus
            ariaBusy={disabled}
            busyMessage={busy}
            error={error}
            resultOutcome={resultOutcome}
            resultMode={resultMode}
            resolvedProjectName={resolvedProjectName()}
            statusRef={statusRef}
          />

          {stage === "listed" && listing !== null && (
            <div className="actions">
              <button
                type="button"
                disabled={!canSubmit || disabled}
                onClick={() => void runSelection("preview")}
              >
                {working === "preview" ? t("import.previewingShort") : t("import.preview")}
              </button>
              <button
                type="button"
                disabled={!canSubmit || disabled}
                onClick={() => void runSelection("import")}
              >
                {working === "import" ? t("import.importingShort") : t("import.importButton")}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
