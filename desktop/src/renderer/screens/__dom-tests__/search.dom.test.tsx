// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContextItemMessage, IpcResult } from "../../../shared/ipc/messages.js";
import type { ValijaBridge } from "../../state/bridge.js";
import { I18nProvider } from "../../state/i18n-context.js";
import { SearchScreen } from "../search.js";

function hit(overrides: Partial<ContextItemMessage>): ContextItemMessage {
  return {
    id: overrides.id ?? "hit-1",
    project: overrides.project ?? "valija",
    type: "fact",
    content: "plain content",
    tags: [],
    pinned: false,
    createdAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

/** Only `content.projects` and `content.search` are exercised by this screen; every other bridge call is a stub. */
function fakeBridge(searchImpl: (query: string) => ContextItemMessage[]): {
  bridge: ValijaBridge;
  search: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn(
    (req: { query: string }): Promise<IpcResult<ContextItemMessage[]>> =>
      Promise.resolve({ ok: true, value: searchImpl(req.query) }),
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
      projects: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      show: vi.fn(),
      search,
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
    // biome-ignore lint/suspicious/noExplicitAny: only content.projects/content.search are exercised by this suite
  } as any as ValijaBridge;
  return { bridge, search };
}

function renderScreen(bridge: ValijaBridge, onOpenProject = vi.fn()) {
  return render(
    <I18nProvider
      preferences={{ vaultPath: null, theme: "system", language: "en", tourSeen: false }}
    >
      <SearchScreen bridge={bridge} onOpenProject={onOpenProject} />
    </I18nProvider>,
  );
}

async function runQuery(query: string) {
  fireEvent.change(screen.getByPlaceholderText("Search your vault"), {
    target: { value: query },
  });
  fireEvent.submit(screen.getByPlaceholderText("Search your vault").closest("form") as HTMLElement);
  await screen.findByRole("list");
}

describe("SearchScreen (DOM) — master-detail", () => {
  it("after a search, the first hit's full content is in the detail panel", async () => {
    const { bridge } = fakeBridge(() => [
      hit({ id: "a", content: "first hit content" }),
      hit({ id: "b", content: "second hit content" }),
    ]);
    const { container } = renderScreen(bridge);
    await runQuery("mcp");

    expect(container.querySelector(".hit-detail")?.textContent).toContain("first hit content");
  });

  it("clicking the second hit swaps the detail panel, with no re-query", async () => {
    const { bridge, search } = fakeBridge(() => [
      hit({ id: "a", content: "first hit content" }),
      hit({ id: "b", content: "second hit content" }),
    ]);
    const { container } = renderScreen(bridge);
    await runQuery("mcp");
    expect(search).toHaveBeenCalledTimes(1);

    const rows = screen.getAllByRole("button", { name: /hit content/ });
    fireEvent.click(rows[1] as HTMLElement);

    expect(container.querySelector(".hit-detail")?.textContent).toContain("second hit content");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("re-running the search re-selects the first hit, even when the previous selection is still present", async () => {
    const { bridge } = fakeBridge(() => [
      hit({ id: "a", content: "alpha content" }),
      hit({ id: "b", content: "beta content" }),
    ]);
    const { container } = renderScreen(bridge);
    await runQuery("mcp");

    const rows = screen.getAllByRole("button", { name: /content/ });
    fireEvent.click(rows[1] as HTMLElement);
    expect(container.querySelector(".hit-detail")?.textContent).toContain("beta content");

    await runQuery("mcp");
    expect(container.querySelector(".hit-detail")?.textContent).toContain("alpha content");
  });

  it("Open project calls onOpenProject with the selected hit's project", async () => {
    const onOpenProject = vi.fn();
    const { bridge } = fakeBridge(() => [hit({ id: "a", project: "acme" })]);
    renderScreen(bridge, onOpenProject);
    await runQuery("mcp");

    fireEvent.click(screen.getByRole("button", { name: "Open project" }));
    expect(onOpenProject).toHaveBeenCalledWith("acme");
  });

  it("a hit with a raw <img onerror> tag produces no img/a element and shows as text", async () => {
    const { bridge } = fakeBridge(() => [
      hit({ id: "a", content: "<img src=x onerror=alert(1)>" }),
    ]);
    const { container } = renderScreen(bridge);
    await runQuery("mcp");

    expect(container.querySelectorAll(".hit-detail img")).toHaveLength(0);
    expect(container.querySelectorAll(".hit-detail a")).toHaveLength(0);
    expect(container.querySelector(".hit-detail")?.textContent).toContain(
      "<img src=x onerror=alert(1)>",
    );
  });
});
