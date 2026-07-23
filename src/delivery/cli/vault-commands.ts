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
  if (result.value.fork !== undefined) {
    const { notice } = result.value.fork;
    console.error(`\nerror [${notice.code}]: ${notice.message}`);
    console.error(`Vault folder: ${c.paths.root}`);
  }
}

export function lockCommand(c: Container): void {
  const result = c.lockVault.execute();
  if (!result.ok) fail(result.error);
  const v = result.value;
  if (!v.wasUnlocked) {
    console.log("Vault was already locked.");
    return;
  }

  const generationText =
    v.generation !== undefined ? `generation ${v.generation}` : "generation unknown";
  const writerText =
    v.writer === undefined
      ? ""
      : `, last written by ${v.writerIsThisDevice ? "this device" : "another device"}`;
  console.log(
    `Vault locked. On-disk state: single file (vault.db), ${generationText}${writerText}.`,
  );
  if (v.sidecars.length > 0) {
    console.log(`Warning: stray files present, not safely at rest: ${v.sidecars.join(", ")}`);
  } else {
    console.log("Safe to let your sync client finish before opening valija elsewhere.");
  }
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
  console.log(
    `journal:  ${s.journalMode}${s.sidecars.length > 0 ? ` (stray: ${s.sidecars.join(", ")})` : " (single file at rest)"}`,
  );
  if (s.generation !== undefined) {
    console.log(
      `lineage:  generation ${s.generation}, last written by ${s.lastWriterIsThisDevice ? "this device" : "another device"}`,
    );
  }
  const ttl = s.autoLock.ttlMinutes;
  if (ttl === null) {
    console.log("auto-lock: disabled");
  } else if (s.autoLock.idleForMinutes !== undefined) {
    const idle = s.autoLock.idleForMinutes.toFixed(1);
    console.log(
      `auto-lock: ${ttl}m TTL, idle for ${idle}m${s.autoLock.expired ? " (expired)" : ""}`,
    );
  } else {
    console.log(`auto-lock: ${ttl}m TTL`);
  }
}
