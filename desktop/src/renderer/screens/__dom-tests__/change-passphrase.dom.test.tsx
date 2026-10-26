// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import { en } from "../../../shared/i18n/catalogs/en.js";
import { es } from "../../../shared/i18n/catalogs/es.js";
import type { AppPreferencesMessage } from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { ChangePassphraseScreen } from "../change-passphrase.js";

type FakeBridge = Record<string, Record<string, Mock>>;

const NAMESPACES: Record<string, string[]> = {
  vault: [
    "init",
    "readRecoveryKit",
    "unlock",
    "lock",
    "status",
    "upgradeCheck",
    "changePassphrase",
  ],
  content: [
    "projects",
    "show",
    "search",
    "pack",
    "export",
    "copy",
    "setPinned",
    "setArchived",
    "edit",
  ],
  sync: ["status"],
  diagnostics: ["run", "copyReport"],
  relocation: ["preflight", "move", "retryClient", "pointAtExisting"],
  import: ["list", "preview", "run"],
  tools: ["status", "connect", "nodeStatus"],
  preferences: ["read", "write"],
  dialog: ["chooseImportFile", "chooseVaultFolder", "chooseProjectFolder"],
  bindings: ["inspect", "link", "unlink", "list"],
};

const OK = {
  ok: true as const,
  value: { vaultId: "01TESTVAULT", issuedAt: "2026-10-26T00:00:00Z", generation: 4 },
};

/** Every bridge method a fake `vi.fn()`; only `sync.status` and `vault.changePassphrase` answer. */
function fakeBridge(
  {
    cloud = false,
    result = { ...OK, value: { ...OK.value, unlockedOnThisDevice: true } },
  } = {} as {
    cloud?: boolean;
    result?: unknown;
  },
): FakeBridge {
  const bridge: FakeBridge = {};
  for (const [namespace, methods] of Object.entries(NAMESPACES)) {
    bridge[namespace] = Object.fromEntries(methods.map((m) => [m, vi.fn()]));
  }
  bridge.sync?.status?.mockResolvedValue({
    conflictedCopies: [],
    staleBackups: [],
    rekeyBackups: [],
    looksLikeCloud: cloud,
    resolvedStateHome: "/state",
  });
  bridge.vault?.changePassphrase?.mockResolvedValue(result);
  return bridge;
}

const prefs = (language: "en" | "es"): AppPreferencesMessage => ({
  vaultPath: null,
  theme: "system",
  language,
  tourSeen: false,
});

const CURRENT = "the current test phrase";
const NEW = "a different test phrase";

async function renderScreen(bridge: FakeBridge, language: "en" | "es" = "en") {
  const onCancel = vi.fn();
  const onChanged = vi.fn();
  const view = render(
    <I18nProvider preferences={prefs(language)}>
      <ChangePassphraseScreen
        bridge={bridge as unknown as ValijaBridge}
        onCancel={onCancel}
        onChanged={onChanged}
      />
    </I18nProvider>,
  );
  await act(async () => {}); // let sync.status resolve
  return { onCancel, onChanged, view };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillValid(current = CURRENT) {
  type(en.changePassphrase.currentLabel, current);
  type(en.changePassphrase.newLabel, NEW);
  type(en.changePassphrase.confirmLabel, NEW);
}

const submitButton = () => screen.getByRole("button", { name: en.changePassphrase.submit });

describe("ChangePassphraseScreen (REKEY)", () => {
  it.each([
    ["en", en],
    ["es", es],
  ] as const)("%s: the title, the explainer and the old-copies sentence", async (language, catalog) => {
    await renderScreen(fakeBridge(), language);
    expect(
      screen.getByRole("heading", { name: catalog.changePassphrase.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(catalog.changePassphrase.explainer)).toBeInTheDocument();
    expect(screen.getByText(catalog.changePassphrase.oldCopies)).toBeInTheDocument();
  });

  it("local folder: no checkbox, and a valid form can submit", async () => {
    await renderScreen(fakeBridge());
    expect(screen.queryByLabelText(en.changePassphrase.confirmOtherDevices)).toBeNull();
    fillValid();
    expect(submitButton()).toBeEnabled();
  });

  it("cloud folder: the warning and a checkbox; Submit stays disabled until it is ticked", async () => {
    const bridge = fakeBridge({ cloud: true });
    await renderScreen(bridge);
    expect(screen.getByText(en.changePassphrase.cloudWarning)).toBeInTheDocument();
    fillValid();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText(en.changePassphrase.confirmOtherDevices));
    expect(submitButton()).toBeEnabled();
    await act(async () => fireEvent.click(submitButton()));
    expect(bridge.vault?.changePassphrase).toHaveBeenCalledWith({
      current: { passphrase: CURRENT },
      newPassphrase: NEW,
      otherDevicesConfirmed: true,
    });
  });

  it("a short or mismatched new passphrase shows inline copy, and changePassphrase is never called", async () => {
    const bridge = fakeBridge();
    await renderScreen(bridge);
    type(en.changePassphrase.currentLabel, CURRENT);
    type(en.changePassphrase.newLabel, "short");
    expect(screen.getByText(en.changePassphrase.tooShort)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    type(en.changePassphrase.newLabel, NEW);
    type(en.changePassphrase.confirmLabel, `${NEW} typo`);
    expect(screen.getByText(en.changePassphrase.mismatch)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    fireEvent.submit(submitButton());
    expect(bridge.vault?.changePassphrase).not.toHaveBeenCalled();
  });

  it("the recovery-key toggle sends current.recoveryKeyHex, not passphrase", async () => {
    const bridge = fakeBridge();
    await renderScreen(bridge);
    fireEvent.click(screen.getByLabelText(en.changePassphrase.useRecoveryKey));
    type(en.changePassphrase.recoveryKeyLabel, "  abcd  ");
    type(en.changePassphrase.newLabel, NEW);
    type(en.changePassphrase.confirmLabel, NEW);
    await act(async () => fireEvent.click(submitButton()));
    expect(bridge.vault?.changePassphrase).toHaveBeenCalledWith({
      current: { recoveryKeyHex: "abcd" },
      newPassphrase: NEW,
      otherDevicesConfirmed: false,
    });
  });

  it("busy: Re-encrypting… shows and every input is disabled", async () => {
    const bridge = fakeBridge();
    let finish: (value: unknown) => void = () => {};
    bridge.vault?.changePassphrase?.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByText(en.changePassphrase.working)).toBeInTheDocument();
    for (const input of screen.getAllByRole("checkbox")) expect(input).toBeDisabled();
    expect(screen.getByLabelText(en.changePassphrase.newLabel)).toBeDisabled();
    await act(async () => finish({ ...OK, value: { ...OK.value, unlockedOnThisDevice: true } }));
  });

  it("ok with unlockedOnThisDevice false → onChanged(false) once; the fields are cleared", async () => {
    const bridge = fakeBridge({
      result: { ...OK, value: { ...OK.value, unlockedOnThisDevice: false } },
    });
    const { onChanged } = await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(en.changePassphrase.currentLabel)).toHaveValue("");
  });

  it("PASSPHRASE_UNCHANGED → its copy inline, onChanged not called", async () => {
    const bridge = fakeBridge({ result: { ok: false, error: { code: "PASSPHRASE_UNCHANGED" } } });
    const { onChanged } = await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByText(en.errors.PASSPHRASE_UNCHANGED)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("a rejected changePassphrase call: unexpected copy, fields cleared, not stuck, Cancel still works (W2)", async () => {
    const bridge = fakeBridge();
    bridge.vault?.changePassphrase?.mockRejectedValue(new Error("main process threw"));
    const { onCancel, onChanged } = await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByText(en.changePassphrase.unexpected)).toBeInTheDocument();
    expect(screen.queryByText(en.changePassphrase.working)).toBeNull();
    for (const label of [
      en.changePassphrase.currentLabel,
      en.changePassphrase.newLabel,
      en.changePassphrase.confirmLabel,
    ]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
      expect(screen.getByLabelText(label)).toBeEnabled();
    }
    expect(onChanged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("a rejected sync.status: cloud unknown, so the confirmation is required, never a dead Submit (W2)", async () => {
    const bridge = fakeBridge();
    bridge.sync?.status?.mockRejectedValue(new Error("status failed"));
    await renderScreen(bridge);
    expect(screen.getByText(en.changePassphrase.cloudUnknown)).toBeInTheDocument();
    expect(screen.queryByText(en.changePassphrase.cloudWarning)).toBeNull();
    fillValid();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByLabelText(en.changePassphrase.confirmOtherDevices));
    expect(submitButton()).toBeEnabled();
    await act(async () => fireEvent.click(submitButton()));
    expect(bridge.vault?.changePassphrase).toHaveBeenCalledWith({
      current: { passphrase: CURRENT },
      newPassphrase: NEW,
      otherDevicesConfirmed: true,
    });
  });

  it.each([
    ["en", en],
    ["es", es],
  ] as const)("%s: an unresolved REKEY_FAILED never says nothing changed (W4)", async (language, catalog) => {
    const bridge = fakeBridge({
      result: { ok: false, error: { code: "REKEY_FAILED", unresolved: true } },
    });
    await renderScreen(bridge, language);
    type(catalog.changePassphrase.currentLabel, CURRENT);
    type(catalog.changePassphrase.newLabel, NEW);
    type(catalog.changePassphrase.confirmLabel, NEW);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: catalog.changePassphrase.submit })),
    );
    expect(screen.getByText(catalog.changePassphrase.failedUnresolved)).toBeInTheDocument();
    expect(screen.queryByText(catalog.errors.REKEY_FAILED)).toBeNull();
    expect(catalog.changePassphrase.failedUnresolved).toContain("valija doctor");
  });

  it("a plain REKEY_FAILED shows its catalog copy (the current passphrase still works)", async () => {
    const bridge = fakeBridge({ result: { ok: false, error: { code: "REKEY_FAILED" } } });
    await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    expect(screen.getByText(en.errors.REKEY_FAILED)).toBeInTheDocument();
  });

  it("Cancel calls onCancel and clears the fields", async () => {
    const { onCancel } = await renderScreen(fakeBridge());
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(en.changePassphrase.newLabel)).toHaveValue("");
  });

  it("never modifies anything else: only sync.status and vault.changePassphrase are called", async () => {
    const bridge = fakeBridge();
    await renderScreen(bridge);
    fillValid();
    await act(async () => fireEvent.click(submitButton()));
    for (const [namespace, methods] of Object.entries(bridge)) {
      for (const [method, fn] of Object.entries(methods)) {
        const allowed =
          (namespace === "sync" && method === "status") ||
          (namespace === "vault" && method === "changePassphrase");
        if (!allowed) expect(fn, `${namespace}.${method}`).not.toHaveBeenCalled();
      }
    }
    expect(bridge.sync?.status).toHaveBeenCalledTimes(1);
  });

  it("never renders a 64-hex run", async () => {
    const { view } = await renderScreen(fakeBridge({ cloud: true }));
    fillValid();
    expect(view.container.textContent ?? "").not.toMatch(/[0-9a-f]{64}/i);
  });
});
