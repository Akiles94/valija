import type { Container } from "../../../../../src/delivery/container.js";
import type {
  VaultInitRequest,
  VaultInitResponse,
  VaultLockResponse,
  VaultStatusResponse,
  VaultUnlockRequest,
  VaultUnlockResponse,
  VaultUpgradeCheckRequest,
  VaultUpgradeCheckResponse,
} from "../../../shared/ipc/messages.js";
import { toIpcResult } from "../to-ipc-result.js";

/**
 * Four lines each: validate (schemas.ts, before this runs), call the use
 * case, map `Result` to a wire shape, return. Errors cross as `{ code }`
 * only (D-V(d)) — `toIpcResult` is where `DomainError.message` gets dropped.
 */
export function createVaultHandlers(getContainer: () => Container) {
  return {
    "vault:init": async (req: VaultInitRequest) =>
      toIpcResult(
        await getContainer().createVault.execute(req.passphrase),
        (v): VaultInitResponse => v,
      ),

    "vault:unlock": async (req: VaultUnlockRequest) =>
      toIpcResult(
        await getContainer().unlockVault.execute(req),
        (v): VaultUnlockResponse => ({
          vaultId: v.vaultId,
          ...(v.fork === undefined
            ? {}
            : {
                fork: {
                  generation: v.fork.generation,
                  writer: v.fork.writer,
                  noticeCode: v.fork.notice.code,
                },
              }),
        }),
      ),

    "vault:lock": () =>
      toIpcResult(getContainer().lockVault.execute(), (v): VaultLockResponse => v),

    "vault:status": () =>
      toIpcResult(getContainer().vaultStatus.execute(), (v): VaultStatusResponse => v),

    "vault:upgradeCheck": async (req: VaultUpgradeCheckRequest) =>
      toIpcResult(
        await getContainer().checkVaultUpgrade.execute(req),
        (v): VaultUpgradeCheckResponse => v,
      ),
  };
}
