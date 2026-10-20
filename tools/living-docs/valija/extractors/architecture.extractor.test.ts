import { describe, expect, it } from "vitest";
import { sourceFile } from "../testing/source-fixture.js";
import { wiring } from "./architecture.extractor.js";

const container = sourceFile(
  "src/delivery/container.ts",
  [
    "export function buildContainer() {",
    "  const store = new FileStore(paths);",
    "  const items = new ImportItems(sessions, clock);",
    "  return {",
    "    save: new SaveThing(store, clock),",
    "    importer: new ImportAll(new FileReader(), items),",
    "  };",
    "}",
    "",
  ].join("\n"),
);
const useCase = (name: string, params: string) =>
  sourceFile(
    `src/demo/application/use-cases/${name.toLowerCase()}.use-case.ts`,
    `export class ${name} implements UseCase<A, B> {\n  constructor(${params}) {}\n}\n`,
  );

describe("wiring", () => {
  it("labels each use-case edge with its port, including unexposed use cases and inline adapters", () => {
    const graph = wiring([
      container,
      useCase("SaveThing", "private readonly store: ThingStore, private readonly clock: Clock"),
      useCase(
        "ImportItems",
        "private readonly sessions: VaultSessions, private readonly clock: Clock",
      ),
      useCase(
        "ImportAll",
        "private readonly reader: ExportReader, private readonly items: UseCase<X, Y>",
      ),
    ]);
    expect(graph.edges.map((e) => `${e.from} -${e.label}-> ${e.to}`).sort()).toEqual([
      "ImportAll -ExportReader-> FileReader",
      "ImportAll -UseCase-> ImportItems",
      "ImportItems -Clock-> clock",
      "ImportItems -VaultSessions-> sessions",
      "SaveThing -Clock-> clock",
      "SaveThing -ThingStore-> FileStore",
    ]);
  });
});
