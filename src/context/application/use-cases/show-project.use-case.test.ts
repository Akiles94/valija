import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixedClock, makeUnlockedVault, SeqIds } from "../../../testing/test-vault.js";
import { SaveContext } from "./save-context.use-case.js";
import { ShowProject } from "./show-project.use-case.js";

const vault = makeUnlockedVault();
const clock = new FixedClock();
const save = new SaveContext(vault.sessions, clock, new SeqIds());
const show = new ShowProject(vault.sessions);
afterAll(() => rmSync(vault.paths.root, { recursive: true, force: true }));

beforeAll(() => {
  save.execute({ project: "showcase", content: "older fact", type: "fact" });
  clock.advanceMinutes(1);
  save.execute({ project: "showcase", content: "a decision", type: "decision" });
  clock.advanceMinutes(1);
  save.execute({ project: "showcase", content: "newer fact", type: "fact" });
});

describe("ShowProject", () => {
  it("returns all items newest first", () => {
    const r = show.execute({ project: "showcase" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((i) => i.content)).toEqual(["newer fact", "a decision", "older fact"]);
  });

  it("filters by type", () => {
    const r = show.execute({ project: "showcase", type: "fact" });
    expect(r.ok && r.value).toHaveLength(2);
  });

  it("errors on unknown project and on invalid type", () => {
    const missing = show.execute({ project: "ghost" });
    expect(!missing.ok && missing.error.code).toBe("PROJECT_NOT_FOUND");
    const badType = show.execute({ project: "showcase", type: "nonsense" });
    expect(!badType.ok && badType.error.code).toBe("INVALID_ITEM_TYPE");
  });
});
