import { describe, expect, it } from "vitest";
import type {
  ImportItemsInput,
  ImportItemsOutput,
} from "../../../context/application/use-cases/import-items.use-case.js";
import type { UseCase } from "../../../shared/application/use-case.js";
import { ok, type Result } from "../../../shared/domain/result.js";
import { PLANTED } from "../../../testing/fake-secrets.js";
import { FixedClock } from "../../../testing/test-vault.js";
import type { Conversation } from "../../domain/entities/conversation.js";
import { importerErr } from "../../domain/errors.js";
import type { ExportReader } from "../ports/export-reader.js";
import type { ConversationParser } from "../ports/parser.js";
import type { ParserRegistry } from "../ports/parser-registry.js";
import { ImportConversations } from "./import-conversations.use-case.js";

const clock = new FixedClock(new Date("2026-07-17T12:00:00Z"));

const reader: ExportReader = { read: () => ok([{}]) };

const conv = (id: string, title: string, date: string, messages = 2): Conversation => ({
  id,
  title,
  createdAt: new Date(date),
  messages: Array.from({ length: messages }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i}`,
  })),
});

/** A registry whose single chatgpt parser always returns the given conversations. */
const registryOf = (conversations: Conversation[]): ParserRegistry => {
  const parser: ConversationParser = {
    source: "chatgpt",
    detect: () => true,
    parse: () => ok({ conversations, failures: [] }),
  };
  return { autodetect: [parser], forSource: () => parser };
};

/** Records every batch handed to it; reports success for all of them. */
class RecordingImportItems implements UseCase<ImportItemsInput, ImportItemsOutput> {
  readonly calls: ImportItemsInput[] = [];
  execute(input: ImportItemsInput): Result<ImportItemsOutput, never> {
    this.calls.push(input);
    return ok({ projectCreated: true, imported: input.items.length, failed: 0, failures: [] });
  }
}

describe("ImportConversations", () => {
  it("lists conversations and writes nothing when no selection flag is given", () => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(
      reader,
      registryOf([conv("a", "Alpha", "2024-01-01")]),
      writer,
      clock,
    );
    const r = uc.execute({ filePath: "x.json", projectName: "p" });
    expect(r.ok && r.value.mode).toBe("list");
    expect(r.ok && r.value.listing).toHaveLength(1);
    expect(writer.calls).toHaveLength(0);
  });

  it("dry-run reports counts but opens no writer", () => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(
      reader,
      registryOf([conv("a", "Alpha", "2024-01-01")]),
      writer,
      clock,
    );
    const r = uc.execute({ filePath: "x.json", projectName: "p", all: true, dryRun: true });
    expect(r.ok && r.value.mode).toBe("dry-run");
    expect(r.ok && r.value.imported).toBeGreaterThan(0);
    expect(writer.calls).toHaveLength(0);
  });

  it("import delegates the chunks to ImportItems in one call", () => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(
      reader,
      registryOf([conv("a", "Alpha", "2024-01-01")]),
      writer,
      clock,
    );
    const r = uc.execute({ filePath: "x.json", projectName: "myproj", all: true });
    expect(r.ok && r.value.mode).toBe("import");
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0]?.projectName).toBe("myproj");
    expect(writer.calls[0]?.items[0]?.tags).toEqual(["imported", "chatgpt"]);
  });

  it("--pick selects by the listed chronological order", () => {
    const writer = new RecordingImportItems();
    const convos = [
      conv("a", "A", "2024-01-01"),
      conv("b", "B", "2024-02-01"),
      conv("c", "C", "2024-03-01"),
    ];
    const uc = new ImportConversations(reader, registryOf(convos), writer, clock);
    uc.execute({ filePath: "x.json", projectName: "p", pick: "1,3" });
    const ids = new Set(writer.calls[0]?.items.map((item) => item.conversationId));
    expect(ids).toEqual(new Set(["a", "c"]));
  });

  it("surfaces the explicitly named parser's parse error verbatim", () => {
    const failing: ConversationParser = {
      source: "generic",
      detect: () => false,
      parse: () => importerErr("UNSUPPORTED_GENERIC_VERSION", "bad version"),
    };
    const registry: ParserRegistry = { autodetect: [], forSource: () => failing };
    const uc = new ImportConversations(reader, registry, new RecordingImportItems(), clock);
    const r = uc.execute({ filePath: "x.json", projectName: "p", from: "generic", all: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_GENERIC_VERSION");
  });

  it("returns UNSUPPORTED_SOURCE when auto-detect finds no parser", () => {
    const none: ConversationParser = {
      source: "chatgpt",
      detect: () => false,
      parse: () => ok({ conversations: [], failures: [] }),
    };
    const registry: ParserRegistry = { autodetect: [none], forSource: () => none };
    const uc = new ImportConversations(reader, registry, new RecordingImportItems(), clock);
    const r = uc.execute({ filePath: "x.json", projectName: "p", all: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNSUPPORTED_SOURCE");
  });

  it("dry-run rejects an invalid project name before touching the writer (D-14)", () => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(
      reader,
      registryOf([conv("a", "Alpha", "2024-01-01")]),
      writer,
      clock,
    );
    const r = uc.execute({
      filePath: "x.json",
      projectName: "Openai 1",
      all: true,
      dryRun: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_PROJECT_NAME");
    expect(writer.calls).toHaveLength(0);
  });

  it("import still rejects the same invalid project name (D-14, unchanged behaviour)", () => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(
      reader,
      registryOf([conv("a", "Alpha", "2024-01-01")]),
      writer,
      clock,
    );
    const r = uc.execute({ filePath: "x.json", projectName: "Openai 1", all: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_PROJECT_NAME");
    expect(writer.calls).toHaveLength(0);
  });

  it("carries per-conversation parse failures into the summary", () => {
    const parser: ConversationParser = {
      source: "chatgpt",
      detect: () => true,
      parse: () =>
        ok({
          conversations: [conv("a", "A", "2024-01-01")],
          failures: [{ title: "Broken", reason: "bad shape" }],
        }),
    };
    const registry: ParserRegistry = { autodetect: [parser], forSource: () => parser };
    const uc = new ImportConversations(reader, registry, new RecordingImportItems(), clock);
    const r = uc.execute({ filePath: "x.json", projectName: "p", all: true });
    expect(r.ok && r.value.failed).toBe(1);
    expect(r.ok && r.value.failures[0]?.conversation).toBe("Broken");
  });
});

describe("ImportConversations: all-or-nothing secret check (SECRET-WARN D-E)", () => {
  const withSecret = (id: string, title: string, date: string): Conversation => ({
    ...conv(id, title, date),
    messages: [
      { role: "user", content: "deploy fails" },
      { role: "user", content: `export AWS_ACCESS_KEY_ID=${PLANTED.awsAccessKey}` },
    ],
  });
  // Listing order is by date: #1 Alpha, #2 Deploy debugging, #3 Gamma.
  const conversations = () => [
    conv("g", "Gamma", "2024-03-01"),
    withSecret("d", "Deploy debugging", "2024-02-01"),
    conv("a", "Alpha", "2024-01-01"),
  ];
  const run = (input: Record<string, unknown>, list = conversations()) => {
    const writer = new RecordingImportItems();
    const uc = new ImportConversations(reader, registryOf(list), writer, clock);
    const r = uc.execute({ filePath: "x.json", projectName: "p", ...input });
    if (!r.ok) throw new Error(r.error.message);
    return { value: r.value, writer };
  };
  const expectedBlocking = [
    {
      conversationIndex: 2,
      title: "Deploy debugging",
      part: 1,
      findings: [{ kind: "aws-access-key", firstLine: 5, lastLine: 5 }],
    },
  ];

  it("dry-run reports refused and the blocking list, with the counts unchanged", () => {
    const { value, writer } = run({ all: true, dryRun: true });
    expect(value).toMatchObject({ mode: "dry-run", refused: true, imported: 3, conversations: 3 });
    expect(value.blockingChunks).toEqual(expectedBlocking);
    expect(writer.calls).toHaveLength(0);
  });

  it("a real run is refused: nothing imported and ImportItems never called", () => {
    const { value, writer } = run({ all: true });
    expect(value).toMatchObject({ mode: "import", refused: true, imported: 0, conversations: 0 });
    expect(value.blockingChunks).toEqual(expectedBlocking);
    expect(writer.calls).toHaveLength(0);
  });

  it("the dry-run list equals the real-run list for the same input and selection", () => {
    expect(run({ all: true }).value.blockingChunks).toEqual(
      run({ all: true, dryRun: true }).value.blockingChunks,
    );
  });

  it("narrowing the selection past the flagged conversation imports normally", () => {
    const { value, writer } = run({ pick: "1,3" });
    expect(value).toMatchObject({ refused: false, blockingChunks: [], imported: 2 });
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0]?.items).toHaveLength(2);
    expect(writer.calls[0] && "allowSecrets" in writer.calls[0]).toBe(false);
  });

  it("allowSecrets imports every selected chunk and passes the override through", () => {
    const { value, writer } = run({ all: true, allowSecrets: true });
    expect(value).toMatchObject({ refused: false, blockingChunks: [], imported: 3 });
    expect(writer.calls[0]?.allowSecrets).toBe(true);
    expect(writer.calls[0]?.items).toHaveLength(3);
  });

  it("query and since selections keep the full-listing index (F4)", () => {
    const list = [
      conv("a", "Alpha", "2024-01-01"),
      conv("b", "Beta", "2024-02-01"),
      withSecret("c", "Deploy debugging", "2024-03-01"),
    ];
    expect(run({ since: "2024-02-15", dryRun: true }, list).value.blockingChunks[0]).toMatchObject({
      conversationIndex: 3,
    });
    expect(run({ query: "deploy", dryRun: true }, list).value.blockingChunks[0]).toMatchObject({
      conversationIndex: 3,
    });
  });

  it("list mode is never refused", () => {
    const { value } = run({});
    expect(value).toMatchObject({ mode: "list", refused: false, blockingChunks: [] });
  });
});
