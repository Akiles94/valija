import { renderRecoveryKit } from "../../vault/infra/recovery-kit.js";
import type { Container } from "../container.js";
import { promptHidden } from "./prompt.js";
import { fail } from "./render.js";

export async function initCommand(c: Container): Promise<void> {
  console.log("Creating your encrypted vault.\n");
  console.log("Choose a passphrase (min 8 chars). You will need it to unlock the vault.");
  console.log("If you lose it AND the recovery kit, your data is gone. No reset exists.\n");

  const passphrase = await promptHidden("Passphrase: ");
  const confirmation = await promptHidden("Repeat passphrase: ");
  if (passphrase !== confirmation) {
    console.error("error: passphrases do not match.");
    process.exit(1);
  }

  console.log("\nDeriving key (Argon2id, ~1s)...");
  const result = await c.createVault.execute(passphrase);
  if (!result.ok) fail(result.error);

  const kit = renderRecoveryKit(result.value.vaultId, result.value.keyHex, result.value.createdAt);
  console.log(`\nVault created at ${c.paths.root} and unlocked.\n`);
  console.log(kit);
  console.log("^ THIS IS YOUR RECOVERY KIT — it is shown ONCE and never stored.");
  console.log("  Copy it somewhere safe (offline) before you close this terminal.\n");
  console.log('Next: run "valija install claude-code" (or claude-desktop, cursor).');
}

export async function unlockCommand(
  c: Container,
  options: { recoveryKey?: string },
): Promise<void> {
  const input =
    options.recoveryKey !== undefined
      ? { recoveryKeyHex: options.recoveryKey }
      : { passphrase: await promptHidden("Passphrase: ") };
  const result = await c.unlockVault.execute(input);
  if (!result.ok) fail(result.error);
  console.log("Vault unlocked. MCP tools can now read and write context.");
  console.log('Lock it again with "valija lock".');
}

export function lockCommand(c: Container): void {
  const result = c.lockVault.execute();
  if (!result.ok) fail(result.error);
  console.log(result.value.wasUnlocked ? "Vault locked." : "Vault was already locked.");
}

export function statusCommand(c: Container): void {
  const result = c.vaultStatus.execute();
  if (!result.ok) fail(result.error);
  const s = result.value;
  if (!s.initialized) {
    console.log('No vault on this machine. Run "valija init" to create one.');
    return;
  }
  console.log(`vault:    ${s.dbPath}`);
  console.log(`vault id: ${s.vaultId}`);
  console.log(`state:    ${s.unlocked ? "UNLOCKED" : "LOCKED"}`);
}
