// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { copyForErrorCode } from "../../../shared/i18n/error-copy.js";
import type {
  AppPreferencesMessage,
  BindingMessage,
  BindingsInspectResponse,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { ProjectScreen } from "../project.js";

// Remotes appear only in their normalized form (no scheme): this file is scanned by
// no-network-surface.test.ts (F12).
const REPO_BINDING: BindingMessage = {
  id: "01BIND000001",
  project: "valija",
  kind: "repository",
  target: "github.com/oscar/valija",
  createdAt: "2026-10-19T10:00:00.000Z",
};
const FOLDER_BINDING: BindingMessage = {
  id: "01BIND000002",
  project: "valija",
  kind: "folder",
  target: "~/code/valija-notes",
  createdAt: "2026-10-19T10:05:00.000Z",
};

function inspection(overrides: Partial<BindingsInspectResponse> = {}): BindingsInspectResponse {
  return {
    displayName: "valija",
    resolvesTo: null,
    isRepository: true,
    remote: "github.com/oscar/valija",
    canLinkFolder: true,
    ...overrides,
  };
}

interface FakeOptions {
  bindings?: BindingMessage[];
  inspect?: BindingsInspectResponse;
  chosen?: { handle: string; displayName: string } | null;
}

/** Only `bindings.*`, `dialog.chooseProjectFolder` and an empty `content.show` matter here. */
function fakeBridge({ bindings = [], inspect = inspection(), chosen }: FakeOptions = {}) {
  const bridge = {
    content: { show: vi.fn().mockResolvedValue({ ok: true, value: [] }) },
    preferences: { read: vi.fn(), write: vi.fn() },
    dialog: {
      chooseImportFile: vi.fn(),
      chooseVaultFolder: vi.fn(),
      chooseProjectFolder: vi
        .fn()
        .mockResolvedValue(
          chosen === undefined ? { handle: "pf-1", displayName: "valija" } : chosen,
        ),
    },
    bindings: {
      list: vi.fn().mockResolvedValue({ ok: true, value: bindings }),
      inspect: vi.fn().mockResolvedValue({ ok: true, value: inspect }),
      link: vi.fn().mockResolvedValue({ ok: true, value: { changed: true } }),
      unlink: vi.fn().mockResolvedValue({ ok: true, value: REPO_BINDING }),
    },
  };
  return { bridge, asBridge: bridge as unknown as ValijaBridge };
}

function renderScreen(bridge: ValijaBridge, preferences?: Partial<AppPreferencesMessage>) {
  return render(
    <I18nProvider
      preferences={{
        vaultPath: null,
        theme: "system",
        language: "en",
        tourSeen: false,
        ...preferences,
      }}
    >
      <ProjectScreen bridge={bridge} project="valija" onViewPack={vi.fn()} />
    </I18nProvider>,
  );
}

const section = () => screen.getByRole("region", { name: "Linked folders & repositories" });

async function openInspectPanel() {
  fireEvent.click(await screen.findByRole("button", { name: "Link a folder…" }));
  return screen.findByRole("button", { name: "Link" });
}

describe("Linked folders & repositories (DOM)", () => {
  it("lists one row per binding with its kind, target and an Unlink button", async () => {
    const { bridge, asBridge } = fakeBridge({ bindings: [REPO_BINDING, FOLDER_BINDING] });
    renderScreen(asBridge);

    const rows = await within(section()).findAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Repository");
    expect(rows[0]?.textContent).toContain("github.com/oscar/valija");
    expect(rows[1]?.textContent).toContain("Folder");
    expect(rows[1]?.textContent).toContain("~/code/valija-notes");
    expect(within(section()).getAllByRole("button", { name: "Unlink" })).toHaveLength(2);
    expect(bridge.bindings.list).toHaveBeenCalledWith({ projectName: "valija" });
  });

  it("shows the empty copy when nothing is linked", async () => {
    const { asBridge } = fakeBridge();
    renderScreen(asBridge);
    expect(await screen.findByText("Nothing is linked to this project yet.")).toBeTruthy();
  });

  it("Unlink removes by id, then reloads the list", async () => {
    const { bridge, asBridge } = fakeBridge({ bindings: [REPO_BINDING] });
    renderScreen(asBridge);

    fireEvent.click(await screen.findByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(bridge.bindings.list).toHaveBeenCalledTimes(2));
    expect(bridge.bindings.unlink).toHaveBeenCalledWith({ bindingId: "01BIND000001" });
  });

  it("Link a folder… opens the picker, inspects the handle, and defaults to the repository", async () => {
    const { bridge, asBridge } = fakeBridge();
    renderScreen(asBridge);
    await openInspectPanel();

    expect(bridge.dialog.chooseProjectFolder).toHaveBeenCalledTimes(1);
    expect(bridge.bindings.inspect).toHaveBeenCalledWith({ handle: "pf-1" });
    expect(screen.getByText("Git repository: github.com/oscar/valija")).toBeTruthy();
    expect(screen.getByText("Right now this folder isn't linked to any project.")).toBeTruthy();
    const repository = screen.getByRole("radio", {
      name: "Link this repository (any clone, on any device)",
    }) as HTMLInputElement;
    expect(repository.checked).toBe(true);
  });

  it("choosing Link only this folder sends by: folder, then closes the panel and reloads", async () => {
    const { bridge, asBridge } = fakeBridge();
    renderScreen(asBridge);
    const linkButton = await openInspectPanel();

    fireEvent.click(screen.getByRole("radio", { name: "Link only this folder" }));
    fireEvent.click(linkButton);
    await waitFor(() =>
      expect(bridge.bindings.link).toHaveBeenCalledWith({
        handle: "pf-1",
        projectName: "valija",
        by: "folder",
      }),
    );
    await waitFor(() => expect(bridge.bindings.list).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
  });

  it("a folder that already resolves says to which project and how", async () => {
    const { asBridge } = fakeBridge({
      inspect: inspection({ resolvesTo: { project: "billing", kind: "repository" } }),
    });
    renderScreen(asBridge);
    await openInspectPanel();
    expect(
      screen.getByText("Right now this folder belongs to billing (linked repository)."),
    ).toBeTruthy();
  });

  it("a plain folder offers only the folder option; a too-broad one offers no Link button", async () => {
    const plain = fakeBridge({ inspect: inspection({ isRepository: false, remote: null }) });
    const { unmount } = renderScreen(plain.asBridge);
    await openInspectPanel();
    expect(screen.getByText("Not a git repository.")).toBeTruthy();
    expect(within(section()).getAllByRole("radio")).toHaveLength(1);
    unmount();

    const broad = fakeBridge({
      inspect: inspection({ isRepository: false, remote: null, canLinkFolder: false }),
    });
    renderScreen(broad.asBridge);
    fireEvent.click(await screen.findByRole("button", { name: "Link a folder…" }));
    expect(await screen.findByText(copyForErrorCode("INVALID_WORKSPACE_PATH", "en"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
  });

  it("a cancelled picker calls neither inspect nor link", async () => {
    const { bridge, asBridge } = fakeBridge({ chosen: null });
    renderScreen(asBridge);
    fireEvent.click(await screen.findByRole("button", { name: "Link a folder…" }));
    await waitFor(() => expect(bridge.dialog.chooseProjectFolder).toHaveBeenCalledTimes(1));
    expect(bridge.bindings.inspect).not.toHaveBeenCalled();
    expect(bridge.bindings.link).not.toHaveBeenCalled();
  });

  it("a refused link shows the catalog copy for its code", async () => {
    const { bridge, asBridge } = fakeBridge();
    bridge.bindings.link.mockResolvedValue({ ok: false, error: { code: "BINDING_CONFLICT" } });
    renderScreen(asBridge);
    fireEvent.click(await openInspectPanel());
    expect(await screen.findByText(copyForErrorCode("BINDING_CONFLICT", "en"))).toBeTruthy();
  });

  it("a rejected call shows the generic UNEXPECTED copy", async () => {
    const { bridge, asBridge } = fakeBridge();
    bridge.bindings.link.mockRejectedValue(new Error("main process gone"));
    renderScreen(asBridge);
    fireEvent.click(await openInspectPanel());
    expect(await screen.findByText(copyForErrorCode("UNEXPECTED", "en"))).toBeTruthy();
  });

  it("a repeat link says nothing changed", async () => {
    const { bridge, asBridge } = fakeBridge();
    bridge.bindings.link.mockResolvedValue({ ok: true, value: { changed: false } });
    renderScreen(asBridge);
    fireEvent.click(await openInspectPanel());
    expect(
      await screen.findByText("Already linked to this project. Nothing changed."),
    ).toBeTruthy();
  });

  it("nothing about links is ever written to preferences", async () => {
    const { bridge, asBridge } = fakeBridge({ bindings: [REPO_BINDING] });
    renderScreen(asBridge);
    fireEvent.click(await openInspectPanel());
    await waitFor(() => expect(bridge.bindings.link).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(bridge.bindings.unlink).toHaveBeenCalled());
    expect(bridge.preferences.write).not.toHaveBeenCalled();
  });

  it("renders in Spanish", async () => {
    const { asBridge } = fakeBridge();
    renderScreen(asBridge, { language: "es" });
    expect(await screen.findByRole("button", { name: "Vincular una carpeta…" })).toBeTruthy();
    expect(screen.getByText("Carpetas y repositorios vinculados")).toBeTruthy();
  });
});
