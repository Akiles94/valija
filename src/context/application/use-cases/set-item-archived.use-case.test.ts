import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { GetContextPack } from "./get-context-pack.use-case.js";
import { ImportItems } from "./import-items.use-case.js";
import { ListProjects } from "./list-projects.use-case.js";
import { SaveContext } from "./save-context.use-case.js";
import { SearchContext } from "./search-context.use-case.js";
import { SetItemArchived } from "./set-item-archived.use-case.js";
import { SetItemPinned } from "./set-item-pinned.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const save = new SaveContext(vault.sessions, clock, ids);
const archive = new SetItemArchived(vault.sessions, clock);
const pin = new SetItemPinned(vault.sessions, clock);
const show = new ShowProject(vault.sessions);
const search = new SearchContext(vault.sessions);
const pack = new GetContextPack(vault.sessions, clock);
const list = new ListProjects(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const saved = (content: string) => {
  const r = save.execute({ project: "shelf", content, type: "decision" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const visible = (word: string) => {
  const shown = show.execute({ project: "shelf" });
  const hits = search.execute({ query: word, project: "shelf" });
  const packed = pack.execute({ project: "shelf" });
  return {
    show: shown.ok && shown.value.some((v) => v.content.includes(word)),
    search: hits.ok && hits.value.length > 0,
    pack:
      packed.ok && packed.value.sections.some((s) => s.items.some((i) => i.content.includes(word))),
  };
};
const count = () => {
  const r = list.execute();
  return r.ok ? r.value.find((p) => p.name === "shelf")?.itemCount : undefined;
};

describe("SetItemArchived", () => {
  it("archives an item out of show, search, pack and counts, with one bump", () => {
    const id = saved("gizzard decision");
    const before = { generation: generation(), count: count() };
    const r = archive.execute({ item: id, archived: true });
    expect(r.ok && r.value.changed).toBe(true);
    expect(generation()).toBe(before.generation + 1);
    expect(visible("gizzard")).toEqual({ show: false, search: false, pack: false });
    expect(count()).toBe((before.count ?? 0) - 1);
  });

  it("unarchives back into every view with the pin exactly as before", () => {
    const id = saved("pinned tamarind");
    pin.execute({ item: id, pinned: true });
    archive.execute({ item: id, archived: true });
    const r = archive.execute({ item: id, archived: false });
    expect(r.ok && r.value.changed).toBe(true);
    expect(visible("tamarind")).toEqual({ show: true, search: true, pack: true });
    const shown = show.execute({ project: "shelf" });
    expect(shown.ok && shown.value.find((v) => v.id === id)?.pinned).toBe(true);
  });

  it("works on imported items", () => {
    new ImportItems(vault.sessions, clock, ids).execute({
      projectName: "shelf-imports",
      items: [
        {
          source: "claude",
          conversationId: "c1",
          chunkIndex: 0,
          content: "imported chunk",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          tags: [],
        },
      ],
    });
    const shown = show.execute({ project: "shelf-imports" });
    const id = shown.ok ? shown.value[0]?.id : undefined;
    if (id === undefined) throw new Error("expected the imported item");
    expect(archive.execute({ item: id, archived: true }).ok).toBe(true);
    expect(archive.execute({ item: id, archived: false }).ok).toBe(true);
  });

  it("makes no write when repeated", () => {
    const id = saved("twice archived");
    archive.execute({ item: id, archived: true });
    const before = generation();
    const again = archive.execute({ item: id, archived: true });
    expect(again.ok && again.value.changed).toBe(false);
    archive.execute({ item: id, archived: false });
    const after = generation();
    const unarchiveAgain = archive.execute({ item: id, archived: false });
    expect(unarchiveAgain.ok && unarchiveAgain.value.changed).toBe(false);
    expect(generation()).toBe(after);
    expect(after).toBe(before + 1);
  });
});
