// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  RelocationClientResult,
  RelocationMoveResponse,
  RelocationPreflightResponse,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { RelocateVaultScreen } from "../relocate-vault.js";

/**
 * P-D5 (reversed 2026-08-20) names `relocate-vault.tsx` as the second — and
 * last — screen with a DOM-level test, alongside `recovery-kit.tsx`.
 */
function fakeBridge(overrides: {
  preflight: RelocationPreflightResponse;
  move?: RelocationMoveResponse;
  retryClient?: (client: string) => RelocationClientResult;
}): ValijaBridge & {
  relocation: {
    preflight: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    retryClient: ReturnType<typeof vi.fn>;
  };
} {
  const retryClient = vi.fn((req: { client: string }) => {
    const result = overrides.retryClient?.(req.client) ?? {
      client: req.client,
      outcome: "rewritten",
    };
    return Promise.resolve({ ok: true, value: result });
  });

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
      projects: vi.fn(),
      show: vi.fn(),
      search: vi.fn(),
      pack: vi.fn(),
      export: vi.fn(),
      copy: vi.fn(),
    },
    sync: { status: vi.fn() },
    relocation: {
      preflight: vi.fn().mockResolvedValue({ ok: true, value: overrides.preflight }),
      move: vi
        .fn()
        .mockResolvedValue(
          overrides.move === undefined
            ? { ok: false, error: { code: "STORAGE_ERROR" } }
            : { ok: true, value: overrides.move },
        ),
      retryClient,
    },
    import: { list: vi.fn(), preview: vi.fn(), run: vi.fn() },
    tools: { status: vi.fn(), connect: vi.fn() },
    preferences: {
      read: vi.fn().mockResolvedValue({
        vaultPath: null,
        theme: "system",
        language: "en",
        tourSeen: false,
      }),
      write: vi.fn(),
    },
    dialog: {
      chooseImportFile: vi.fn(),
      chooseVaultFolder: vi.fn().mockResolvedValue({ handle: "h1", displayName: "valija" }),
    },
    // biome-ignore lint/suspicious/noExplicitAny: only relocation's three methods are exercised by this suite
  } as any as ValijaBridge & {
    relocation: {
      preflight: ReturnType<typeof vi.fn>;
      move: ReturnType<typeof vi.fn>;
      retryClient: ReturnType<typeof vi.fn>;
    };
  };
}

async function renderScreen(bridge: ValijaBridge, onDone = vi.fn()) {
  render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <RelocateVaultScreen bridge={bridge} onDone={onDone} />
    </I18nProvider>,
  );
  return { onDone };
}

async function chooseFolder() {
  fireEvent.click(screen.getByText(/choose a folder/i));
  // "valija" is the fake displayName every preflight response in this suite
  // uses — present once the preflight response has landed, whether or not
  // it carries a refusal (a refusal still offers its own "Choose a folder…"
  // button, so waiting on that text disappearing isn't reliable here).
  await screen.findByText("valija");
}

describe("RelocateVaultScreen (DOM)", () => {
  it("run 1 — a pre-flight refusal (destination occupied) blocks the move, no confirm button appears", async () => {
    const bridge = fakeBridge({
      preflight: {
        destinationDisplayName: "valija",
        looksLikeCloud: false,
        refusalCode: "RELOCATION_DESTINATION_OCCUPIED",
        clients: [],
      },
    });
    await renderScreen(bridge);
    await chooseFolder();

    expect(await screen.findByText(/already a vault at that location/i)).toBeInTheDocument();
    expect(screen.queryByText(/move vault/i)).toBeNull();
    expect(bridge.relocation.move).not.toHaveBeenCalled();
  });

  it("run 2 — a full successful move shows every client re-pointed, with no Try again button anywhere", async () => {
    const bridge = fakeBridge({
      preflight: {
        destinationDisplayName: "valija",
        looksLikeCloud: true,
        refusalCode: null,
        clients: [
          { client: "claude-code", currentlyConnected: true, configUnreadable: false },
          { client: "claude-desktop", currentlyConnected: true, configUnreadable: false },
          { client: "cursor", currentlyConnected: true, configUnreadable: false },
        ],
      },
      move: {
        root: "/Users/oscar/Dropbox/valija",
        clientResults: [
          { client: "claude-code", outcome: "rewritten" },
          { client: "claude-desktop", outcome: "rewritten" },
          { client: "cursor", outcome: "rewritten" },
        ],
      },
    });
    await renderScreen(bridge);
    await chooseFolder();
    fireEvent.click(await screen.findByText(/move vault/i));

    await screen.findByText(/now point at the new folder/i);
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(bridge.relocation.retryClient).not.toHaveBeenCalled();
  });

  it("run 3 — a move that succeeds but fails to re-point one client: Try again retries only that client, the other rows stay undisturbed", async () => {
    const bridge = fakeBridge({
      preflight: {
        destinationDisplayName: "valija",
        looksLikeCloud: false,
        refusalCode: null,
        clients: [
          { client: "claude-code", currentlyConnected: true, configUnreadable: false },
          { client: "claude-desktop", currentlyConnected: true, configUnreadable: false },
          { client: "cursor", currentlyConnected: true, configUnreadable: false },
        ],
      },
      move: {
        root: "/Users/oscar/Dropbox/valija",
        clientResults: [
          { client: "claude-code", outcome: "rewritten" },
          { client: "claude-desktop", outcome: "rewritten" },
          {
            client: "cursor",
            outcome: "configUnreadable",
            manualSnippet: "manual instructions for cursor",
          },
        ],
      },
      retryClient: (client) => ({ client, outcome: "rewritten" }),
    });
    await renderScreen(bridge);
    await chooseFolder();
    fireEvent.click(await screen.findByText(/move vault/i));
    await screen.findByText(/now point at the new folder/i);

    const tryAgainButtons = screen.getAllByRole("button", { name: /try again/i });
    expect(tryAgainButtons).toHaveLength(1);

    fireEvent.click(tryAgainButtons[0] as HTMLElement);

    expect(bridge.relocation.retryClient).toHaveBeenCalledTimes(1);
    expect(bridge.relocation.retryClient).toHaveBeenCalledWith({ client: "cursor" });

    await waitFor(() => expect(screen.queryByText(/try again/i)).toBeNull());
    // claude-code and claude-desktop were rewritten from the original move
    // response and were never touched by the retry.
    expect(screen.getByText(/claude-code, claude-desktop, cursor/i)).toBeInTheDocument();
  });
});
