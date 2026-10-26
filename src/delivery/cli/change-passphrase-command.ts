import type { ChangePassphraseOutput } from "../../vault/application/use-cases/change-passphrase.use-case.js";
import { renderRecoveryKit } from "../../vault/infra/recovery-kit.js";
import type { Container } from "../container.js";
import { promptHidden, promptLine } from "./prompt.js";
import { fail } from "./render.js";

/** `valija change-passphrase` options: authenticate with the kit, and pre-confirm the sync ritual. */
export interface ChangePassphraseOptions {
  /** The raw key from the recovery kit, used instead of the current passphrase (D-G). */
  recoveryKey?: string;
  /** Confirms other devices are locked and synced (cloud folders only) — never skips a credential (D-M). */
  yes?: boolean;
}

/**
 * `valija change-passphrase`: explains what changes, asks for the cloud confirmation, the current
 * credential and the new passphrase twice, re-encrypts, then prints the new recovery kit once.
 */
export async function changePassphraseCommand(
  c: Container,
  options: ChangePassphraseOptions,
): Promise<void> {
  printPreamble();
  const confirmed = await confirmOtherDevices(c, options.yes === true);
  const current =
    options.recoveryKey !== undefined
      ? { recoveryKeyHex: options.recoveryKey }
      : { passphrase: await promptHidden("Current passphrase: ") };
  const newPassphrase = await promptNewPassphrase();
  console.log("Re-encrypting vault (Argon2id ~1s, then the whole file is rewritten)...");
  const result = await c.changePassphrase.execute({
    current,
    newPassphrase,
    otherDevicesConfirmed: confirmed,
  });
  if (!result.ok) fail(result.error);
  printOutcome(result.value);
}

function printPreamble(): void {
  console.log("This re-encrypts your whole vault with a new key.");
  console.log(
    "  - Your current passphrase AND your current recovery kit will stop opening this vault.",
  );
  console.log(
    "  - Copies made before now (sync history, backups, conflicted copies) stay readable with the OLD ones.",
  );
}

/** D-M: a cloud folder needs `y` (or `--yes`) before any credential is asked; a local one needs nothing. */
async function confirmOtherDevices(c: Container, yes: boolean): Promise<boolean> {
  if (!c.folder.inspect().looksLikeCloud) return true;
  console.log(
    "This vault is in a synced folder. Lock valija on every other device and let sync finish first.",
  );
  if (yes) return true;
  const answer = (await promptLine("Other devices are locked and synced? [y/N] ")).trim();
  if (/^y(es)?$/i.test(answer)) return true;
  console.error("Nothing changed.");
  process.exit(1);
}

async function promptNewPassphrase(): Promise<string> {
  const passphrase = await promptHidden("New passphrase: ");
  const confirmation = await promptHidden("Repeat new passphrase: ");
  if (passphrase !== confirmation) {
    console.error("error: passphrases do not match. Nothing changed.");
    process.exit(1);
  }
  return passphrase;
}

function printOutcome(v: ChangePassphraseOutput): void {
  console.log(
    v.unlockedOnThisDevice
      ? `Passphrase changed. Vault re-encrypted, generation ${v.generation}, still unlocked on this device.`
      : `Passphrase changed. Vault re-encrypted, generation ${v.generation}. It is now LOCKED on this device: ` +
          'the OS keychain did not accept the new key. Run "valija unlock" with your NEW passphrase.',
  );
  console.log("");
  console.log(renderRecoveryKit(v.vaultId, v.keyHex, v.createdAt, v.issuedAt));
  console.log(
    "^ THIS IS YOUR NEW RECOVERY KIT — shown ONCE. Your previous kit no longer opens this vault.\n",
  );
  console.log('On your other devices: run "valija unlock" with the NEW passphrase.');
  console.log("Destroy your old recovery kit. It still opens old copies of this vault.");
}
