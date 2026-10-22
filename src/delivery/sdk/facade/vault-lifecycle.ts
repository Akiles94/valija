import { err, ok, type Result } from "../../../shared/domain/result.js";
import { InMemoryKeychain } from "../../../vault/infra/in-memory-keychain.js";
import { renderRecoveryKit } from "../../../vault/infra/recovery-kit.js";
import { readVaultHeader } from "../../../vault/infra/vault-header.js";
import { buildContainer } from "../../container.js";
import type { CreateVaultOptions, OpenVaultOptions } from "../dto/requests.js";
import type { CreatedVault, ValijaVault } from "../dto/results.js";
import type { ValijaError } from "../dto/valija-error.js";
import { toValijaError, unexpectedError } from "../mapping/to-valija-error.js";
import { createVaultSchema, openVaultSchema, parseInput } from "../validation/sdk-schemas.js";
import { createVaultHandle } from "./vault-handle.js";

interface ParsedOpen {
  client: string;
  vaultRoot?: string | undefined;
  allowUpgrade?: boolean | undefined;
  passphrase?: string | undefined;
  recoveryKey?: string | undefined;
}

/**
 * Open the vault — the same one the CLI, desktop and MCP use (D-C). Without a credential it is
 * Mode K: reuse the session the user unlocked with Valija. With a passphrase or recovery key it is
 * Mode P: the key is derived and held in this process only, never in the OS keychain (D-A).
 * Never throws for an expected condition (D-O). The options are never retained (§11.3).
 */
export async function openVault(
  options: OpenVaultOptions,
): Promise<Result<ValijaVault, ValijaError>> {
  const parsed = parseInput(openVaultSchema, options);
  if (!parsed.ok) return parsed;
  const open = parsed.value;
  return guarded(() =>
    open.passphrase !== undefined || open.recoveryKey !== undefined
      ? openInProcess(open)
      : openWithKeychainSession(open),
  );
}

/**
 * Create a vault with the same format, KDF parameters and passphrase rule as `valija init` (D-D).
 * The new vault is open in Mode P; nothing touches the OS keychain. `recoveryKit` is returned once:
 * show it to the user, then discard it (⚑ D-D.1). No kit file is written anywhere.
 */
export async function createVault(
  options: CreateVaultOptions,
): Promise<Result<CreatedVault, ValijaError>> {
  const parsed = parseInput(createVaultSchema, options);
  if (!parsed.ok) return parsed;
  const { client, vaultRoot, passphrase } = parsed.value;
  return guarded(async () => {
    const keychain = new InMemoryKeychain();
    const container = buildContainer({
      ...(vaultRoot === undefined ? {} : { vaultRoot }),
      keychain,
      keepActivityInMemory: true,
      autoMigrate: false,
    });
    const created = await container.createVault.execute(passphrase);
    if (!created.ok) return err(toValijaError(created.error));
    const { vaultId, keyHex, createdAt } = created.value;
    const vault = createVaultHandle({ mode: "in-process", container, client, vaultId, keychain });
    return ok({ vault, vaultId, recoveryKit: renderRecoveryKit(vaultId, keyHex, createdAt) });
  });
}

/** Mode K: read the header only — no key read, no unlock. Lock, auto-lock and schema problems surface per call (A7). */
async function openWithKeychainSession(
  open: ParsedOpen,
): Promise<Result<ValijaVault, ValijaError>> {
  const container = buildContainer({
    ...(open.vaultRoot === undefined ? {} : { vaultRoot: open.vaultRoot }),
    autoMigrate: open.allowUpgrade === true,
  });
  const header = readVaultHeader(container.paths.header);
  if (!header.ok) return err(toValijaError(header.error));
  const vaultId = header.value.vaultId;
  return ok(
    createVaultHandle({ mode: "keychain-session", container, client: open.client, vaultId }),
  );
}

/** Mode P: UnlockVault over an in-memory keychain and in-memory activity (⚑ D-A.3). Refusals set nothing. */
async function openInProcess(open: ParsedOpen): Promise<Result<ValijaVault, ValijaError>> {
  const keychain = new InMemoryKeychain();
  const container = buildContainer({
    ...(open.vaultRoot === undefined ? {} : { vaultRoot: open.vaultRoot }),
    keychain,
    keepActivityInMemory: true,
    autoMigrate: open.allowUpgrade === true,
  });
  const unlocked = await container.unlockVault.execute({
    ...(open.passphrase === undefined ? {} : { passphrase: open.passphrase }),
    ...(open.recoveryKey === undefined ? {} : { recoveryKeyHex: open.recoveryKey }),
    upgradeConfirmed: open.allowUpgrade === true,
  });
  if (!unlocked.ok) return err(toValijaError(unlocked.error));
  const { vaultId, fork } = unlocked.value;
  return ok(
    createVaultHandle({
      mode: "in-process",
      container,
      client: open.client,
      vaultId,
      keychain,
      ...(fork === undefined
        ? {}
        : { forkNotice: { generation: fork.generation, message: fork.notice.message } }),
    }),
  );
}

/** One try/catch for the lifecycle: a throw is never an expected condition (D-O, P-20). */
async function guarded<T>(
  action: () => Promise<Result<T, ValijaError>>,
): Promise<Result<T, ValijaError>> {
  try {
    return await action();
  } catch (thrown) {
    return err(unexpectedError(thrown));
  }
}
