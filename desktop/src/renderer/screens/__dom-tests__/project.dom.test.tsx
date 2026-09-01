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

/** Only `content.show` is exercised by this screen; every other bridge call is a stub. */
function fakeBridge(items: ContextItemMessage[]): ValijaBridge {
  const show = vi.fn(
    (): Promise<IpcResult<ContextItemMessage[]>> => Promise.resolve({ ok: true, value: items }),
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
      projects: vi.fn(),
      show,
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
      <ProjectScreen bridge={bridge} project="valija" onBack={vi.fn()} onViewPack={vi.fn()} />
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
