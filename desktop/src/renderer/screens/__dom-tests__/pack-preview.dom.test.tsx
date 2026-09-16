// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IpcResult } from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { PackPreviewScreen } from "../pack-preview.js";

const MARKDOWN =
  "## Heading\n\n**Bold** text with `code` and <img src=x onerror=alert(1)>\n\n1. one\n2. two";

/** Only `content.pack`, `content.copy`, and `content.export` are exercised by this screen; every other bridge call is a stub. */
function fakeBridge(): {
  bridge: ValijaBridge;
  copy: ReturnType<typeof vi.fn>;
  export_: ReturnType<typeof vi.fn>;
} {
  const copy = vi.fn().mockResolvedValue(undefined);
  const export_ = vi.fn(
    (): Promise<IpcResult<{ cancelled: boolean; path?: string }>> =>
      Promise.resolve({ ok: true, value: { cancelled: false, path: "/tmp/out.md" } }),
  );
  const bridge = {
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
      pack: vi.fn().mockResolvedValue({ ok: true, value: { markdown: MARKDOWN } }),
      export: export_,
      copy,
    },
    sync: { status: vi.fn() },
    diagnostics: { run: vi.fn(), copyReport: vi.fn() },
    relocation: {
      preflight: vi.fn(),
      move: vi.fn(),
      retryClient: vi.fn(),
      pointAtExisting: vi.fn(),
    },
    import: { list: vi.fn(), preview: vi.fn(), run: vi.fn() },
    tools: { status: vi.fn(), connect: vi.fn(), nodeStatus: vi.fn() },
    preferences: {
      read: vi
        .fn()
        .mockResolvedValue({ vaultPath: null, theme: "system", language: "en", tourSeen: false }),
      write: vi.fn(),
    },
    dialog: { chooseImportFile: vi.fn(), chooseVaultFolder: vi.fn() },
    // biome-ignore lint/suspicious/noExplicitAny: only content.pack/copy/export are exercised by this suite
  } as any as ValijaBridge;
  return { bridge, copy, export_ };
}

function renderScreen(bridge: ValijaBridge) {
  return render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <PackPreviewScreen bridge={bridge} project="valija" />
    </I18nProvider>,
  );
}

describe("PackPreviewScreen (DOM) — rendered/raw byte identity", () => {
  it("rendered view (the default): Copy sends the exact original markdown string", async () => {
    const { bridge, copy } = fakeBridge();
    renderScreen(bridge);
    await screen.findByRole("button", { name: "Rendered" });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(copy).toHaveBeenCalledWith({ text: MARKDOWN });
  });

  it("switching to raw: the <pre> textContent equals that same string exactly", async () => {
    const { bridge } = fakeBridge();
    const { container } = renderScreen(bridge);
    await screen.findByRole("button", { name: "Rendered" });

    fireEvent.click(screen.getByRole("button", { name: "Raw Markdown" }));
    expect(container.querySelector("pre.pack-text")?.textContent).toBe(MARKDOWN);
  });

  it("clicking Copy in the raw view sends the identical string", async () => {
    const { bridge, copy } = fakeBridge();
    renderScreen(bridge);
    await screen.findByRole("button", { name: "Rendered" });

    fireEvent.click(screen.getByRole("button", { name: "Raw Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(copy).toHaveBeenCalledWith({ text: MARKDOWN });
  });

  it("Export still calls bridge.content.export({ project, format }) with the select's value", async () => {
    const { bridge, export_ } = fakeBridge();
    renderScreen(bridge);
    await screen.findByRole("button", { name: "Rendered" });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "json" } });
    fireEvent.click(screen.getByRole("button", { name: "Export…" }));
    await screen.findByText("Saved to /tmp/out.md");
    expect(export_).toHaveBeenCalledWith({ project: "valija", format: "json" });
  });

  it("the rendered view contains no literal ##/** and no img/a element", async () => {
    const { bridge } = fakeBridge();
    const { container } = renderScreen(bridge);
    await screen.findByRole("button", { name: "Rendered" });

    const body = container.querySelector(".md-content");
    expect(body?.textContent).not.toContain("##");
    expect(body?.textContent).not.toContain("**");
    expect(body?.querySelectorAll("img")).toHaveLength(0);
    expect(body?.querySelectorAll("a")).toHaveLength(0);
    expect(body?.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
