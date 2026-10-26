import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePassphraseVault, type PassphraseVault } from "../../testing/passphrase-vault.js";
import { RecordingKeychain } from "../../testing/recording-keychain.js";
import { snapshotVaultFiles } from "../../testing/schema-skew.js";
import { buildContainer, type Container } from "../container.js";
import { changePassphraseCommand } from "./change-passphrase-command.js";
import { promptHidden, promptLine } from "./prompt.js";

vi.mock("../../vault/infra/keyring.js", async () => ({
  OsKeychain: (await import("../../testing/recording-keychain.js")).RecordingKeychain,
}));
vi.mock("./prompt.js", () => ({ promptHidden: vi.fn(), promptLine: vi.fn() }));

const NEW_PASSPHRASE = "a different test phrase";
const HEX_RUN = /[0-9a-f]{64}/i;
const tmp = mkdtempSync(join(tmpdir(), "valija-change-passphrase-cli-"));
const originalEnv = { ...process.env };
let n = 0;

class Exit extends Error {}
let out: string[];
let errors: string[];
let hiddenAnswers: string[];
let lineAnswers: string[];
let hiddenQuestions: string[];

beforeEach(() => {
  RecordingKeychain.reset();
  process.env.HOME = join(tmp, "home");
  process.env.VALIJA_STATE_HOME = join(tmp, `state-${++n}`);
  out = [];
  errors = [];
  hiddenAnswers = [];
  lineAnswers = [];
  hiddenQuestions = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => void out.push(line));
  vi.spyOn(console, "error").mockImplementation((line: string) => void errors.push(line));
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Exit();
  });
  vi.mocked(promptHidden).mockImplementation(async (question: string) => {
    hiddenQuestions.push(question);
    return hiddenAnswers.shift() ?? "";
  });
  vi.mocked(promptLine).mockImplementation(async () => lineAnswers.shift() ?? "");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(promptHidden).mockReset();
  vi.mocked(promptLine).mockReset();
});
afterAll(() => {
  process.env = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

/** A locked vault (real Argon2id, fast params) and the CLI's real container over it. */
async function setup(cloud = false): Promise<{ vault: PassphraseVault; c: Container }> {
  const parent = join(tmp, cloud ? "Dropbox" : "local");
  mkdirSync(parent, { recursive: true });
  const vault = await makePassphraseVault(join(parent, `vault-${n}`));
  return { vault, c: buildContainer({ vaultRoot: vault.paths.root }) };
}

const stdout = () => out.join("\n");

async function unlocksWith(c: Container, passphrase: string): Promise<boolean> {
  return (await c.unlockVault.execute({ passphrase, upgradeConfirmed: true })).ok;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

describe("valija change-passphrase", () => {
  it("local folder: no confirmation, prints the outcome and the new kit once; the new passphrase unlocks", async () => {
    const { vault, c } = await setup();
    hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, NEW_PASSPHRASE];

    await changePassphraseCommand(c, {});

    expect(promptLine).not.toHaveBeenCalled();
    expect(hiddenQuestions).toEqual([
      "Current passphrase: ",
      "New passphrase: ",
      "Repeat new passphrase: ",
    ]);
    const text = stdout();
    expect(text).toContain("This re-encrypts your whole vault with a new key.");
    expect(text).toMatch(/Passphrase changed\. Vault re-encrypted, generation \d+, still unlocked/);
    expect(text).toContain("VALIJA RECOVERY KIT");
    expect(text).toContain("Key issued:");
    expect(text).toContain("This replaces any earlier recovery kit");
    expect(text).toContain("Your previous kit no longer opens this vault.");
    expect(text).toContain('run "valija unlock" with the NEW passphrase');
    expect(text.split("VALIJA RECOVERY KIT")).toHaveLength(2);
    expect(await unlocksWith(c, NEW_PASSPHRASE)).toBe(true);
    expect(await unlocksWith(c, vault.passphrase)).toBe(false);
  });

  describe("cloud folder (D-M)", () => {
    it("n → Nothing changed, exit 1, before any credential prompt; files unchanged", async () => {
      const { vault, c } = await setup(true);
      const before = snapshotVaultFiles(vault.paths);
      lineAnswers = ["n"];

      await expect(changePassphraseCommand(c, {})).rejects.toThrow(Exit);

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(errors.join("\n")).toContain("Nothing changed.");
      expect(stdout()).toContain("This vault is in a synced folder.");
      expect(promptHidden).not.toHaveBeenCalled();
      expect(snapshotVaultFiles(vault.paths)).toEqual(before);
    });

    it("y → proceeds", async () => {
      const { vault, c } = await setup(true);
      lineAnswers = ["Y"];
      hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, NEW_PASSPHRASE];

      await changePassphraseCommand(c, {});

      expect(promptLine).toHaveBeenCalledWith("Other devices are locked and synced? [y/N] ");
      expect(stdout()).toContain("Passphrase changed.");
    });

    it("--yes → no question, but the credentials are still asked", async () => {
      const { vault, c } = await setup(true);
      hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, NEW_PASSPHRASE];

      await changePassphraseCommand(c, { yes: true });

      expect(promptLine).not.toHaveBeenCalled();
      expect(hiddenQuestions).toHaveLength(3);
      expect(stdout()).toContain("Passphrase changed.");
    });
  });

  it("--recovery-key → no current-passphrase prompt (D-G)", async () => {
    const { vault, c } = await setup();
    hiddenAnswers = [NEW_PASSPHRASE, NEW_PASSPHRASE];

    await changePassphraseCommand(c, { recoveryKey: vault.keyHex });

    expect(hiddenQuestions).toEqual(["New passphrase: ", "Repeat new passphrase: "]);
    expect(await unlocksWith(c, NEW_PASSPHRASE)).toBe(true);
  });

  it("a new-passphrase mismatch exits 1 before any work", async () => {
    const { vault, c } = await setup();
    const before = snapshotVaultFiles(vault.paths);
    const execute = vi.spyOn(c.changePassphrase, "execute");
    hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, "something else entirely"];

    await expect(changePassphraseCommand(c, {})).rejects.toThrow(Exit);

    expect(errors.join("\n")).toContain("passphrases do not match");
    expect(execute).not.toHaveBeenCalled();
    expect(snapshotVaultFiles(vault.paths)).toEqual(before);
  });

  it("a wrong current passphrase → error [WRONG_PASSPHRASE], exit 1", async () => {
    const { c } = await setup();
    hiddenAnswers = ["not the passphrase", NEW_PASSPHRASE, NEW_PASSPHRASE];

    await expect(changePassphraseCommand(c, {})).rejects.toThrow(Exit);

    expect(errors.join("\n")).toContain("error [WRONG_PASSPHRASE]");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("keychain refuses the new key → the LOCKED line, exit 0, the new passphrase still opens (D-H)", async () => {
    const { vault, c } = await setup();
    vi.spyOn(RecordingKeychain.prototype, "setKey").mockImplementation(() => {
      throw new Error("keychain write refused");
    });
    hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, NEW_PASSPHRASE];

    await changePassphraseCommand(c, {});

    expect(process.exit).not.toHaveBeenCalled();
    expect(stdout()).toContain(
      'It is now LOCKED on this device: the OS keychain did not accept the new key. Run "valija unlock" with your NEW passphrase.',
    );
    expect(RecordingKeychain.store.has(vault.vaultId)).toBe(false);
    expect(stdout()).toContain("VALIJA RECOVERY KIT");
  });

  it("writes no kit file: no file under the vault or state roots holds a 64-hex run", async () => {
    const { vault, c } = await setup();
    hiddenAnswers = [vault.passphrase, NEW_PASSPHRASE, NEW_PASSPHRASE];

    await changePassphraseCommand(c, {});

    const roots = [vault.paths.root, process.env.VALIJA_STATE_HOME as string];
    for (const file of roots.flatMap(filesUnder)) {
      expect(HEX_RUN.test(readFileSync(file).toString("latin1")), file).toBe(false);
    }
  });
});
