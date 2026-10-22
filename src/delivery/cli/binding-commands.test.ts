import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GetContextPack } from "../../context/application/use-cases/get-context-pack.use-case.js";
import { LinkWorkspace } from "../../context/application/use-cases/link-workspace.use-case.js";
import { ListProjectBindings } from "../../context/application/use-cases/list-project-bindings.use-case.js";
import { ResolveProject } from "../../context/application/use-cases/resolve-project.use-case.js";
import { SaveContext } from "../../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../../context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { UnlinkWorkspace } from "../../context/application/use-cases/unlink-workspace.use-case.js";
import { FileWorkspaceProbe } from "../../context/infra/file-workspace-probe.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { displayTarget } from "../project-detection.js";
import { linkCommand, linksCommand, unlinkCommand, whichCommand } from "./binding-commands.js";
import { exportCommand, searchCommand, showCommand } from "./content-commands.js";

/** Every `.git` below is hand-written plain files over a real FileWorkspaceProbe: no `git` binary. */
const vault = makeUnlockedVault();
const clock = new FixedClock();
const ids = new SeqIds();
const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "valija-binding-cli-")));
const probe = new FileWorkspaceProbe(join(tmp, "no-such-home"));
const build = (envProject?: string) =>
  ({
    saveContext: new SaveContext(vault.sessions, clock, ids),
    showProject: new ShowProject(vault.sessions),
    searchContext: new SearchContext(vault.sessions),
    getContextPack: new GetContextPack(vault.sessions, clock),
    resolveProject: new ResolveProject(vault.sessions, probe),
    linkWorkspace: new LinkWorkspace(vault.sessions, probe, clock, ids),
    unlinkWorkspace: new UnlinkWorkspace(vault.sessions, probe),
    listProjectBindings: new ListProjectBindings(vault.sessions),
    ...(envProject === undefined ? {} : { envProject }),
  }) as unknown as Container;
const container = build();
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

const exitsWith = (run: () => void) => {
  expect(run).toThrow(Exit);
  return errors.join("\n");
};
const generation = () => vault.deviceIdentity.lastSeen(vault.vaultId)?.generation ?? -1;
const output = (run: () => void) => {
  logs = [];
  run();
  return [...logs];
};
/** `show`/`export` read `process.cwd()`; vitest's default `forks` pool lets a test chdir (plan A10). */
const inside = <T>(dir: string, run: () => T): T => {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return run();
  } finally {
    process.chdir(previous);
  }
};
const folder = (...segments: string[]) => {
  const dir = join(tmp, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
};
const repo = (name: string, url: string) => {
  const root = folder(name);
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(root, ".git", "config"), `[remote "origin"]\n\turl = ${url}\n`);
  writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  return root;
};
const save = (project: string, content: string) => {
  const r = container.saveContext.execute({ project, content, type: "decision" });
  if (!r.ok) throw new Error(r.error.message);
};

const valijaRepo = repo("valija", "https://oscar:ghp_SECRETTOKEN@github.com/oscar/valija.git");
const acmeRepo = repo("acme", "git@github.com:acme/mono.git");
const billing = folder("acme", "services", "billing");
const plain = folder("plain");
save("valija", "Rollback journal (DELETE), never WAL");
save("valija", "the valija pangolin decision");
save("acme-billing", "billing seed");
save("acme", "acme seed");

describe("binding commands", () => {
  it("links prints the empty-state line before anything is linked", () => {
    linksCommand(container, undefined);
    expect(logs).toEqual([
      "No folders or repositories are linked yet. Link one with: valija link <project>",
    ]);
  });

  it("link → which → links → unlink round trip prints the §2.1 lines", () => {
    whichCommand(container, { dir: valijaRepo });
    expect(logs).toEqual([
      "No project detected here.",
      'Hint: a project named "valija" matches this repository\'s name. Link it with: valija link valija',
    ]);

    const before = generation();
    expect(output(() => linkCommand(container, "valija", { dir: valijaRepo }))).toEqual([
      'Linked repository github.com/oscar/valija → project "valija".',
      '(Any clone of this repository, on any device that syncs this vault, now resolves to "valija".)',
    ]);
    expect(generation()).toBe(before + 1);

    expect(output(() => whichCommand(container, { dir: join(valijaRepo, ".git") }))).toEqual([
      "valija  (linked repository github.com/oscar/valija)",
    ]);

    const listed = container.listProjectBindings.execute({});
    const id = listed.ok ? (listed.value[0]?.id ?? "") : "";
    expect(output(() => linksCommand(container, undefined))).toEqual([
      `${"ID".padEnd(id.length + 2)}PROJECT  KIND        TARGET`,
      `${id}  valija   repository  github.com/oscar/valija`,
    ]);

    expect(output(() => unlinkCommand(container, id, {}))).toEqual([
      'Unlinked repository github.com/oscar/valija from project "valija".',
    ]);
    expect(output(() => whichCommand(container, { dir: valijaRepo }))[0]).toBe(
      "No project detected here.",
    );
  });

  it("never prints a remote's credentials", () => {
    linkCommand(container, "valija", { dir: valijaRepo });
    whichCommand(container, { dir: valijaRepo });
    linksCommand(container, "valija");
    expect(logs.join("\n")).not.toMatch(/ghp_SECRETTOKEN|oscar:|https:/);
  });

  it("re-linking prints the no-op line and leaves the lineage alone", () => {
    const before = generation();
    linkCommand(container, "valija", { dir: valijaRepo });
    expect(logs).toEqual([
      'Already linked: repository github.com/oscar/valija → project "valija". Nothing changed.',
    ]);
    expect(generation()).toBe(before);
  });

  it("a monorepo sub-folder gets its own folder link, which beats the repository", () => {
    linkCommand(container, "acme", { dir: acmeRepo });
    const shown = displayTarget({ kind: "folder", target: billing });
    expect(
      output(() => linkCommand(container, "acme-billing", { dir: billing, by: "folder" })),
    ).toEqual([`Linked folder ${shown} → project "acme-billing".`]);
    expect(
      output(() => whichCommand(container, { dir: join(billing, "src-missing", "..") })),
    ).toEqual([`acme-billing  (linked folder ${shown})`]);
    expect(output(() => whichCommand(container, { dir: acmeRepo }))).toEqual([
      "acme  (linked repository github.com/acme/mono)",
    ]);
    expect(output(() => linksCommand(container, "acme-billing"))[1]).toContain(
      `acme-billing  folder  ${shown}`,
    );
  });

  it("unlink --dir removes the binding the folder resolves through, and --by narrows it", () => {
    const shown = displayTarget({ kind: "folder", target: billing });
    expect(
      output(() => unlinkCommand(container, undefined, { dir: billing, by: "repository" })),
    ).toEqual(['Unlinked repository github.com/acme/mono from project "acme".']);
    expect(output(() => unlinkCommand(container, undefined, { dir: billing }))).toEqual([
      `Unlinked folder ${shown} from project "acme-billing".`,
    ]);
    expect(exitsWith(() => unlinkCommand(container, undefined, { dir: billing }))).toBe(
      "error [BINDING_NOT_FOUND]: Nothing linked here.",
    );
  });

  it("which prints VALIJA_PROJECT when it decides", () => {
    whichCommand(build("valija"), { dir: plain });
    expect(logs).toEqual(["valija  (VALIJA_PROJECT)"]);
  });

  it("each rejection prints its code and exits 1", () => {
    expect(
      exitsWith(() => linkCommand(container, "acme", { dir: plain, by: "repository" })),
    ).toMatch(/^error \[NO_GIT_REMOTE\]/);
    errors = [];
    expect(exitsWith(() => linkCommand(container, "acme", { dir: join(tmp, "nope") }))).toMatch(
      /^error \[INVALID_WORKSPACE_PATH\]/,
    );
    errors = [];
    expect(exitsWith(() => whichCommand(container, { dir: join(tmp, "nope") }))).toMatch(
      /^error \[INVALID_WORKSPACE_PATH\]/,
    );
    errors = [];
    expect(exitsWith(() => linkCommand(container, "ghost", { dir: plain }))).toMatch(
      /^error \[PROJECT_NOT_FOUND\]/,
    );
    errors = [];
    const conflict = exitsWith(() => linkCommand(container, "acme", { dir: valijaRepo }));
    expect(conflict).toMatch(/^error \[BINDING_CONFLICT\]: .*project "valija"/);
    expect(conflict).not.toContain("github.com");
    errors = [];
    expect(exitsWith(() => unlinkCommand(container, "01NOSUCHID", {}))).toMatch(
      /^error \[BINDING_NOT_FOUND\]/,
    );
    errors = [];
    expect(exitsWith(() => linksCommand(container, "ghost"))).toMatch(
      /^error \[PROJECT_NOT_FOUND\]/,
    );
  });

  it("unlink with both an id and --dir/--by is refused before any use case runs", () => {
    const execute = vi.spyOn(container.unlinkWorkspace, "execute");
    expect(exitsWith(() => unlinkCommand(container, "01ANY", { dir: plain }))).toBe(
      "error: give a binding id or --dir/--by, not both.",
    );
    errors = [];
    expect(exitsWith(() => unlinkCommand(container, "01ANY", { by: "folder" }))).toBe(
      "error: give a binding id or --dir/--by, not both.",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("a locked vault fails which, link, unlink and links with VAULT_LOCKED", () => {
    vault.keychain.deleteKey(vault.vaultId);
    try {
      for (const run of [
        () => whichCommand(container, { dir: valijaRepo }),
        () => linkCommand(container, "valija", { dir: valijaRepo }),
        () => unlinkCommand(container, undefined, { dir: valijaRepo }),
        () => linksCommand(container, undefined),
      ]) {
        errors = [];
        expect(exitsWith(run)).toMatch(/^error \[VAULT_LOCKED\]/);
      }
    } finally {
      vault.keychain.setKey(vault.vaultId, vault.keyHex);
    }
  });
});

describe("show and export with the project omitted", () => {
  it("show inside a linked folder prints exactly what the explicit show prints", () => {
    const explicit = output(() => showCommand(container, "valija", {}));
    const detected = inside(join(valijaRepo, ".git"), () =>
      output(() => showCommand(container, undefined, {})),
    );
    expect(detected).toEqual(explicit);
    expect(detected.join("\n")).toContain("Rollback journal (DELETE), never WAL");
  });

  it("export inside a linked folder equals the explicit export byte for byte", () => {
    for (const options of [{}, { json: true }]) {
      const explicit = output(() => exportCommand(container, "valija", options));
      const detected = inside(valijaRepo, () =>
        output(() => exportCommand(container, undefined, options)),
      );
      expect(detected).toEqual(explicit);
    }
  });

  it("export -o names the resolved project", () => {
    const file = join(tmp, "pack.md");
    inside(valijaRepo, () => exportCommand(container, undefined, { output: file }));
    expect(errors).toEqual([`Exported valija (md) to ${file}`]);
    expect(readFileSync(file, "utf8")).toContain("# Context pack: valija");
  });

  it("an unlinked folder → PROJECT_NOT_DETECTED with the CLI remedy", () => {
    const message = inside(plain, () => exitsWith(() => showCommand(container, undefined, {})));
    expect(message).toBe(
      "error [PROJECT_NOT_DETECTED]: No project was given and none is linked to this workspace. Pass a project name, or link this folder: valija link <project>.",
    );
    errors = [];
    expect(inside(plain, () => exitsWith(() => exportCommand(container, undefined, {})))).toMatch(
      /^error \[PROJECT_NOT_DETECTED\]/,
    );
  });

  it("an explicit project still wins inside a linked folder", () => {
    const explicit = output(() => showCommand(container, "acme-billing", {}));
    const inLinked = inside(valijaRepo, () =>
      output(() => showCommand(container, "acme-billing", {})),
    );
    expect(inLinked).toEqual(explicit);
    expect(inLinked.join("\n")).toContain("billing seed");
  });

  it("search with no -p stays vault-wide inside a linked folder (D-F)", () => {
    const hits = inside(valijaRepo, () => output(() => searchCommand(container, "seed", {})));
    expect(hits.map((line) => line.split("  ")[0]).sort()).toEqual(["acme", "acme-billing"]);
  });
});
