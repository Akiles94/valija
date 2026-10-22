// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AppPreferencesMessage,
  ContextItemMessage,
  IpcResult,
} from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { ProjectScreen } from "../project.js";

function item(overrides: Partial<ContextItemMessage>): ContextItemMessage {
  return {
    id: overrides.id ?? "item-1",
    project: "valija",
    type: "fact",
    content: "plain content",
    tags: [],
    pinned: false,
    createdAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

/** `content.show` (archived rows only on `includeArchived`) plus the two curation calls; every other bridge call is a stub. */
function fakeBridge(items: ContextItemMessage[]): ValijaBridge {
  const show = vi.fn(
    (req: { includeArchived?: boolean }): Promise<IpcResult<ContextItemMessage[]>> =>
      Promise.resolve({
        ok: true,
        value: req.includeArchived ? items : items.filter((i) => !i.archived),
      }),
  );
  const changed = (): Promise<IpcResult<{ changed: boolean }>> =>
    Promise.resolve({ ok: true, value: { changed: true } });
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
      show,
      search: vi.fn(),
      pack: vi.fn(),
      export: vi.fn(),
      copy: vi.fn(),
      setPinned: vi.fn(changed),
      setArchived: vi.fn(changed),
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
    // biome-ignore lint/suspicious/noExplicitAny: only content.show is exercised by this suite
  } as any as ValijaBridge;
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
      {/* No onBack: GUI-LAYOUT §4.3 replaced the per-screen Back button with the shell's breadcrumb. */}
      <ProjectScreen bridge={bridge} project="valija" onViewPack={vi.fn()} />
    </I18nProvider>,
  );
}

describe("ProjectScreen (DOM)", () => {
  it("renders one bordered card per item inside the list", async () => {
    const bridge = fakeBridge([item({ id: "1" }), item({ id: "2" }), item({ id: "3" })]);
    const { container } = renderScreen(bridge);

    const cards = await screen.findAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(container.querySelectorAll("ul.item-list li.item-row")).toHaveLength(3);
  });

  it("a pinned item shows the star and the pinned word; an unpinned item shows neither", async () => {
    const bridge = fakeBridge([
      item({ id: "pinned", type: "decision", pinned: true }),
      item({ id: "plain", pinned: false }),
    ]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    const pinnedRow = container.querySelector("li.item-row.pinned");
    expect(pinnedRow).not.toBeNull();
    expect(pinnedRow?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(pinnedRow?.textContent).toContain("Pinned");

    const rows = container.querySelectorAll("li.item-row");
    const plainRow = Array.from(rows).find((row) => !row.classList.contains("pinned"));
    expect(plainRow).not.toBeUndefined();
    expect(plainRow?.querySelector("svg")).toBeNull();
    expect(plainRow?.textContent).not.toContain("Pinned");
  });

  it("when every item is pinned, no empty 'Other items' section renders", async () => {
    const bridge = fakeBridge([item({ id: "1", pinned: true }), item({ id: "2", pinned: true })]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    expect(screen.getByRole("heading", { name: "Pinned" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Other items" })).toBeNull();
    expect(container.querySelectorAll("ul.item-list")).toHaveLength(1);
  });

  it("the type label is the raw domain value, never translated", async () => {
    const bridge = fakeBridge([item({ id: "1", type: "decision", pinned: true })]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    expect(container.querySelector(".item-type")?.textContent).toBe("decision");
  });

  it("tags render as separate pills, not one joined string; no tags means no tag row", async () => {
    const bridge = fakeBridge([
      item({ id: "tagged", tags: ["mcp", "claude-code", "connection", "gui", "debugging"] }),
      item({ id: "untagged", tags: [] }),
    ]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    const rows = container.querySelectorAll("li.item-row");
    const taggedRow = rows[0] as HTMLElement;
    const untaggedRow = rows[1] as HTMLElement;
    expect(taggedRow.querySelectorAll(".item-tag")).toHaveLength(5);
    expect(taggedRow.textContent).not.toContain("mcp, claude-code");
    expect(untaggedRow.querySelector(".item-tags")).toBeNull();
  });

  it("renders headings, bold, inline code and an ordered list with no literal Markdown characters", async () => {
    const bridge = fakeBridge([
      item({
        id: "1",
        content: "## Diagnóstico\n\n**Síntoma:** el `mcp` no responde\n\n1. uno\n2. dos",
      }),
    ]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    const heading = container.querySelector(".md-heading");
    expect(heading?.textContent).toBe("Diagnóstico");
    expect(container.querySelector("strong")?.textContent).toBe("Síntoma:");
    expect(container.querySelector("code")?.textContent).toBe("mcp");
    const list = container.querySelector("ol.md-list");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
    const cardText = container.querySelector(".item-content")?.textContent ?? "";
    expect(container.querySelector(".item-content")?.querySelectorAll("h1, h2, h3")).toHaveLength(
      0,
    );

    expect(cardText).not.toContain("##");
    expect(cardText).not.toContain("**");
  });

  it("content containing a raw <img onerror> tag never creates an img or a elements, and shows as visible text", async () => {
    const bridge = fakeBridge([item({ id: "1", content: "<img src=x onerror=alert(1)>" })]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelector(".item-content")?.textContent).toContain(
      "<img src=x onerror=alert(1)>",
    );
  });

  it("a long item collapses with a toggle, and the toggle expands and re-collapses it", async () => {
    const bridge = fakeBridge([item({ id: "1", content: "a".repeat(500) })]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".item-content.collapsed")).not.toBeNull();
    expect(container.querySelector(".item-fade")).not.toBeNull();

    fireEvent.click(toggle);
    expect(await screen.findByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(container.querySelector(".item-content.collapsed")).toBeNull();
    expect(container.querySelector(".item-fade")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(await screen.findByRole("button", { name: "Show more" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("expanding one card does not affect another long card", async () => {
    const bridge = fakeBridge([
      item({ id: "first", content: "a".repeat(500) }),
      item({ id: "second", content: "b".repeat(500) }),
    ]);
    renderScreen(bridge);
    await screen.findAllByRole("listitem");

    const toggles = screen.getAllByRole("button", { name: "Show more" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0] as HTMLElement);

    expect(await screen.findByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("a short item renders no toggle and no collapsed class — never clipped without a control", async () => {
    const bridge = fakeBridge([item({ id: "1", content: "one short sentence" })]);
    const { container } = renderScreen(bridge);
    await screen.findAllByRole("listitem");

    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
    expect(container.querySelector(".item-content.collapsed")).toBeNull();
  });

  it("expanding a card then reloading (window focus) resets it to collapsed", async () => {
    const bridge = fakeBridge([item({ id: "1", content: "a".repeat(500) })]);
    renderScreen(bridge);
    await screen.findAllByRole("listitem");

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByRole("button", { name: "Show less" });

    fireEvent.focus(window);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument(),
    );
  });

  it("switching language translates the toggle and pinned word, never the type or the saved content", async () => {
    const bridge = fakeBridge([
      item({ id: "1", type: "decision", pinned: true, content: `${"a".repeat(500)}` }),
    ]);
    const { container } = renderScreen(bridge, { language: "es" });
    await screen.findAllByRole("listitem");

    expect(screen.getByRole("button", { name: "Ver más" })).toBeInTheDocument();
    expect(container.querySelector(".item-pinned")?.textContent).toBe("Fijado");
    expect(container.querySelector(".item-type")?.textContent).toBe("decision");
    expect(container.querySelector(".item-content")?.textContent).toBe("a".repeat(500));
  });
});

describe("ProjectScreen curation (DOM)", () => {
  const button = (name: string) => screen.getByRole("button", { name });

  it("offers Pin and Archive on a live card, Unpin on a pinned one, and only Archive on an imported one", async () => {
    const bridge = fakeBridge([
      item({ id: "live", content: "live item" }),
      item({ id: "pinned", content: "pinned item", pinned: true }),
      item({ id: "imp", content: "imported item", type: "imported" }),
    ]);
    const { container } = renderScreen(bridge);
    await screen.findByText("live item");
    const actionsOf = (text: string) =>
      [...(screen.getByText(text).closest("li")?.querySelectorAll(".item-action") ?? [])].map(
        (b) => b.textContent,
      );
    expect(actionsOf("live item")).toEqual(["Pin", "Archive"]);
    expect(actionsOf("pinned item")).toEqual(["Unpin", "Archive"]);
    expect(actionsOf("imported item")).toEqual(["Archive"]);
    expect(container.querySelectorAll(".item-row")).toHaveLength(3);
  });

  it("Pin calls setPinned and reloads the list", async () => {
    const bridge = fakeBridge([item({ id: "a1", content: "pin me" })]);
    renderScreen(bridge);
    await screen.findByText("pin me");
    fireEvent.click(button("Pin"));
    await waitFor(() => expect(bridge.content.show).toHaveBeenCalledTimes(2));
    expect(bridge.content.setPinned).toHaveBeenCalledWith({ id: "a1", pinned: true });
  });

  it("Archive shows a notice whose Undo unarchives", async () => {
    const bridge = fakeBridge([item({ id: "a2", content: "archive me" })]);
    renderScreen(bridge);
    await screen.findByText("archive me");
    fireEvent.click(button("Archive"));
    await screen.findByText(/Archived — hidden from packs and search\./);
    expect(bridge.content.setArchived).toHaveBeenCalledWith({ id: "a2", archived: true });
    fireEvent.click(button("Undo"));
    await waitFor(() =>
      expect(bridge.content.setArchived).toHaveBeenLastCalledWith({ id: "a2", archived: false }),
    );
  });

  it("Show archived requests archived rows and renders them last, marked, with only Unarchive", async () => {
    const bridge = fakeBridge([
      item({ id: "keep", content: "still live" }),
      item({ id: "gone", content: "retired item", archived: true }),
    ]);
    renderScreen(bridge);
    await screen.findByText("still live");
    expect(screen.queryByText("retired item")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    const retired = await screen.findByText("retired item");
    expect(bridge.content.show).toHaveBeenLastCalledWith({
      project: "valija",
      includeArchived: true,
    });
    const card = retired.closest("li");
    expect(card?.className).toContain("archived");
    expect(screen.getByRole("heading", { name: "Archived" })).toBeTruthy();
    expect([...(card?.querySelectorAll(".item-action") ?? [])].map((b) => b.textContent)).toEqual([
      "Unarchive",
    ]);
  });

  it("renders the catalog copy for a refused action", async () => {
    const bridge = fakeBridge([item({ id: "a3", content: "refused" })]);
    vi.mocked(bridge.content.setPinned).mockResolvedValueOnce({
      ok: false,
      error: { code: "ITEM_ARCHIVED" },
    });
    renderScreen(bridge);
    await screen.findByText("refused");
    fireEvent.click(button("Pin"));
    await screen.findByText("That item is archived — unarchive it first.");
  });

  it("never persists the toggle or an action to preferences", async () => {
    const bridge = fakeBridge([item({ id: "a4", content: "private state" })]);
    renderScreen(bridge);
    await screen.findByText("private state");
    fireEvent.click(screen.getByRole("checkbox", { name: "Show archived" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(bridge.content.setArchived).toHaveBeenCalled());
    expect(bridge.preferences.write).not.toHaveBeenCalled();
  });

  it("speaks Spanish when the app does", async () => {
    renderScreen(fakeBridge([item({ id: "a5", content: "contenido" })]), { language: "es" });
    await screen.findByText("contenido");
    expect(button("Fijar")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Mostrar archivados" })).toBeTruthy();
  });
});
