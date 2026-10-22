#!/usr/bin/env node
// `npm run smoke:sdk` (P-17): proves `valija/sdk` works from the packed tarball, in a clean consumer
// project, offline. Each step exits non-zero on failure. Dependencies are symlinked from this repo's
// node_modules (A11): a registry install is left to release QA.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "valija-sdk-smoke-"));
const consumer = join(work, "consumer");
const installed = join(consumer, "node_modules", "valija");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let current = "";
function step(title, action) {
  current = title;
  process.stdout.write(`• ${title} … `);
  action();
  process.stdout.write("ok\n");
}

/** Run node in the consumer project with a throwaway home, vault and state — never the user's. */
function runNode(args, timeout = 30_000) {
  const env = {
    ...process.env,
    HOME: join(work, "home"),
    USERPROFILE: join(work, "home"),
    VALIJA_HOME: join(work, "vault"),
    VALIJA_STATE_HOME: join(work, "state"),
  };
  return spawnSync(process.execPath, args, { cwd: consumer, env, encoding: "utf8", timeout });
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  step("1. build", () => {
    execFileSync(npm, ["run", "build"], { cwd: REPO, stdio: "pipe" });
  });

  let tarball = "";
  step("2. pack", () => {
    const out = execFileSync(npm, ["pack", "--json", "--pack-destination", work], {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    tarball = join(work, JSON.parse(out)[0].filename);
  });

  step("3. extract into a clean consumer project", () => {
    mkdirSync(installed, { recursive: true });
    execFileSync("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ name: "smoke-consumer", private: true, type: "module" }),
    );
  });

  step("4. symlink the dependencies (offline)", () => {
    for (const dep of Object.keys(pkg.dependencies)) {
      const link = join(consumer, "node_modules", dep);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(join(REPO, "node_modules", dep), link, "junction");
    }
  });

  step("5. types resolve under moduleResolution nodenext (skipLibCheck off)", () => {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          target: "es2022",
          strict: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    writeFileSync(
      join(consumer, "consumer.ts"),
      [
        'import { createVault, openVault } from "valija/sdk";',
        'import type { Result, ValijaError, ValijaErrorCode, ValijaVault, SearchHit } from "valija/sdk";',
        "const open: (o: { client: string }) => Promise<Result<ValijaVault, ValijaError>> = openVault;",
        'const code: ValijaErrorCode = "VAULT_SCHEMA_TOO_NEW";',
        'const hit: SearchHit = { id: "x", project: "p", type: "imported", createdAt: "", content: "" };',
        "// @ts-expect-error — the handle has no pinning (D-K)",
        "type NoPin = ValijaVault['pin'];",
        "export { open, code, hit, createVault };",
        "export type { NoPin };",
        "",
      ].join("\n"),
    );
    const tsc = join(
      REPO,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "tsc.cmd" : "tsc",
    );
    const result = spawnSync(tsc, ["-p", consumer], { encoding: "utf8" });
    check(result.status === 0, `tsc failed:\n${result.stdout}${result.stderr}`);
  });

  step("6. importing is inert: no output, exits within 2 s", () => {
    const result = runNode(["--input-type=module", "-e", 'await import("valija/sdk");'], 2_000);
    check(result.error === undefined, `did not exit within 2 s (${result.error?.message})`);
    check(result.status === 0, `exit ${result.status}: ${result.stderr}`);
    check(
      result.stdout === "" && result.stderr === "",
      `printed: ${result.stdout}${result.stderr}`,
    );
  });

  step("7. createVault → save → getContextPack from the packed build", () => {
    const script = `
      import { createVault } from "valija/sdk";
      const created = await createVault({ client: "smoke-test", passphrase: "a long smoke-test passphrase" });
      if (!created.ok) throw new Error(created.error.code);
      const { vault } = created.value;
      const saved = await vault.save({ project: "smoke", type: "decision", content: "Packed build works." });
      if (!saved.ok) throw new Error(saved.error.code);
      const pack = await vault.getContextPack({ project: "smoke" });
      if (!pack.ok || !pack.value.markdown.includes("Packed build works.")) throw new Error("pack");
      await vault.close();
      process.stdout.write(vault.mode);
    `;
    const result = runNode(["--input-type=module", "-e", script]);
    check(result.status === 0, `exit ${result.status}: ${result.stderr}`);
    check(result.stdout === "in-process", `unexpected output: ${result.stdout}`);
  });

  step(`8. the bin still works: program.js --version prints ${pkg.version}`, () => {
    const result = runNode([join(installed, "dist", "program.js"), "--version"]);
    check(result.status === 0, `exit ${result.status}: ${result.stderr}`);
    check(result.stdout.trim() === pkg.version, `printed: ${result.stdout}`);
  });

  step("9. sdk.js and the chunks it loads import no commander or MCP", () => {
    const seen = new Set();
    const bare = new Set();
    const queue = [join(installed, "dist", "sdk.js")];
    while (queue.length > 0) {
      const file = queue.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const [, spec] of source.matchAll(
        /(?:^|\n)\s*(?:import|export)\b[^"']*?["']([^"']+)["']/g,
      )) {
        if (spec.startsWith(".")) queue.push(resolve(dirname(file), spec));
        else bare.add(spec);
      }
    }
    const offending = [...bare].filter(
      (s) => s === "commander" || s.startsWith("@modelcontextprotocol/"),
    );
    check(offending.length === 0, `sdk.js loads ${offending.join(", ")}`);
    check(seen.size > 1, "sdk.js imports no chunk — the walk is broken");
  });

  process.stdout.write("smoke:sdk passed\n");
} catch (error) {
  process.stdout.write("FAILED\n");
  process.stderr.write(`smoke:sdk failed at "${current}": ${error.message}\n`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
