import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { fragmentsOf, PLANTED } from "../../../testing/fake-secrets.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { EditItem } from "./edit-item.use-case.js";
import { ImportItems } from "./import-items.use-case.js";
import { SaveContext } from "./save-context.use-case.js";
import { SearchContext } from "./search-context.use-case.js";
import { SetItemArchived } from "./set-item-archived.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const save = new SaveContext(vault.sessions, clock, ids);
const edit = new EditItem(vault.sessions, clock);
const archive = new SetItemArchived(vault.sessions, clock);
const show = new ShowProject(vault.sessions);
const search = new SearchContext(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const saved = (content: string) => {
  const r = save.execute({
    project: "edits",
    content,
    type: "progress",
    tags: ["wip"],
    pinned: true,
    source: "claude-code",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const view = (id: string) => {
  const r = show.execute({ project: "edits", includeArchived: true });
  return r.ok ? r.value.find((v) => v.id === id) : undefined;
};
const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);

describe("EditItem", () => {
  it.each([
    ["content", { content: "rewritten" }],
    ["tags", { tags: ["done"] }],
    ["type", { type: "fact" }],
  ])("edits %s alone and reports exactly that field", (field, change) => {
    const id = saved(`edit ${field}`);
    const r = edit.execute({ item: id, ...change });
    expect(r.ok && r.value.changedFields).toEqual([field]);
    expect(r.ok && r.value.changed).toBe(true);
  });

  it("edits all three at once, in place", () => {
    const id = saved("all three");
    const createdAt = view(id)?.createdAt;
    clock.advanceMinutes(10);
    const r = edit.execute({ item: id, content: "all new", tags: ["a", "b"], type: "decision" });
    expect(r.ok && r.value).toMatchObject({
      itemId: id,
      type: "decision",
      changedFields: ["content", "tags", "type"],
    });
    expect(view(id)).toMatchObject({
      content: "all new",
      tags: ["a", "b"],
      type: "decision",
      pinned: true,
      source: "claude-code",
      createdAt,
    });
  });

  it("re-indexes search: the new word is found, the old one is not", () => {
    const id = saved("quokka plan");
    edit.execute({ item: id, content: "wombat plan" });
    const old = search.execute({ query: "quokka", project: "edits" });
    const fresh = search.execute({ query: "wombat", project: "edits" });
    expect(old.ok && old.value).toHaveLength(0);
    expect(fresh.ok && fresh.value.map((h) => h.id)).toEqual([id]);
  });

  it("refuses an empty edit before opening a session", () => {
    vault.keychain.deleteKey(vault.vaultId);
    expect(codeOf(edit.execute({ item: "01SEQ000001" }))).toBe("NOTHING_TO_EDIT");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });

  it("validates every field at the boundary", () => {
    const id = saved("validated");
    expect(codeOf(edit.execute({ item: id, type: "imported" }))).toBe("INVALID_ITEM_TYPE");
    expect(codeOf(edit.execute({ item: id, content: "   " }))).toBe("CONTENT_EMPTY");
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`);
    expect(codeOf(edit.execute({ item: id, tags: eleven }))).toBe("TOO_MANY_TAGS");
  });

  it("clears tags with an empty list", () => {
    const id = saved("clear my tags");
    edit.execute({ item: id, tags: [] });
    expect(view(id)?.tags).toEqual([]);
  });

  it("reports identical values as unchanged, with no bump", () => {
    const id = saved("same as before");
    const before = generation();
    const r = edit.execute({ item: id, content: "same as before", tags: ["wip"] });
    expect(r.ok && r.value).toMatchObject({ changed: false, changedFields: [] });
    expect(generation()).toBe(before);
  });

  it("refuses archived and imported items with no bump", () => {
    const id = saved("archived target");
    archive.execute({ item: id, archived: true });
    new ImportItems(vault.sessions, clock, ids).execute({
      projectName: "edits",
      items: [
        {
          source: "chatgpt",
          conversationId: "c9",
          chunkIndex: 0,
          content: "an imported chunk",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          tags: [],
        },
      ],
    });
    const imported = show.execute({ project: "edits", type: "imported" });
    const importedId = imported.ok ? imported.value[0]?.id : undefined;
    if (importedId === undefined) throw new Error("expected the imported item");
    const before = generation();
    expect(codeOf(edit.execute({ item: id, type: "fact" }))).toBe("ITEM_ARCHIVED");
    expect(codeOf(edit.execute({ item: importedId, type: "fact" }))).toBe("ITEM_NOT_CURATABLE");
    expect(generation()).toBe(before);
  });
});

describe("EditItem refuses possible secrets unless a human overrides (SECRET-WARN)", () => {
  const flagged = `Deploy notes\nexport AWS_ACCESS_KEY_ID=${PLANTED.awsAccessKey}`;

  it("refuses new content with a secret, before the session: item and lineage unchanged", () => {
    const id = saved("clean deploy notes");
    const before = generation();
    const r = edit.execute({ item: id, content: flagged });
    expect(codeOf(r)).toBe("POSSIBLE_SECRET");
    expect(!r.ok && r.error.message).toContain("AWS access key (line 2)");
    for (const fragment of fragmentsOf(PLANTED.awsAccessKey)) {
      expect(!r.ok && r.error.message).not.toContain(fragment);
    }
    expect(view(id)?.content).toBe("clean deploy notes");
    expect(generation()).toBe(before);
  });

  it("saves the same content with allowSecrets", () => {
    const id = saved("to be overridden");
    const r = edit.execute({ item: id, content: flagged, allowSecrets: true });
    expect(r.ok && r.value.changedFields).toEqual(["content"]);
    expect(view(id)?.content).toBe(flagged);
  });

  it("never scans a tags-only or type-only edit, even on an item that holds a secret (D-I)", () => {
    const id = saved("will hold a secret");
    expect(edit.execute({ item: id, content: flagged, allowSecrets: true }).ok).toBe(true);
    expect(codeOf(edit.execute({ item: id, tags: ["deploy"] }))).toBe("ok");
    expect(codeOf(edit.execute({ item: id, type: "fact" }))).toBe("ok");
  });

  it("re-checks unchanged content re-submitted without the flag (D-I)", () => {
    const id = saved("resubmitted");
    expect(edit.execute({ item: id, content: flagged, allowSecrets: true }).ok).toBe(true);
    expect(codeOf(edit.execute({ item: id, content: flagged }))).toBe("POSSIBLE_SECRET");
  });

  it("reports a private-key block as a line range", () => {
    const id = saved("key notes");
    const r = edit.execute({ item: id, content: `Key below.\n${PLANTED.privateKey}` });
    expect(!r.ok && r.error.message).toContain("private key (lines 2–6)");
  });
});
