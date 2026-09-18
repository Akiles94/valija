// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderRecoveryKit } from "../../../../../src/vault/infra/recovery-kit.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { RecoveryKitScreen } from "../recovery-kit.js";

// Read the fixture manifest directly with this file's own `import.meta.dirname`
// rather than importing golden-vault.ts's helper — that module resolves its
// fixture path from its *own* `import.meta.url`, which does not survive
// Vitest's jsdom module pipeline the way it does under the plain Node
// environment every other test in this repo uses.
const GOLDEN_VAULT_DIR = join(
  import.meta.dirname,
  "../../../../../src/testing/__fixtures__/golden-vault",
);
const manifest = JSON.parse(readFileSync(join(GOLDEN_VAULT_DIR, "manifest.json"), "utf8")) as {
  vaultId: string;
  keyHex: string;
  createdAt: string;
};

/**
 * P-D5 (reversed 2026-08-20): the recovery-kit screen is the one screen
 * holding the product's only unrecoverable secret, machine-checked rather
 * than only reviewed. Uses the published golden-vault fixture's key
 * material — public test data by design, never a real key.
 */
function fakeBridge(kitText: string | null): ValijaBridge {
  const copy = vi.fn();
  return {
    vault: {
      init: vi.fn(),
      readRecoveryKit: vi.fn().mockResolvedValue(kitText === null ? null : { text: kitText }),
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
      copy,
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
    dialog: { chooseImportFile: vi.fn(), chooseVaultFolder: vi.fn() },
    // biome-ignore lint/suspicious/noExplicitAny: copy is the only method this suite asserts against
  } as any as ValijaBridge & { content: { copy: typeof copy } };
}

const expectedKitText = renderRecoveryKit(manifest.vaultId, manifest.keyHex, manifest.createdAt);

async function renderScreen(bridge: ValijaBridge, onAcknowledged = vi.fn()) {
  render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <RecoveryKitScreen bridge={bridge} onAcknowledged={onAcknowledged} />
    </I18nProvider>,
  );
  // The kit is fetched asynchronously on mount; let that microtask resolve.
  await screen.findByText(manifest.vaultId, { exact: false });
  return { onAcknowledged };
}

/**
 * For the already-consumed case, no key text ever appears, so there is no
 * DOM change to wait for (as `renderScreen` does via `findByText`). Instead,
 * flush the effect's own fetch promise inside `act` so its `setState` is
 * applied before we assert.
 */
async function renderScreenWithNoKit(bridge: ValijaBridge, onAcknowledged = vi.fn()) {
  render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <RecoveryKitScreen bridge={bridge} onAcknowledged={onAcknowledged} />
    </I18nProvider>,
  );
  await act(async () => {
    await bridge.vault.readRecoveryKit();
  });
  return { onAcknowledged };
}

describe("RecoveryKitScreen (DOM)", () => {
  it("renders renderRecoveryKit's output verbatim, not a re-derived or re-formatted version", async () => {
    await renderScreen(fakeBridge(expectedKitText));
    const pre = document.querySelector("pre.kit-text");
    expect(pre?.textContent).toBe(expectedKitText);
  });

  it("before acknowledgement, Copy key and the checkbox are the only interactive elements", async () => {
    await renderScreen(fakeBridge(expectedKitText));
    const buttons = screen.getAllByRole("button");
    const checkboxes = screen.getAllByRole("checkbox");
    const links = screen.queryAllByRole("link");

    expect(links).toHaveLength(0);
    expect(checkboxes).toHaveLength(1);
    // Two buttons exist (Copy key, Continue) — Continue must be disabled.
    expect(buttons).toHaveLength(2);
    const continueButton = buttons.find((b) => b !== screen.getByText(/copy key/i));
    expect(continueButton).toBeDisabled();
  });

  it("no route change (onAcknowledged) is reachable until the checkbox is checked", async () => {
    const { onAcknowledged } = await renderScreen(fakeBridge(expectedKitText));
    const continueButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.match(/continue|continuar/i));
    if (continueButton === undefined) throw new Error("expected a Continue button");

    fireEvent.click(continueButton); // disabled — must be a no-op
    expect(onAcknowledged).not.toHaveBeenCalled();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.click(continueButton);
    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });

  it("Copy key calls the bridge's clipboard write with the exact kit text", async () => {
    const bridge = fakeBridge(expectedKitText) as ValijaBridge & {
      content: { copy: ReturnType<typeof vi.fn> };
    };
    await renderScreen(bridge);
    fireEvent.click(screen.getByText(/copy key/i));
    expect(bridge.content.copy).toHaveBeenCalledWith({ text: expectedKitText });
  });

  it("a second read (kit already consumed) renders no key material at all", async () => {
    await renderScreenWithNoKit(fakeBridge(null));
    expect(document.querySelector("pre.kit-text")?.textContent).toBe("");
    expect(screen.queryByText(manifest.vaultId)).toBeNull();
  });
});
