import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { GetContextPack } from "./get-context-pack.use-case.js";
import { ImportItems } from "./import-items.use-case.js";
import { ListProjects } from "./list-projects.use-case.js";
import { SaveContext } from "./save-context.use-case.js";
import { SetItemArchived } from "./set-item-archived.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const save = new SaveContext(vault.sessions, new FixedClock(), new SeqIds());
const show = new ShowProject(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

describe("SaveContext", () => {
  it("auto-creates the project on first save (D9)", () => {
    const r = save.execute({
      project: "Vault-App",
      content: "we chose sqlcipher",
      type: "decision",
    });
    expect(r.ok && r.value).toMatchObject({ project: "vault-app", projectCreated: true });
    const again = save.execute({
      project: "vault-app",
      content: "restore flow is next",
      type: "progress",
    });
    expect(again.ok && again.value.projectCreated).toBe(false);
  });

  it("defaults type to fact", () => {
    const r = save.execute({ project: "vault-app", content: "argon2id, 64 MiB" });
    expect(r.ok && r.value.type).toBe("fact");
  });

  it("persists pinned, tags, and source", () => {
    save.execute({
      project: "vault-app",
      content: "always use conventional commits",
      type: "preference",
      tags: ["Git", "git"],
      pinned: true,
      source: "test-client",
    });
    const shown = show.execute({ project: "vault-app", type: "preference" });
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(shown.value[0]).toMatchObject({ pinned: true, tags: ["git"] });
  });

  it("rejects invalid inputs at the boundary", () => {
    expect(!save.execute({ project: "bad name!", content: "x" }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "  " }).ok).toBe(true);
    expect(!save.execute({ project: "vault-app", content: "x", type: "wrong" }).ok).toBe(true);
  });

  it("returns VAULT_LOCKED when the key is gone", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = save.execute({ project: "vault-app", content: "anything" });
    expect(!r.ok && r.error.code).toBe("VAULT_LOCKED");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
  });
});

describe("SaveContext supersedes", () => {
  const clock = new FixedClock();
  const ids = new SeqIds();
  const saveAt = new SaveContext(vault.sessions, clock, ids);
  const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
  const saved = (project: string, content: string, pinned = false) => {
    const r = saveAt.execute({ project, content, type: "decision", pinned });
    if (!r.ok) throw new Error(r.error.message);
    return r.value.itemId;
  };
  const allItems = (project: string) => {
    const r = show.execute({ project, includeArchived: true });
    return r.ok ? r.value : [];
  };
  const codeOf = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error?.code);

  it("saves the new item and archives the old one in one write", () => {
    const oldId = saved("decisions", "we use mysql");
    const before = generation();
    const r = saveAt.execute({
      project: "decisions",
      content: "we use postgres",
      type: "decision",
      supersedes: oldId,
    });
    expect(r.ok && r.value.supersededItemId).toBe(oldId);
    expect(generation()).toBe(before + 1);
    expect(allItems("decisions").find((v) => v.id === oldId)?.archived).toBe(true);
    const pack = new GetContextPack(vault.sessions, clock).execute({ project: "decisions" });
    const packed = pack.ok ? pack.value.sections.flatMap((s) => s.items.map((i) => i.content)) : [];
    expect(packed).toContain("we use postgres");
    expect(packed).not.toContain("we use mysql");
  });

  it("omits supersededItemId when supersedes is not used", () => {
    const r = saveAt.execute({ project: "decisions", content: "plain save" });
    expect(r.ok && "supersededItemId" in r.value).toBe(false);
  });

  it("fails atomically: every refusal saves nothing and bumps nothing", () => {
    const pinnedId = saved("guarded", "pinned decision", true);
    const archivedId = saved("guarded", "already archived");
    new SetItemArchived(vault.sessions, clock).execute({ item: archivedId, archived: true });
    const otherId = saved("secret-elsewhere", "elsewhere");
    new ImportItems(vault.sessions, clock, ids).execute({
      projectName: "guarded",
      items: [
        {
          source: "chatgpt",
          conversationId: "c1",
          chunkIndex: 0,
          content: "imported chunk",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          tags: [],
        },
      ],
    });
    const importedId = allItems("guarded").find((v) => v.type === "imported")?.id ?? "";

    const cases: Array<[string, string]> = [
      ["01NOSUCHITEM", "ITEM_NOT_FOUND"],
      [otherId, "ITEM_NOT_FOUND"],
      [pinnedId, "ITEM_PINNED"],
      [importedId, "ITEM_NOT_CURATABLE"],
      [archivedId, "ITEM_ARCHIVED"],
    ];
    for (const [target, code] of cases) {
      const before = { generation: generation(), count: allItems("guarded").length };
      const r = saveAt.execute({ project: "guarded", content: "replacement", supersedes: target });
      expect(codeOf(r), target).toBe(code);
      expect(generation(), target).toBe(before.generation);
      expect(allItems("guarded").length, target).toBe(before.count);
      if (!r.ok && target === otherId) expect(r.error.message).not.toContain("secret-elsewhere");
    }
  });

  it("rejects a malformed or prefix id before opening a session", () => {
    vault.keychain.deleteKey(vault.vaultId);
    const r = saveAt.execute({ project: "guarded", content: "x", supersedes: "01SEQ%" });
    expect(codeOf(r)).toBe("INVALID_ITEM_ID");
    vault.keychain.setKey(vault.vaultId, vault.keyHex);
    const prefix = saveAt.execute({ project: "guarded", content: "x", supersedes: "01SEQ0" });
    expect(codeOf(prefix)).toBe("ITEM_NOT_FOUND");
  });

  it("does not create the project when the supersede is refused", () => {
    const r = saveAt.execute({ project: "never-born", content: "x", supersedes: "01NOSUCHITEM" });
    expect(codeOf(r)).toBe("ITEM_NOT_FOUND");
    const projects = new ListProjects(vault.sessions).execute();
    expect(projects.ok && projects.value.some((p) => p.name === "never-born")).toBe(false);
  });
});
