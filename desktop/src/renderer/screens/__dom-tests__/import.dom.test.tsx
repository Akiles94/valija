// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ImportListingRow,
  ImportOutcomeResponse,
  IpcResult,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { ImportScreen } from "../import.js";

/**
 * Timing rule for the whole file (D-2 = O1's `waitForNextPaint`): nothing
 * may be asserted synchronously after `fireEvent.click`. Every busy
 * assertion is `await screen.findByText(…)` or inside `waitFor(…)` — do not
 * "simplify" this into a synchronous assertion; it will flake.
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

function row(index: number): ImportListingRow {
  return {
    index,
    title: `Conversation ${index}`,
    date: "2026-08-01",
    messageCount: 4,
    estimatedChunks: 3,
  };
}

function outcome(overrides: Partial<ImportOutcomeResponse> = {}): ImportOutcomeResponse {
  return { imported: 3, conversations: 1, skipped: 0, failed: 0, failures: [], ...overrides };
}

function fakeBridge(overrides: {
  list?: (req: unknown) => Promise<IpcResult<{ source: string; listing: ImportListingRow[] }>>;
  preview?: (req: unknown) => Promise<IpcResult<ImportOutcomeResponse>>;
  run?: (req: unknown) => Promise<IpcResult<ImportOutcomeResponse>>;
  chooseImportFile?: () => Promise<{ handle: string; displayName: string } | null>;
}): ValijaBridge {
  const list = vi.fn(
    overrides.list ??
      (() => Promise.resolve({ ok: true, value: { source: "chatgpt", listing: [row(1)] } })),
  );
  const preview = vi.fn(
    overrides.preview ?? (() => Promise.resolve({ ok: true, value: outcome() })),
  );
  const run = vi.fn(overrides.run ?? (() => Promise.resolve({ ok: true, value: outcome() })));
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
      projects: vi.fn().mockResolvedValue({ ok: true, value: [] }),
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
    import: { list, preview, run },
    tools: { status: vi.fn(), connect: vi.fn(), nodeStatus: vi.fn() },
    preferences: {
      read: vi.fn().mockResolvedValue({
        vaultPath: null,
        theme: "system",
        language: "en",
        tourSeen: false,
        autoLockMinutes: 15,
      }),
      write: vi.fn(),
    },
    dialog: {
      chooseImportFile: vi.fn(
        overrides.chooseImportFile ??
          (() => Promise.resolve({ handle: "fh-1", displayName: "export.json" })),
      ),
      chooseVaultFolder: vi.fn(),
    },
    // biome-ignore lint/suspicious/noExplicitAny: only import/dialog/content.projects are exercised by this suite
  } as any as ValijaBridge;
}

/** Drives the screen from "choose" to "listed", with a project name typed so canSubmit is true. */
async function reachListedStage(bridge: ValijaBridge) {
  render(
    <I18nProvider
      preferences={{
        vaultPath: null,
        theme: "system",
        language: "en",
        tourSeen: false,
        autoLockMinutes: 15,
      }}
    >
      <ImportScreen bridge={bridge} />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByText(/choose a file/i));
  await screen.findByText("export.json");
  const nameInput = screen.getByRole("textbox", { name: "" });
  fireEvent.change(nameInput, { target: { value: "myproject" } });
}

describe("ImportScreen (DOM) — busy state, the re-entrancy guard, and the single status region", () => {
  it("case 1: busy state is visible between click and resolution, then clears on resolve", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const bridge = fakeBridge({ run: () => run.promise });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await screen.findByText(/importing 3 items from 1 conversations/i);
    expect(screen.getByText(/may stop responding/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importing/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^preview$/i })).toBeDisabled();
    const region = document.querySelector(".import-status");
    expect(region).toHaveAttribute("aria-busy", "true");

    run.settle({ ok: true, value: outcome() });
    await screen.findByText(/imported 3 items/i);
    expect(screen.getByRole("button", { name: /^import$/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^preview$/i })).not.toBeDisabled();
  });

  it("case 2: the busy copy never claims another save is in progress, in en or es", async () => {
    for (const language of ["en", "es"] as const) {
      const run = deferred<IpcResult<ImportOutcomeResponse>>();
      const bridge = fakeBridge({ run: () => run.promise });
      const { unmount } = render(
        <I18nProvider
          preferences={{
            vaultPath: null,
            theme: "system",
            language,
            tourSeen: false,
            autoLockMinutes: 15,
          }}
        >
          <ImportScreen bridge={bridge} />
        </I18nProvider>,
      );
      fireEvent.click(screen.getByText(/choose a file|elegir un archivo/i));
      await screen.findByText("export.json");
      fireEvent.change(screen.getByRole("textbox", { name: "" }), {
        target: { value: "myproject" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^import$|^importar$/i }));
      await screen.findByText(/importing 3|importando 3/i);

      const status = document.querySelector(".import-status");
      expect(status?.textContent).not.toMatch(/another save|otro guardado/i);
      run.settle({ ok: true, value: outcome() });
      await screen.findByText(/imported 3|importaron 3/i);
      unmount();
    }
  });

  it("case 3: starting a new run clears the previous summary while the new run is in flight (D-7)", async () => {
    const firstRun = deferred<IpcResult<ImportOutcomeResponse>>();
    const bridge = fakeBridge({ run: () => firstRun.promise });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    firstRun.settle({ ok: true, value: outcome({ imported: 3 }) });
    await screen.findByText(/imported 3 items/i);

    const secondRun = deferred<IpcResult<ImportOutcomeResponse>>();
    vi.mocked(bridge.import.run).mockImplementationOnce(() => secondRun.promise);
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await waitFor(() => expect(screen.queryByText(/imported 3 items/i)).toBeNull());
    expect(screen.getByText(/importing 3 items/i)).toBeInTheDocument();
    secondRun.settle({ ok: true, value: outcome({ imported: 3 }) });
  });

  it("case 4: a rejected call never strands the screen (V5/D-9)", async () => {
    const bridge = fakeBridge({ run: () => Promise.reject(new Error("boom")) });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));

    await screen.findByText(/something went wrong/i);
    expect(screen.getByRole("button", { name: /^import$/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^preview$/i })).not.toBeDisabled();
    const error = document.querySelector(".import-status .error");
    expect(error).not.toBeNull();
  });

  it("case 5: a second click while working never starts a second run, even before React re-renders the disabled button (P-D4)", async () => {
    const run = deferred<IpcResult<ImportOutcomeResponse>>();
    const bridge = fakeBridge({ run: () => run.promise });
    await reachListedStage(bridge);

    const importButton = screen.getByRole("button", { name: /^import$/i });
    // Both dispatches inside one `act` batch: React defers re-rendering
    // (and therefore setting `disabled`) until the callback returns, so both
    // click handlers run against the *same* not-yet-disabled button — the
    // OS-buffered double-click case D-9 exists for. If this were guarded
    // only by the `disabled` attribute (not `workingRef`), both handlers
    // would call `bridge.import.run`.
    await act(() => {
      importButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      importButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await screen.findByText(/importing 3 items/i);
    // The busy text commits (via beginWork's setWorking) before the paint
    // yield resolves and bridge.import.run is actually called — wait for the
    // call itself, not just the busy text, before asserting the count.
    await waitFor(() => expect(bridge.import.run).toHaveBeenCalled());

    expect(bridge.import.run).toHaveBeenCalledTimes(1);
    run.settle({ ok: true, value: outcome() });
  });

  it("case 6: the reading step has feedback and disables the chooser (V4/D-8)", async () => {
    const list = deferred<IpcResult<{ source: string; listing: ImportListingRow[] }>>();
    const bridge = fakeBridge({ list: () => list.promise });
    render(
      <I18nProvider
        preferences={{
          vaultPath: null,
          theme: "system",
          language: "en",
          tourSeen: false,
          autoLockMinutes: 15,
        }}
      >
        <ImportScreen bridge={bridge} />
      </I18nProvider>,
    );
    const chooseButton = screen.getByText(/choose a file/i);
    fireEvent.click(chooseButton);

    await screen.findByText(/reading the file/i);
    expect(chooseButton).toBeDisabled();

    list.settle({ ok: true, value: { source: "chatgpt", listing: [row(1)] } });
    await screen.findByText("export.json");
  });

  it("a dialog that resolves while an earlier one's listing is already loading never overwrites its handle/displayName (review W1)", async () => {
    const dialogA = deferred<{ handle: string; displayName: string } | null>();
    const dialogB = deferred<{ handle: string; displayName: string } | null>();
    let dialogCalls = 0;
    const listA = deferred<IpcResult<{ source: string; listing: ImportListingRow[] }>>();
    const bridge = fakeBridge({
      chooseImportFile: () => {
        dialogCalls += 1;
        return dialogCalls === 1 ? dialogA.promise : dialogB.promise;
      },
      list: () => listA.promise,
    });
    render(
      <I18nProvider
        preferences={{
          vaultPath: null,
          theme: "system",
          language: "en",
          tourSeen: false,
          autoLockMinutes: 15,
        }}
      >
        <ImportScreen bridge={bridge} />
      </I18nProvider>,
    );
    const chooseButton = screen.getByText(/choose a file/i);
    // Two dialog requests in the same task — the OS-buffered double-click D-9 exists for.
    await act(() => {
      chooseButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      chooseButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(bridge.dialog.chooseImportFile).toHaveBeenCalledTimes(2);

    // File A's dialog resolves first; its listing starts loading.
    dialogA.settle({ handle: "fh-A", displayName: "a.json" });
    await screen.findByText(/reading the file/i);
    await waitFor(() => expect(bridge.import.list).toHaveBeenCalled());

    // File B's dialog resolves while A's listing is still in flight — must be a no-op.
    // Awaiting the same promise inside `act` lets handleChooseFile's second
    // invocation run its (empty, post-fix) continuation before we assert.
    await act(async () => {
      dialogB.settle({ handle: "fh-B", displayName: "b.json" });
      await dialogB.promise;
    });
    expect(screen.queryByText("b.json")).toBeNull();
    expect(bridge.import.list).toHaveBeenCalledTimes(1);
    expect(bridge.import.list).toHaveBeenCalledWith(expect.objectContaining({ handle: "fh-A" }));

    listA.settle({ ok: true, value: { source: "chatgpt", listing: [row(1)] } });
    await screen.findByText("a.json");
  });

  it("case 7: the status region is a live region, precedes the actions, and is the only place errors live (V3/V7/D-4)", async () => {
    const bridge = fakeBridge({
      run: () => Promise.resolve({ ok: false, error: { code: "STORAGE_ERROR" } }),
    });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await screen.findByText(/reading or writing the vault/i);

    expect(document.querySelector(".screen.import > p.error")).toBeNull();
    const region = document.querySelector(".import-status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region?.querySelector(".error")).not.toBeNull();

    // D-4: not merely "somewhere before the buttons" (which the top of the
    // page would also satisfy) — immediately above them, with the listing
    // content between the top of the screen and the region.
    const actions = document.querySelector(".import .actions");
    const list = document.querySelector(".import .conversation-list");
    expect(actions).not.toBeNull();
    expect(list).not.toBeNull();
    expect(region?.nextElementSibling).toBe(actions);
    if (region !== null && list !== null) {
      expect(list.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("case 8: the result block still shows per-conversation failures and the packs notice for an import", async () => {
    const bridge = fakeBridge({
      run: () =>
        Promise.resolve({
          ok: true,
          value: outcome({
            imported: 2,
            failed: 1,
            failures: [{ conversation: "Weird one", reason: "parse error" }],
          }),
        }),
    });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await screen.findByText(/imported 2 items/i);

    expect(screen.getByText(/Weird one: parse error/i)).toBeInTheDocument();
    expect(screen.getByText(/don't appear in context packs/i)).toBeInTheDocument();
  });

  it("preview never shows the import-only packs notice", async () => {
    const bridge = fakeBridge({ preview: () => Promise.resolve({ ok: true, value: outcome() }) });
    await reachListedStage(bridge);

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await screen.findByText(/would import 3 items/i);
    expect(screen.queryByText(/don't appear in context packs/i)).toBeNull();
  });
});
