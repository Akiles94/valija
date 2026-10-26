// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, type Mock, vi } from "vitest";
import { en } from "../../../shared/i18n/catalogs/en.js";
import { es } from "../../../shared/i18n/catalogs/es.js";
import type { AppPreferencesMessage, IpcResult } from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { SchemaTooNewScreen } from "../schema-too-new.js";

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

/** Every bridge method a fake `vi.fn()`; only `vault.lock` answers. */
function fakeBridge(
  lockResult: IpcResult<{ wasUnlocked: boolean; sidecars: string[] }>,
): FakeBridge {
  const bridge: FakeBridge = {};
  for (const [namespace, methods] of Object.entries(NAMESPACES)) {
    bridge[namespace] = Object.fromEntries(methods.map((m) => [m, vi.fn()]));
  }
  bridge.vault?.lock?.mockResolvedValue(lockResult);
  return bridge;
}

const prefs = (language: "en" | "es"): AppPreferencesMessage => ({
  vaultPath: null,
  theme: "system",
  language,
  tourSeen: false,
});

const VERSIONS = { vaultVersion: 5, supportedVersion: 4 };

function renderScreen(
  bridge: FakeBridge,
  { language = "en", theme }: { language?: "en" | "es"; theme?: "light" | "dark" } = {},
) {
  const onQuit = vi.fn();
  const onOpenSettings = vi.fn();
  const view = render(
    <I18nProvider preferences={prefs(language)}>
      <div data-theme={theme}>
        <SchemaTooNewScreen
          bridge={bridge as unknown as ValijaBridge}
          versions={VERSIONS}
          onOpenSettings={onOpenSettings}
          onQuit={onQuit}
        />
      </div>
    </I18nProvider>,
  );
  return { onQuit, onOpenSettings, view };
}

const lockedOk = { ok: true as const, value: { wasUnlocked: true, sidecars: [] } };

/** Each number sits in the `dd` right after its label's `dt`. */
function valueAfter(label: string): string | null | undefined {
  return screen.getByText(label).nextElementSibling?.textContent;
}

describe("SchemaTooNewScreen — the terminal 'Update Valija' screen (P-18 (b))", () => {
  it("en: the title and both numbers next to their labels", () => {
    renderScreen(fakeBridge(lockedOk));
    expect(screen.getByRole("heading", { name: en.schemaTooNew.title })).toBeInTheDocument();
    expect(valueAfter(en.schemaTooNew.vaultVersion)).toBe("5");
    expect(valueAfter(en.schemaTooNew.supportedVersion)).toBe("4");
    expect(screen.getByText(en.schemaTooNew.nothingChanged)).toBeInTheDocument();
    expect(screen.getByText(en.schemaTooNew.howToFix)).toBeInTheDocument();
  });

  it("es: the same, in Spanish", () => {
    renderScreen(fakeBridge(lockedOk), { language: "es" });
    expect(screen.getByRole("heading", { name: es.schemaTooNew.title })).toBeInTheDocument();
    expect(valueAfter(es.schemaTooNew.vaultVersion)).toBe("5");
    expect(valueAfter(es.schemaTooNew.supportedVersion)).toBe("4");
    expect(screen.getByRole("button", { name: es.schemaTooNew.lock })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: es.schemaTooNew.quit })).toBeInTheDocument();
  });

  it.each([
    "en",
    "es",
  ] as const)("%s: the actions are exactly Settings, Lock vault and Quit Valija", (language) => {
    renderScreen(fakeBridge(lockedOk), { language });
    const catalog = language === "en" ? en : es;
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual([
      catalog.common.settings,
      catalog.schemaTooNew.lock,
      catalog.schemaTooNew.quit,
    ]);
    for (const name of names) {
      expect(name).not.toMatch(
        /unlock|upgrade|continue|move|delete|desbloquear|actualizar y|mover|eliminar/i,
      );
    }
  });

  it("Lock calls vault.lock once, says the vault was locked, and the screen stays", async () => {
    const bridge = fakeBridge(lockedOk);
    renderScreen(bridge);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.schemaTooNew.lock }));
    });
    expect(bridge.vault?.lock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(en.schemaTooNew.locked);
    expect(screen.getByRole("heading", { name: en.schemaTooNew.title })).toBeInTheDocument();
  });

  it("Lock on an already-locked vault says so", async () => {
    renderScreen(fakeBridge({ ok: true, value: { wasUnlocked: false, sidecars: [] } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.schemaTooNew.lock }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(en.schemaTooNew.alreadyLocked);
  });

  it("a failed Lock shows the catalog copy for its code", async () => {
    renderScreen(fakeBridge({ ok: false, error: { code: "VAULT_NOT_FOUND" } }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.schemaTooNew.lock }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(en.errors.VAULT_NOT_FOUND);
  });

  it("Quit calls onQuit once; the gear opens Settings", () => {
    const { onQuit, onOpenSettings } = renderScreen(fakeBridge(lockedOk));
    fireEvent.click(screen.getByRole("button", { name: en.schemaTooNew.quit }));
    fireEvent.click(screen.getByRole("button", { name: en.common.settings }));
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("never modifies: after every interaction, no bridge method but vault.lock was called", async () => {
    const bridge = fakeBridge(lockedOk);
    renderScreen(bridge);
    await act(async () => {
      for (const button of screen.getAllByRole("button")) fireEvent.click(button);
    });
    for (const [namespace, methods] of Object.entries(bridge)) {
      for (const [method, fn] of Object.entries(methods)) {
        if (namespace === "vault" && method === "lock") continue;
        expect(fn, `${namespace}.${method}`).not.toHaveBeenCalled();
      }
    }
  });

  it("renders identical text under a light and a dark theme wrapper", () => {
    const light = renderScreen(fakeBridge(lockedOk), { theme: "light" });
    const lightText = light.view.container.textContent;
    light.view.unmount();
    const dark = renderScreen(fakeBridge(lockedOk), { theme: "dark" });
    expect(dark.view.container.textContent).toBe(lightText);
  });

  it("its styles use colour only through design tokens, so both themes apply", () => {
    const css = readFileSync(join(import.meta.dirname, "../../styles/screens.css"), "utf8");
    const rules = [
      ...css.matchAll(/([^{}]*\.(?:schema-too-new|schema-versions)[^{}]*)\{([^}]*)\}/g),
    ];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, , body] of rules) {
      expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      for (const declaration of (body ?? "").split(";")) {
        if (/^\s*(color|background(-color)?|border(-color)?)\s*:/.test(declaration)) {
          expect(declaration).toMatch(/var\(--/);
        }
      }
    }
  });
});
