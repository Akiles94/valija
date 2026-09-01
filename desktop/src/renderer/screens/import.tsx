import { useEffect, useState } from "react";
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
  type SortDirection,
  sortListingByDate,
} from "../state/import-selection.js";

const NEW_PROJECT = "__new__";
const FORMAT_OPTIONS: readonly ImportFormatOverride[] = ["chatgpt", "claude", "generic"];

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

  const [working, setWorking] = useState<"preview" | "import" | null>(null);
  const [resultOutcome, setResultOutcome] = useState<ImportOutcomeResponse | null>(null);
  const [resultMode, setResultMode] = useState<"preview" | "import" | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: bridge is a stable module-scoped singleton, not reactive state
  useEffect(() => {
    bridge.content.projects().then((result) => {
      if (result.ok) setExistingProjects(result.value.map((p) => p.name));
    });
  }, []);

  async function handleChooseFile() {
    const chosen = await bridge.dialog.chooseImportFile();
    if (chosen === null) return;
    setError(null);
    setHandle(chosen.handle);
    setDisplayName(chosen.displayName);
    await loadListing(chosen.handle, undefined);
  }

  async function loadListing(theHandle: string, override: ImportFormatOverride | undefined) {
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
    const projectName = resolvedProjectName();
    const pick = buildPickSpec(checked);
    if (handle === null || projectName === null || pick === undefined) return;

    setWorking(mode);
    setError(null);
    const request = {
      handle,
      projectName,
      pick,
      ...(filterText.trim().length === 0 ? {} : { query: filterText.trim() }),
      ...(from === undefined ? {} : { from }),
    };
    const result =
      mode === "preview" ? await bridge.import.preview(request) : await bridge.import.run(request);
    setWorking(null);
    if (!result.ok) {
      setError(errorCopy(result.error.code));
      return;
    }
    setResultOutcome(result.value);
    setResultMode(mode);
  }

  const canSubmit = resolvedProjectName() !== null && buildPickSpec(checked) !== undefined;
  const displayedListing = listing === null ? [] : sortListingByDate(listing, sortDirection);
  const visibleListing =
    filterText.trim().length === 0
      ? displayedListing
      : displayedListing.filter((row) =>
          row.title.toLowerCase().includes(filterText.trim().toLowerCase()),
        );

  return (
    <div className="screen import">
      <h1>{t("import.title")}</h1>
      <p className="explainer">{t("import.explainer")}</p>
      {error !== null && <p className="error">{error}</p>}

      {stage === "choose" && (
        <button type="button" onClick={() => void handleChooseFile()}>
          {t("import.chooseFile")}
        </button>
      )}

      {stage === "formatOverride" && (
        <div className="format-override">
          <p>{displayName}</p>
          <p>{t("import.formatOverridePrompt")}</p>
          {FORMAT_OPTIONS.map((format) => (
            <button type="button" key={format} onClick={() => handleFormatChoice(format)}>
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

          {working === "preview" && <p>{t("common.loading")}</p>}
          {working === "import" && <p>{t("import.busyRetrying")}</p>}

          <button
            type="button"
            disabled={!canSubmit || working !== null}
            onClick={() => void runSelection("preview")}
          >
            {t("import.preview")}
          </button>
          <button
            type="button"
            disabled={!canSubmit || working !== null}
            onClick={() => void runSelection("import")}
          >
            {t("import.importButton")}
          </button>

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
      )}
    </div>
  );
}
