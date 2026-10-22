import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditItem } from "../../context/application/use-cases/edit-item.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { SetItemArchived } from "../../context/application/use-cases/set-item-archived.use-case.js";
import { SetItemPinned } from "../../context/application/use-cases/set-item-pinned.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { ONE_PER_TIER, PLANTED } from "../../testing/fake-secrets.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { searchCommand, showCommand } from "./content-commands.js";
import {
  archiveCommand,
  editCommand,
  pinCommand,
  unarchiveCommand,
  unpinCommand,
} from "./curation-commands.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const tmp = mkdtempSync(join(tmpdir(), "valija-curation-cli-"));
const container = {
  saveContext: new SaveContext(vault.sessions, clock, new SeqIds()),
  showProject: new ShowProject(vault.sessions),
  searchContext: new SearchContext(vault.sessions),
  setItemPinned: new SetItemPinned(vault.sessions, clock),
  setItemArchived: new SetItemArchived(vault.sessions, clock),
  editItem: new EditItem(vault.sessions, clock),
} as unknown as Container;
afterAll(() => {
  rmSync(vault.paths.root, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
});

class Exit extends Error {}
let logs: string[];
let errors: string[];
beforeEach(() => {
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void logs.push(line));
  vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Exit();
  });
});
afterEach(() => vi.restoreAllMocks());

const SECRET_WORD = "pangolin";
const saved = (content = `the ${SECRET_WORD} decision`) => {
  const r = container.saveContext.execute({ project: "cli", content, type: "decision" });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.itemId;
};
const view = (id: string) => {
  const r = container.showProject.execute({ project: "cli", includeArchived: true });
  return r.ok ? r.value.find((v) => v.id === id) : undefined;
};
const exitsWith = (run: () => void) => {
  expect(run).toThrow(Exit);
  return errors.join("\n");
};

describe("curation commands", () => {
  it("pin and unpin print one line each and change state", () => {
    const id = saved();
    pinCommand(container, id);
    expect(logs).toEqual([`Pinned decision ${id} in project "cli".`]);
    expect(view(id)?.pinned).toBe(true);
    unpinCommand(container, id);
    expect(view(id)?.pinned).toBe(false);
  });

  it("prints the no-op line on a repeat", () => {
    const id = saved();
    pinCommand(container, id);
    pinCommand(container, id);
    expect(logs[1]).toBe("Already pinned — nothing changed.");
  });

  it("archive offers an undo; unarchive brings the item back", () => {
    const id = saved();
    archiveCommand(container, id);
    expect(logs[0]).toBe(`Archived decision ${id} in project "cli". Undo: valija unarchive ${id}`);
    expect(view(id)?.archived).toBe(true);
    unarchiveCommand(container, id);
    expect(view(id)?.archived).toBeUndefined();
  });

  it("show prints ids and lists archived items only with --archived", () => {
    const id = saved("an archived okapi note");
    archiveCommand(container, id);
    logs = [];
    showCommand(container, "cli", {});
    expect(logs.join("\n")).not.toContain(id);
    logs = [];
    showCommand(container, "cli", { archived: true });
    expect(logs.join("\n")).toContain(`id ${id}  [archived]`);
  });

  it("exits 1 on an ambiguous prefix or an unknown id", () => {
    saved();
    saved();
    expect(exitsWith(() => pinCommand(container, "01SEQ0"))).toContain("error [ITEM_ID_AMBIGUOUS]");
    errors = [];
    expect(exitsWith(() => pinCommand(container, "01NOSUCH"))).toContain("[ITEM_NOT_FOUND]");
  });

  it("edit reads content from a file, and search then finds the new word", () => {
    const id = saved("an old armadillo note");
    const file = join(tmp, "new.md");
    writeFileSync(file, "a fresh narwhal note");
    editCommand(container, id, { contentFile: file });
    expect(logs).toEqual([`Updated decision ${id} in project "cli" (content).`]);
    logs = [];
    searchCommand(container, "narwhal", { project: "cli" });
    expect(logs.join("\n")).toContain("narwhal");
  });

  it("edit with no flags fails with NOTHING_TO_EDIT", () => {
    const id = saved();
    expect(exitsWith(() => editCommand(container, id, {}))).toContain("[NOTHING_TO_EDIT]");
  });

  it('edit --tags "" clears the tags', () => {
    const id = saved();
    editCommand(container, id, { tags: "a, b" });
    editCommand(container, id, { tags: "" });
    expect(view(id)?.tags).toEqual([]);
  });

  it("edit reports an unreadable file without echoing content", () => {
    const id = saved();
    const message = exitsWith(() => editCommand(container, id, { contentFile: join(tmp, "nope") }));
    expect(message).toContain("error: could not read");
  });

  it("never prints item content", () => {
    const id = saved();
    pinCommand(container, id);
    archiveCommand(container, id);
    unarchiveCommand(container, id);
    editCommand(container, id, { type: "fact" });
    expect([...logs, ...errors].join("\n")).not.toContain(SECRET_WORD);
  });
});

describe("edit — possible secrets (SECRET-WARN)", () => {
  const secretFile = (name: string, content: string) => {
    const file = join(tmp, name);
    writeFileSync(file, content);
    return file;
  };
  const AWS_FILE = () => secretFile("aws.md", `deploy notes\nkey ${PLANTED.awsAccessKey}\n`);

  it("refuses with the kind, the line and the --allow-secrets remedy; the item is unchanged", () => {
    const id = saved("an untouched quokka note");
    const message = exitsWith(() => editCommand(container, id, { contentFile: AWS_FILE() }));
    expect(message).toBe(
      "error [POSSIBLE_SECRET]: The content looks like it contains a secret — AWS access key (line 2). Nothing was saved. Remove it, or re-run with --allow-secrets to save it anyway.",
    );
    expect(view(id)?.content).toBe("an untouched quokka note");
  });

  it("--allow-secrets saves it anyway", () => {
    const id = saved();
    editCommand(container, id, { contentFile: AWS_FILE(), allowSecrets: true });
    expect(logs).toEqual([`Updated decision ${id} in project "cli" (content).`]);
  });

  it("a tags-only edit on an item that already holds a secret succeeds", () => {
    const id = saved();
    editCommand(container, id, { contentFile: AWS_FILE(), allowSecrets: true });
    logs = [];
    editCommand(container, id, { tags: "ops" });
    expect(logs).toEqual([`Updated decision ${id} in project "cli" (tags).`]);
  });

  it("never prints a planted secret, one file per tier", () => {
    const files = [
      `key ${PLANTED.awsAccessKey}`,
      PLANTED.credentialAssignment.line,
      `value ${PLANTED.highEntropy}`,
    ].map((content, i) => secretFile(`tier-${i + 1}.md`, content));
    const id = saved();
    for (const contentFile of files) exitsWith(() => editCommand(container, id, { contentFile }));
    const output = [...logs, ...errors].join("\n");
    expect(errors).toHaveLength(3);
    for (const secret of ONE_PER_TIER) expect(output).not.toContain(secret);
  });
});
