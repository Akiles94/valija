import { useEffect, useRef, useState } from "react";
import { formatDate } from "../../shared/i18n/format.js";
import type {
  ImportFormatOverride,
  ImportListingRow,
  ImportOutcomeResponse,
} from "../../shared/ipc/messages.js";
import type { ValijaBridge } from "../state/bridge.js";
import { useErrorCopy, useLanguage, useT } from "../state/i18n-context.js";
import {
  allChecked,
  buildPickSpec,
  countSelection,
  type SortDirection,
  sortListingByDate,
} from "../state/import-selection.js";
import { waitForNextPaint } from "../state/next-paint.js";

const NEW_PROJECT = "__new__";
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
 * conversation.
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
    const name = projectChoice === NEW_PROJECT ? newProjectName.trim() : projectChoice;
    return name.length === 0 ? null : name;
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
  const busy = busyMessage();

  return (
    <div className="screen import">
      <h1>{t("import.title")}</h1>
      <p className="explainer">{t("import.explainer")}</p>

      {stage === "choose" && (
        <button type="button" disabled={working !== null} onClick={() => void handleChooseFile()}>
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
              disabled={working !== null}
              onClick={() => handleFormatChoice(format)}
            >
              {format}
            </button>
          ))}
        </div>
      )}

      {stage === "listed" && listing !== null && (
        <div className="import-listing">
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
            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>

          <ul className="conversation-list">
            {visibleListing.map((row) => (
              <li key={row.index} className="conversation-row">
                <label>
                  <input
                    type="checkbox"
                    disabled={working !== null}
                    checked={checked.has(row.index)}
                    onChange={() => toggleChecked(row.index)}
                  />
                  <span className="conversation-title">{row.title}</span>
                  <span className="conversation-date">
                    {formatDate(new Date(row.date), language)}
                  </span>
                  <span className="conversation-chunks">{row.estimatedChunks}</span>
                </label>
              </li>
            ))}
          </ul>

          <label>
            {t("import.projectLabel")}
            <select value={projectChoice} onChange={(e) => setProjectChoice(e.target.value)}>
              <option value={NEW_PROJECT}>{t("import.projectNewOption")}</option>
              {existingProjects.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {projectChoice === NEW_PROJECT && (
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          )}
        </div>
      )}

      {/* One region for busy, result and error (D-4), mounted unconditionally so it
          can hold a loadListing error even while stage is still "choose", and so
          an assistive-tech user gets it announced before it ever has content. */}
      <div
        className="import-status"
        aria-live="polite"
        aria-busy={working !== null}
        ref={statusRef}
      >
        {busy !== null && (
          <>
            <p className="import-busy">{busy}</p>
            <p className="explainer">{t("import.mayStopResponding")}</p>
          </>
        )}
        {error !== null && <p className="error">{error}</p>}
        {resultOutcome !== null && resultMode !== null && (
          <div className="import-result">
            <p>
              {t(resultMode === "preview" ? "import.previewSummary" : "import.importSummary", {
                itemCount: resultOutcome.imported,
                conversationCount: resultOutcome.conversations,
                project: resolvedProjectName() ?? "",
                skipped: resultOutcome.skipped,
                failed: resultOutcome.failed,
              })}
            </p>
            {resultOutcome.failures.length > 0 && (
              <ul className="import-failures">
                {resultOutcome.failures.map((failure) => (
                  <li key={`${failure.conversation}-${failure.reason}`}>
                    {t("import.perConversationFailure", {
                      title: failure.conversation,
                      reason: failure.reason,
                    })}
                  </li>
                ))}
              </ul>
            )}
            {resultMode === "import" && <p>{t("import.excludedFromPacksNotice")}</p>}
          </div>
        )}
      </div>

      {stage === "listed" && listing !== null && (
        <div className="actions">
          <button
            type="button"
            disabled={!canSubmit || working !== null}
            onClick={() => void runSelection("preview")}
          >
            {working === "preview" ? t("import.previewingShort") : t("import.preview")}
          </button>
          <button
            type="button"
            disabled={!canSubmit || working !== null}
            onClick={() => void runSelection("import")}
          >
            {working === "import" ? t("import.importingShort") : t("import.importButton")}
          </button>
        </div>
      )}
    </div>
  );
}
