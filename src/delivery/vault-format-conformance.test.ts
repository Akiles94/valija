import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { ContextItemView } from "../context/application/dto/context-item-view.js";
import type { VaultSessions } from "../context/application/ports/vault-session.js";
import { GetContextPack } from "../context/application/use-cases/get-context-pack.use-case.js";
import { SearchContext } from "../context/application/use-cases/search-context.use-case.js";
import { DEFAULT_BUDGET_TOKENS, estimateTokens } from "../context/domain/services/context-pack.js";
import { migrate, schemaVersion } from "../shared/infra/migrations.js";
import { openVaultDb } from "../shared/infra/sqlite.js";
import {
  buildGoldenVault,
  copyGoldenVaultTo,
  GOLDEN_VAULT_DIR,
  type GoldenVaultManifest,
  makeGoldenVaultReader,
  readCipherParameters,
  readFileSaltHex,
  readGoldenVaultManifest,
  readGoldenVaultSeed,
} from "../testing/golden-vault.js";
import { renderContextPackMarkdown } from "./context-pack-markdown.js";

const REGENERATE = process.env.VALIJA_WRITE_GOLDEN_VAULT === "1";

interface SearchCase {
  name: string;
  query: string;
  project?: string;
  limit?: number;
}

/** Every case is designed to be resolved by the real code, then committed as the golden
 * answer — nobody hand-predicts FTS5 bm25 ordering here (see plan.md A6). */
const SEARCH_CASES: SearchCase[] = [
  { name: "single-term", query: "sqlcipher" },
  { name: "two-term-and", query: "handoff fixture" },
  { name: "quoted-term-no-match", query: 'caf"e' },
  { name: "imported-only", query: "conversation" },
  { name: "archived-excluded", query: "archived" },
  { name: "project-scoped", query: "scoping", project: "beta" },
  { name: "whitespace-only", query: "   " },
  { name: "limit-truncation", query: "vault", limit: 2 },
];

const expectedPackPath = () => new URL("expected-pack.md", GOLDEN_VAULT_DIR);
const expectedExportPath = () => new URL("expected-export.md", GOLDEN_VAULT_DIR);
const expectedSearchPath = () => new URL("expected-search.json", GOLDEN_VAULT_DIR);
const manifestOutPath = () => new URL("manifest.json", GOLDEN_VAULT_DIR);
const vaultJsonOutPath = () => new URL("vault.json", GOLDEN_VAULT_DIR);
const vaultDbOutPath = () => new URL("vault.db", GOLDEN_VAULT_DIR);

function runSearchCases(sessions: VaultSessions): Record<string, ContextItemView[]> {
  const search = new SearchContext(sessions);
  const out: Record<string, ContextItemView[]> = {};
  for (const c of SEARCH_CASES) {
    const options: { query: string; project?: string; limit?: number } = { query: c.query };
    if (c.project !== undefined) options.project = c.project;
    if (c.limit !== undefined) options.limit = c.limit;
    const result = search.execute(options);
    if (!result.ok) throw new Error(`Search case "${c.name}" failed: ${result.error.message}`);
    out[c.name] = result.value;
  }
  return out;
}

describe("vault format conformance", () => {
  if (REGENERATE) {
    it("regenerates the golden vault fixture (deliberately fails)", async () => {
      const tmp = mkdtempSync(join(tmpdir(), "valija-golden-regen-"));
      const manifest = readGoldenVaultManifest();
      const seed = readGoldenVaultSeed();

      const built = await buildGoldenVault(tmp, manifest, seed);

      const probeDb = openVaultDb(built.paths.db, built.keyHex);
      const cipher = readCipherParameters(probeDb);
      probeDb.close();
      const fileSaltHex = readFileSaltHex(built.paths.db);

      const updatedManifest: GoldenVaultManifest = {
        ...manifest,
        keyHex: built.keyHex,
        fileSaltHex,
        cipher,
      };

      const reader = makeGoldenVaultReader(tmp, updatedManifest);
      const packResult = new GetContextPack(reader.sessions, reader.clock).execute({
        project: "alpha",
        budgetTokens: updatedManifest.packBudgetTokens,
      });
      if (!packResult.ok) throw new Error(`Pack render failed: ${packResult.error.message}`);
      const exportResult = new GetContextPack(reader.sessions, reader.clock).execute({
        project: "alpha",
        budgetTokens: Number.POSITIVE_INFINITY,
      });
      if (!exportResult.ok) throw new Error(`Export render failed: ${exportResult.error.message}`);
      const searchResults = runSearchCases(reader.sessions);
      reader.close();

      writeFileSync(manifestOutPath(), `${JSON.stringify(updatedManifest, null, 2)}\n`);
      writeFileSync(expectedPackPath(), renderContextPackMarkdown(packResult.value));
      writeFileSync(expectedExportPath(), renderContextPackMarkdown(exportResult.value));
      writeFileSync(expectedSearchPath(), `${JSON.stringify(searchResults, null, 2)}\n`);

      const finalHeader = readFileSync(built.paths.header);
      const finalDb = readFileSync(built.paths.db);
      writeFileSync(vaultJsonOutPath(), finalHeader);
      writeFileSync(vaultDbOutPath(), finalDb);

      rmSync(tmp, { recursive: true, force: true });

      throw new Error(
        "Golden vault regenerated — review the diff and re-run without VALIJA_WRITE_GOLDEN_VAULT.",
      );
    });
    return;
  }

  const tmpRoots: string[] = [];
  function tempRoot(prefix: string): string {
    const root = mkdtempSync(join(tmpdir(), `valija-${prefix}-`));
    tmpRoots.push(root);
    return root;
  }
  afterAll(() => {
    for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  });

  const manifest = readGoldenVaultManifest();
  const seed = readGoldenVaultSeed();
  const expectedPack = readFileSync(expectedPackPath(), "utf8");
  const expectedExport = readFileSync(expectedExportPath(), "utf8");
  const expectedSearch = JSON.parse(readFileSync(expectedSearchPath(), "utf8")) as Record<
    string,
    ContextItemView[]
  >;

  it("opens the committed golden vault with the published raw key", () => {
    const paths = copyGoldenVaultTo(tempRoot("open"));
    const db = openVaultDb(paths.db, manifest.keyHex);
    migrate(db, paths.db);
    expect(schemaVersion(db)).toBe(3);
    const projectCount = db.prepare("SELECT count(*) AS n FROM projects").get() as { n: number };
    const itemCount = db.prepare("SELECT count(*) AS n FROM context_items").get() as { n: number };
    expect(projectCount.n).toBe(seed.projects.length);
    expect(itemCount.n).toBe(seed.items.length);
    db.close();
  });

  it("the probed cipher parameters match the published manifest exactly (D-7: asserted, not just recorded)", () => {
    const paths = copyGoldenVaultTo(tempRoot("cipher"));
    const db = openVaultDb(paths.db, manifest.keyHex);
    const probed = readCipherParameters(db);
    db.close();
    // Assert the exact key set too: a build that stops answering a pragma, or starts
    // answering a new one, must fail loudly rather than be silently ignored (hazard H1a).
    expect(Object.keys(probed).sort()).toEqual(Object.keys(manifest.cipher).sort());
    expect(probed).toEqual(manifest.cipher);
  });

  it("the raw-key salt convention holds: the file's first 16 bytes equal the published fileSaltHex", () => {
    const paths = copyGoldenVaultTo(tempRoot("salt"));
    expect(readFileSaltHex(paths.db)).toBe(manifest.fileSaltHex);
    // Where the build exposes it, PRAGMA cipher_salt must agree too (A4).
    if (typeof manifest.cipher.cipher_salt === "string") {
      expect(manifest.cipher.cipher_salt).toBe(manifest.fileSaltHex);
    }
  });

  it("renders expected-pack.md byte-for-byte at the tight budget", () => {
    const root = tempRoot("pack");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const result = new GetContextPack(reader.sessions, reader.clock).execute({
      project: "alpha",
      budgetTokens: manifest.packBudgetTokens,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(renderContextPackMarkdown(result.value)).toBe(expectedPack);
    reader.close();
  });

  it("renders expected-export.md byte-for-byte, unbudgeted", () => {
    const root = tempRoot("export");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const result = new GetContextPack(reader.sessions, reader.clock).execute({
      project: "alpha",
      budgetTokens: Number.POSITIVE_INFINITY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(renderContextPackMarkdown(result.value)).toBe(expectedExport);
    reader.close();
  });

  it("excludes imported and archived items from the pack, but counts imported toward totalCount", () => {
    const root = tempRoot("counts");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const result = new GetContextPack(reader.sessions, reader.clock).execute({
      project: "alpha",
      budgetTokens: Number.POSITIVE_INFINITY,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const allRenderedIds = result.value.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(allRenderedIds).not.toContain("item-a10"); // imported — never in a pack
    expect(allRenderedIds).not.toContain("item-a09"); // archived — never reaches the items array
    // 10 alpha items minus the 1 archived = 9; imported still counts toward this line.
    expect(result.value.totalCount).toBe(9);
    reader.close();
  });

  it("reproduces expected-search.json for every recorded query", () => {
    const root = tempRoot("search");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    const actual = runSearchCases(reader.sessions);
    expect(actual).toEqual(expectedSearch);
    reader.close();
  });

  it("pins the documented constants", () => {
    expect(DEFAULT_BUDGET_TOKENS).toBe(4000);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("rebuilding from the seed reproduces the same pack", async () => {
    const root = tempRoot("rebuild");
    const built = await buildGoldenVault(root, manifest, seed);
    const reader = makeGoldenVaultReader(root, { ...manifest, keyHex: built.keyHex });
    const result = new GetContextPack(reader.sessions, reader.clock).execute({
      project: "alpha",
      budgetTokens: manifest.packBudgetTokens,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(renderContextPackMarkdown(result.value)).toBe(expectedPack);
    reader.close();
  });

  it("reading the fixture never mutates the committed files", () => {
    const hash = (path: URL) => createHash("sha256").update(readFileSync(path)).digest("hex");
    const before = { header: hash(vaultJsonOutPath()), db: hash(vaultDbOutPath()) };

    const root = tempRoot("read-only");
    copyGoldenVaultTo(root);
    const reader = makeGoldenVaultReader(root, manifest);
    new GetContextPack(reader.sessions, reader.clock).execute({ project: "alpha" });
    reader.close();

    const after = { header: hash(vaultJsonOutPath()), db: hash(vaultDbOutPath()) };
    expect(after).toEqual(before);
  });
});
