import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportItems } from "../../context/application/use-cases/import-items.use-case.js";
import { ShowProject } from "../../context/application/use-cases/show-project.use-case.js";
import { ImportConversations } from "../../importers/application/use-cases/import-conversations.use-case.js";
import { FileExportReader } from "../../importers/infra/file-export-reader.js";
import { parserRegistry } from "../../importers/infra/parser-registry.js";
import { ONE_PER_TIER, PLANTED } from "../../testing/fake-secrets.js";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../testing/test-vault.js";
import type { Container } from "../container.js";
import { importCommand } from "./import-command.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const tmp = mkdtempSync(join(tmpdir(), "valija-import-cli-"));
const container = {
  importConversations: new ImportConversations(
    new FileExportReader(),
    parserRegistry,
    new ImportItems(vault.sessions, clock, new SeqIds()),
    clock,
  ),
  showProject: new ShowProject(vault.sessions),
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

interface Convo {
  title: string;
  day: number;
  messages: [string, string];
}

/** A generic-format export: each conversation renders as header (1), blank, user (3), blank, assistant (5). */
function writeExport(name: string, convos: readonly Convo[]): string {
  const file = join(tmp, `${name}.json`);
  const conversations = convos.map((c, i) => ({
    id: `conv-${i + 1}`,
    title: c.title,
    createdAt: `2024-05-0${c.day}T09:00:00Z`,
    messages: [
      { role: "user", content: c.messages[0] },
      { role: "assistant", content: c.messages[1] },
    ],
  }));
  writeFileSync(file, JSON.stringify({ valija_import_version: 1, conversations }));
  return file;
}

const FOUR = writeExport("four", [
  { title: "Kickoff notes", day: 1, messages: ["Plan the sprint.", "Sure, here is a plan."] },
  {
    title: "Deploy debugging",
    day: 2,
    messages: ["The deploy fails.", `Your key is ${PLANTED.awsAccessKey} in the config.`],
  },
  { title: "Naming ideas", day: 3, messages: ["Name the app.", "How about Valija?"] },
  {
    title: "Database setup",
    day: 4,
    messages: [PLANTED.credentialAssignment.line, `Random value ${PLANTED.highEntropy} here.`],
  },
]);

const run = (project: string, options: Parameters<typeof importCommand>[2], file = FOUR) =>
  importCommand(container, file, { project, from: "generic", ...options });
const exitsWith = (fn: () => void) => {
  expect(fn).toThrow(Exit);
  return errors;
};
const blockingLines = (lines: readonly string[]) => lines.filter((l) => l.startsWith("  #"));
const projectCode = (project: string) => {
  const r = container.showProject.execute({ project });
  return r.ok ? "OK" : r.error.code;
};

describe("valija import — possible secrets (SECRET-WARN)", () => {
  it("dry-run lists every blocking chunk and exits 0", () => {
    run("dry", { all: true, dryRun: true });
    expect(logs[0]).toBe(
      'Would import 4 item(s) from 4 conversation(s) into "dry" (skipped 0, failed 0).',
    );
    expect(logs).toContain(
      "A real import would be REFUSED: 2 chunk(s) look like they contain secrets.",
    );
    expect(blockingLines(logs)).toEqual([
      '  #2 "Deploy debugging" part 1 — AWS access key (line 5)',
      '  #4 "Database setup" part 1 — credential assignment (line 3), high-entropy string (line 5)',
    ]);
    expect(logs.at(-1)).toBe(
      "Leave those conversations out of the selection (--pick / --query / --since), or add --allow-secrets.",
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("a real run is refused whole: exit 1, nothing written, no project", () => {
    const lines = exitsWith(() => run("refused", { all: true }));
    expect(lines[0]).toBe(
      "error [POSSIBLE_SECRET]: Import refused: 2 chunk(s) look like they contain secrets. Nothing was imported.",
    );
    expect(lines.at(-1)).toBe(
      "Leave those conversations out of the selection, or re-run with --allow-secrets.",
    );
    expect(logs).toEqual([]);
    expect(projectCode("refused")).toBe("PROJECT_NOT_FOUND");
  });

  it("dry-run and the real run list the same blocking chunks", () => {
    run("parity", { all: true, dryRun: true });
    const preview = blockingLines(logs);
    exitsWith(() => run("parity", { all: true }));
    expect(blockingLines(errors)).toEqual(preview);
  });

  it("picking only clean conversations imports normally", () => {
    run("picked", { pick: "1,3" });
    expect(logs).toEqual([
      'Imported 2 item(s) from 2 conversation(s) into "picked" (skipped 0, failed 0).',
    ]);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("--allow-secrets imports every chunk", () => {
    run("allowed", { all: true, allowSecrets: true });
    expect(logs).toEqual([
      'Imported 4 item(s) from 4 conversation(s) into "allowed" (skipped 0, failed 0).',
    ]);
    expect(projectCode("allowed")).toBe("OK");
  });

  it("--dry-run --allow-secrets shows no refusal block", () => {
    run("dry-allowed", { all: true, dryRun: true, allowSecrets: true });
    expect(logs).toEqual([
      'Would import 4 item(s) from 4 conversation(s) into "dry-allowed" (skipped 0, failed 0).',
    ]);
  });

  it("hides a title that itself looks like a secret", () => {
    const file = writeExport("titled", [
      { title: `key ${PLANTED.awsAccessKey}`, day: 1, messages: ["Hello.", "Hi."] },
    ]);
    run("titled", { all: true, dryRun: true }, file);
    expect(blockingLines(logs)).toEqual(["  #1 (title hidden) part 1 — AWS access key (line 1)"]);
    expect(logs.join("\n")).not.toContain(PLANTED.awsAccessKey);
  });

  it("never prints a planted secret", () => {
    run("sweep", { all: true, dryRun: true });
    exitsWith(() => run("sweep", { all: true }));
    const output = [...logs, ...errors].join("\n");
    for (const secret of ONE_PER_TIER) expect(output).not.toContain(secret);
  });
});
