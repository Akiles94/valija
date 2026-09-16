// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { en } from "../../../shared/i18n/catalogs/en.js";
import { es } from "../../../shared/i18n/catalogs/es.js";
import type {
  DialogFileChoiceResponse,
  ImportListResponse,
  ImportOutcomeResponse,
  IpcResult,
  ProjectListEntryMessage,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
// GUI-LAYOUT slice 10b: import.tsx moved verbatim into screens/import/import-screen.tsx.
import { ImportScreen } from "../import/import-screen.js";

/**
 * Timing rule for the whole file: because of `waitForNextPaint`, nothing may
 * be asserted synchronously after a click that starts a run. Every busy
 * assertion is `await screen.findByText(…)` or inside `waitFor(…)`. Do not
 * "simplify" this into a synchronous assertion — it will make the suite
 * flaky, not faster.
 */
function deferred<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

const LISTING_ROW = {
  index: 1,
  title: "Chat about TS",
  date: "2024-05-01",
  messageCount: 4,
  estimatedChunks: 2,
};
const THREE_ROW_LISTING = [
  { index: 1, title: "Alpha chat", date: "2024-05-01", messageCount: 4, estimatedChunks: 2 },
  { index: 2, title: "Beta chat", date: "2024-05-02", messageCount: 3, estimatedChunks: 1 },
  { index: 3, title: "Gamma note", date: "2024-05-03", messageCount: 5, estimatedChunks: 3 },
];
const PROJECTS: ProjectListEntryMessage[] = [
  { name: "myproj", itemCount: 0, lastActivityAt: null },
];
const OUTCOME: ImportOutcomeResponse = {
  imported: 2,
  conversations: 1,
  skipped: 0,
  failed: 0,
  failures: [],
};

function fakeBridge(overrides: {
  list?: ValijaBridge["import"]["list"];
  preview?: ValijaBridge["import"]["preview"];
  run?: ValijaBridge["import"]["run"];
}): ValijaBridge {
  const list =
    overrides.list ??
    vi.fn(
      (): Promise<IpcResult<ImportListResponse>> =>
        Promise.resolve({ ok: true, value: { source: "chatgpt", listing: [LISTING_ROW] } }),
    );
  const chooseImportFile = vi.fn(
    (): Promise<DialogFileChoiceResponse | null> =>
      Promise.resolve({ handle: "h1", displayName: "export.json" }),
  );
  return {
    vault: {
      init: vi.fn(),
      readRecoveryKit: vi.fn(),
      unlock: vi.fn(),
      lock: vi.fn(),
      status: vi.fn(),
      upgradeCheck: vi.fn(),
    },
    content: {
      projects: vi.fn(() => Promise.resolve({ ok: true, value: PROJECTS })),
      show: vi.fn(),
      search: vi.fn(),
      pack: vi.fn(),
      export: vi.fn(),
      copy: vi.fn(),
    },
    sync: { status: vi.fn() },
    diagnostics: { run: vi.fn(), copyReport: vi.fn() },
    relocation: {
      preflight: vi.fn(),
      move: vi.fn(),
      retryClient: vi.fn(),
      pointAtExisting: vi.fn(),
    },
    import: {
      list,
      preview: overrides.preview ?? vi.fn(),
      run: overrides.run ?? vi.fn(),
    },
    tools: { status: vi.fn(), connect: vi.fn(), nodeStatus: vi.fn() },
    preferences: { read: vi.fn(), write: vi.fn() },
    dialog: { chooseImportFile, chooseVaultFolder: vi.fn() },
    // biome-ignore lint/suspicious/noExplicitAny: only import.*, dialog.chooseImportFile and content.projects are exercised
  } as any as ValijaBridge;
}

function renderScreen(bridge: ValijaBridge) {
  return render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <ImportScreen bridge={bridge} />
    </I18nProvider>,
  );
}

/** Drives the screen from "choose" to "listed" and picks the one existing project. */
async function chooseFileAndSelectProject() {
  fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
  await screen.findByText("Chat about TS");
  fireEvent.change(screen.getByLabelText("Import into"), { target: { value: "myproj" } });
}

/** Drives the screen from "choose" to "listed", leaving "New project…" selected (the default). */
async function chooseFile() {
  fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
  await screen.findByText("Chat about TS");
}

describe("ImportScreen (DOM)", () => {
  it("case 1: busy state is visible between click and resolution, then clears on success", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const bridge = fakeBridge({ run: vi.fn(() => run.promise) });
    const { container } = renderScreen(bridge);
    await chooseFileAndSelectProject();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await screen.findByText(/Importing 2 items from 1 conversations…/);
    expect(
      screen.getByText(
        "This can take a while. The window may stop responding until it finishes — don't close it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(container.querySelector(".import-status")).toHaveAttribute("aria-busy", "true");

    run.settle({ ok: true, value: OUTCOME });

    await screen.findByText(/Imported 2 items from 1 conversations/);
    expect(screen.getByRole("button", { name: "Preview" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Import" })).not.toBeDisabled();
    expect(container.querySelector(".import-status")).toHaveAttribute("aria-busy", "false");
  });

  it("case 2: the busy copy never claims another save is in progress, in either language", () => {
    for (const catalog of [en, es]) {
      for (const text of [
        catalog.import.importing,
        catalog.import.previewing,
        catalog.import.importingShort,
        catalog.import.previewingShort,
      ]) {
        expect(text).not.toMatch(/another save|otro guardado/i);
      }
    }
  });

  it("case 3: a stale summary is cleared the moment a new run starts", async () => {
    const firstRun = deferred<IpcResult<ImportOutcomeResponse>>();
    const run = vi.fn(() => firstRun.promise);
    const bridge = fakeBridge({ run });
    renderScreen(bridge);
    await chooseFileAndSelectProject();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    firstRun.settle({ ok: true, value: OUTCOME });
    await screen.findByText(/Imported 2 items from 1 conversations/);

    const secondRun = deferred<IpcResult<ImportOutcomeResponse>>();
    run.mockReturnValue(secondRun.promise);
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await screen.findByText(/Importing 2 items from 1 conversations…/);
    expect(screen.queryByText(/Imported 2 items from 1 conversations/)).toBeNull();

    secondRun.settle({ ok: true, value: OUTCOME });
  });

  it("case 4: a rejected call never strands the screen", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const runFn = vi.fn(() => run.promise);
    const bridge = fakeBridge({ run: runFn });
    const { container } = renderScreen(bridge);
    await chooseFileAndSelectProject();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByText(/Importing 2 items from 1 conversations…/);
    // Wait for the paint yield to elapse and the bridge call to actually be
    // in flight before rejecting it — otherwise nothing has attached a
    // handler to `run.promise` yet and Node reports an unhandled rejection.
    await waitFor(() => expect(runFn).toHaveBeenCalled());
    run.fail(new Error("network-ish failure, must never be read"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import" })).not.toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Preview" })).not.toBeDisabled();
    expect(container.querySelector(".import-status")).toHaveAttribute("aria-busy", "false");
    expect(container.querySelector(".import-status .error")).not.toBeNull();
  });

  it("case 5: a second click while working never starts a second run", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const runFn = vi.fn(() => run.promise);
    const bridge = fakeBridge({ run: runFn });
    renderScreen(bridge);
    await chooseFileAndSelectProject();

    const importButton = screen.getByRole("button", { name: "Import" });
    fireEvent.click(importButton);
    fireEvent.click(importButton);

    // Both clicks land in the same task, so the ref guard has already decided
    // by the time either handler returns — waiting only for the bridge call
    // to happen at all, then asserting it never happened twice.
    await waitFor(() => expect(runFn).toHaveBeenCalled());
    expect(runFn).toHaveBeenCalledTimes(1);

    run.settle({ ok: true, value: OUTCOME });
  });

  it("case 6: the reading step has feedback and disables the chooser", async () => {
    const list = deferred<IpcResult<ImportListResponse>>();
    const bridge = fakeBridge({ list: vi.fn(() => list.promise) });
    renderScreen(bridge);

    fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));

    await screen.findByText("Reading the file…");
    expect(screen.getByRole("button", { name: "Choose a file…" })).toBeDisabled();

    list.settle({ ok: true, value: { source: "chatgpt", listing: [LISTING_ROW] } });
    await screen.findByText("Chat about TS");
  });

  it("case 7: the status region is a live region, is the only place status lives, and precedes the actions", async () => {
    const bridge = fakeBridge({ run: vi.fn(() => Promise.reject(new Error("boom"))) });
    const { container } = renderScreen(bridge);
    await chooseFileAndSelectProject();

    const region = container.querySelector(".import-status");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => {
      expect(container.querySelector(".import-status .error")).not.toBeNull();
    });
    expect(container.querySelector(".screen.import > p.error")).toBeNull();

    const actions = container.querySelector(".actions");
    expect(actions).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: both asserted non-null immediately above
    const position = region!.compareDocumentPosition(actions!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("case 8: the result block still shows per-conversation failures and the packs notice for an import", async () => {
    const outcomeWithFailure: ImportOutcomeResponse = {
      imported: 1,
      conversations: 1,
      skipped: 0,
      failed: 1,
      failures: [{ conversation: "Broken chat", reason: "bad shape" }],
    };
    const bridge = fakeBridge({
      run: vi.fn(
        (): Promise<IpcResult<ImportOutcomeResponse>> =>
          Promise.resolve({ ok: true, value: outcomeWithFailure }),
      ),
    });
    renderScreen(bridge);
    await chooseFileAndSelectProject();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await screen.findByText("Broken chat: bad shape");
    expect(
      screen.getByText(
        "Imported items are searchable and visible in the project, but they don't appear in context packs.",
      ),
    ).toBeInTheDocument();
  });

  it("case 9: typing a human name previews its slug without touching the field's own value", async () => {
    const bridge = fakeBridge({});
    renderScreen(bridge);
    await chooseFile();

    const field = screen.getByLabelText("Project name");
    fireEvent.change(field, { target: { value: "Openai 1" } });

    await screen.findByText("Will be saved as: openai-1");
    expect(field).toHaveValue("Openai 1");
  });

  it("case 10: submitting sends the slug, never the raw text, over IPC", async () => {
    const run = vi.fn(
      (): Promise<IpcResult<ImportOutcomeResponse>> =>
        Promise.resolve({ ok: true, value: OUTCOME }),
    );
    const bridge = fakeBridge({ run });
    renderScreen(bridge);
    await chooseFile();

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Openai 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ projectName: "openai-1" }));
  });

  it("case 11: a name with no letters or digits disables both actions", async () => {
    const bridge = fakeBridge({});
    renderScreen(bridge);
    await chooseFile();

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "☕☕" } });

    await screen.findByText("Type at least one letter or number.");
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("case 12: a name colliding with an existing project is announced before submitting", async () => {
    const bridge = fakeBridge({});
    renderScreen(bridge);
    await chooseFile();

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "myproj" } });

    await screen.findByText(
      "Will be saved as: myproj (existing project — items will be added there)",
    );
  });

  it("case 13: already-valid text shows no hint at all", async () => {
    const bridge = fakeBridge({});
    renderScreen(bridge);
    await chooseFile();

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "openai-1" } });

    // No preview/empty/existing text ever appears for text that's already a valid, non-colliding slug.
    await waitFor(() => {
      expect(screen.queryByText(/Will be saved as|Type at least one/)).toBeNull();
    });
  });

  it("case 14: select-all (the text link) only changes visible rows; hidden checked rows survive both directions", async () => {
    const bridge = fakeBridge({
      list: vi.fn(
        (): Promise<IpcResult<ImportListResponse>> =>
          Promise.resolve({ ok: true, value: { source: "chatgpt", listing: THREE_ROW_LISTING } }),
      ),
    });
    renderScreen(bridge);
    fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
    await screen.findByText("Alpha chat");

    // All three start checked (allChecked) — uncheck Alpha and Beta, leaving Gamma checked.
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha chat" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Beta chat" }));

    // Filter to hide Gamma (the checked row) and show only Alpha/Beta (both unchecked).
    fireEvent.change(screen.getByPlaceholderText("Filter conversations"), {
      target: { value: "chat" },
    });
    expect(screen.queryByText("Gamma note")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Alpha chat" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beta chat" })).toBeChecked();

    // Clear the filter — Gamma, hidden throughout, is still checked.
    fireEvent.change(screen.getByPlaceholderText("Filter conversations"), {
      target: { value: "" },
    });
    await screen.findByText("Gamma note");
    expect(screen.getByRole("checkbox", { name: "Gamma note" })).toBeChecked();
  });

  it("case 15: the header checkbox does the same toggle and is indeterminate when some but not all rows are checked", async () => {
    const bridge = fakeBridge({
      list: vi.fn(
        (): Promise<IpcResult<ImportListResponse>> =>
          Promise.resolve({ ok: true, value: { source: "chatgpt", listing: THREE_ROW_LISTING } }),
      ),
    });
    renderScreen(bridge);
    fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
    await screen.findByText("Alpha chat");

    fireEvent.click(screen.getByRole("checkbox", { name: "Beta chat" }));

    const headerCheckbox = screen.getByRole("checkbox", {
      name: "Select all",
    }) as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(true);
    expect(headerCheckbox.checked).toBe(false);

    fireEvent.click(headerCheckbox);
    expect(headerCheckbox.indeterminate).toBe(false);
    expect(headerCheckbox.checked).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Beta chat" })).toBeChecked();
  });

  it("case 16: the rail's selected count is N of the full listing length M, unaffected by an active filter", async () => {
    const bridge = fakeBridge({
      list: vi.fn(
        (): Promise<IpcResult<ImportListResponse>> =>
          Promise.resolve({ ok: true, value: { source: "chatgpt", listing: THREE_ROW_LISTING } }),
      ),
    });
    renderScreen(bridge);
    fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
    await screen.findByText("Alpha chat");

    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Filter conversations"), {
      target: { value: "Alpha" },
    });
    expect(screen.queryByText("Beta chat")).toBeNull();
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
  });

  it("case 17: every selection control is disabled while a run is in flight", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const bridge = fakeBridge({
      list: vi.fn(
        (): Promise<IpcResult<ImportListResponse>> =>
          Promise.resolve({ ok: true, value: { source: "chatgpt", listing: THREE_ROW_LISTING } }),
      ),
      run: vi.fn(() => run.promise),
    });
    renderScreen(bridge);
    fireEvent.click(screen.getByRole("button", { name: "Choose a file…" }));
    await screen.findByText("Alpha chat");
    fireEvent.change(screen.getByLabelText("Import into"), { target: { value: "myproj" } });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await screen.findByText(/Importing 6 items from 3 conversations…/);

    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeDisabled();
    // All three rows are checked by default (allChecked) — the text link reads "Deselect all".
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Alpha chat" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Beta chat" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Gamma note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Date" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();

    run.settle({ ok: true, value: OUTCOME });
    await screen.findByText(/Imported 2 items from 1 conversations/);
  });

  it('case 18: exactly one aria-live="polite" element exists in the tree at every stage', async () => {
    // Stage "choose" — nothing chosen yet.
    const { container: chooseContainer } = renderScreen(fakeBridge({}));
    expect(chooseContainer.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);

    // Stage "formatOverride" — auto-detection failed.
    const { container: overrideContainer } = renderScreen(
      fakeBridge({
        list: vi.fn(
          (): Promise<IpcResult<ImportListResponse>> =>
            Promise.resolve({ ok: false, error: { code: "UNSUPPORTED_SOURCE" } }),
        ),
      }),
    );
    fireEvent.click(within(overrideContainer).getByRole("button", { name: "Choose a file…" }));
    await within(overrideContainer).findByText(
      "We couldn't tell which export this is. Pick the format:",
    );
    expect(overrideContainer.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);

    // Stage "listed" — the listing loaded successfully.
    const { container: listedContainer } = renderScreen(fakeBridge({}));
    fireEvent.click(within(listedContainer).getByRole("button", { name: "Choose a file…" }));
    await within(listedContainer).findByText("Chat about TS");
    expect(listedContainer.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  });

  it("no import.* string mentions retrying — the SQLITE_BUSY-retry wording is gone", () => {
    for (const catalog of [en, es]) {
      const strings = Object.values(catalog.import).filter(
        (value): value is string => typeof value === "string",
      );
      for (const text of strings) {
        expect(text).not.toMatch(/retry|reintent/i);
      }
    }
  });
});
