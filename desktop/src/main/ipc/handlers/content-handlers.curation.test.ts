import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { EditItem } from "../../../../../src/context/application/use-cases/edit-item.use-case.js";
import { GetContextPack } from "../../../../../src/context/application/use-cases/get-context-pack.use-case.js";
import { SaveContext } from "../../../../../src/context/application/use-cases/save-context.use-case.js";
import { SetItemArchived } from "../../../../../src/context/application/use-cases/set-item-archived.use-case.js";
import { SetItemPinned } from "../../../../../src/context/application/use-cases/set-item-pinned.use-case.js";
import { ShowProject } from "../../../../../src/context/application/use-cases/show-project.use-case.js";
import type { Container } from "../../../../../src/delivery/container.js";
import { makeUnlockedVault, SeqIds } from "../../../../../src/testing/test-vault.js";
import type { ClipboardPort } from "../../application/ports/clipboard.js";
import type { FilePicker } from "../../application/ports/file-picker.js";
import { SCHEMAS } from "../schemas.js";
import { createContentHandlers } from "./content-handlers.js";

/**
 * The two curation channels write through the same use cases as the CLI
 * (`SetItemPinned`/`SetItemArchived`), against a real vault — and send back
 * only `{ changed }`, never content, a project or a DomainError message.
 */
const vault = makeUnlockedVault();
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));
const container = {
  paths: vault.paths,
  saveContext: new SaveContext(vault.sessions, vault.clock, new SeqIds()),
  showProject: new ShowProject(vault.sessions),
  getContextPack: new GetContextPack(vault.sessions, vault.clock),
  setItemPinned: new SetItemPinned(vault.sessions, vault.clock),
  setItemArchived: new SetItemArchived(vault.sessions, vault.clock),
  editItem: new EditItem(vault.sessions, vault.clock),
  // biome-ignore lint/suspicious/noExplicitAny: only the fields above are exercised
} as any as Container;
const filePicker: FilePicker = {
  chooseImportFile: () => null,
  chooseExportTarget: () => null,
  chooseVaultFolder: () => null,
  chooseProjectFolder: () => null,
  resolveProjectFolder: () => undefined,
  resolveHandle: () => undefined,
};
const clipboard: ClipboardPort = { writeText: () => {} };
const handlers = createContentHandlers(() => container, filePicker, clipboard);

const saved = (content: string) => {
  const r = container.saveContext.execute({ project: "cards", content, type: "decision" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const shown = (includeArchived = false) => {
  const r = handlers["content:show"]({
    project: "cards",
    ...(includeArchived ? { includeArchived } : {}),
  });
  return r.ok ? r.value : [];
};

describe("content:setPinned / content:setArchived", () => {
  it("pins an item, then reports a repeat as unchanged", () => {
    const id = saved("pin from the app");
    expect(handlers["content:setPinned"]({ id, pinned: true })).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(shown().find((i) => i.id === id)?.pinned).toBe(true);
    expect(handlers["content:setPinned"]({ id, pinned: true })).toEqual({
      ok: true,
      value: { changed: false },
    });
  });

  it("archives out of show and pack; includeArchived brings it back marked", () => {
    const id = saved("an iguana decision");
    expect(handlers["content:setArchived"]({ id, archived: true })).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(shown().some((i) => i.id === id)).toBe(false);
    expect(shown(true).find((i) => i.id === id)?.archived).toBe(true);
    const pack = handlers["content:pack"]({ project: "cards" });
    expect(pack.ok && pack.value.markdown).not.toContain("iguana");
  });

  it("returns only the error code for an unknown id", () => {
    const r = handlers["content:setPinned"]({ id: "01NOSUCHITEM", pinned: true });
    expect(r).toEqual({ ok: false, error: { code: "ITEM_NOT_FOUND" } });
  });

  it("content:edit edits in place and returns only what changed", () => {
    const id = saved("draft wording");
    const r = handlers["content:edit"]({ id, content: "final wording", tags: ["final"] });
    expect(r).toEqual({ ok: true, value: { changed: true, changedFields: ["content", "tags"] } });
    const after = shown().find((i) => i.id === id);
    expect(after).toMatchObject({ content: "final wording", tags: ["final"] });
  });

  it("content:edit returns only the error code on a refused edit", () => {
    const id = saved("archived before edit");
    handlers["content:setArchived"]({ id, archived: true });
    expect(handlers["content:edit"]({ id, type: "fact" })).toEqual({
      ok: false,
      error: { code: "ITEM_ARCHIVED" },
    });
  });

  it.each([
    ["TOO_MANY_TAGS", { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ["INVALID_TAG", { tags: ["t".repeat(33)] }],
    ["CONTENT_TOO_LARGE", { content: "x".repeat(40_000) }],
  ])("an over-limit edit that passes the real schema comes back as %s", (code, fields) => {
    const id = saved(`over limit ${code}`);
    const request = { id, ...fields };
    expect(SCHEMAS["content:edit"].safeParse(request).success).toBe(true);
    expect(handlers["content:edit"](request)).toEqual({ ok: false, error: { code } });
  });
});
