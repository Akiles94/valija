import type { Container } from "../../../../../src/delivery/container.js";
import { renderRecoveryKit } from "../../../../../src/vault/infra/recovery-kit.js";
import type {
  RecoveryKitResponse,
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
  // The recovery kit is one of the two exceptions §5.1 allows to cross the
  // boundary as a secret (D-M) — held here, in main, as plain state and
  // handed to the renderer exactly once: `vault:readRecoveryKit` clears the
  // slot on read, so a second call gets `null`, not a re-render of the same
  // key. There is only ever one vault, so one slot is enough — no nonce map.
  let pendingKitText: string | null = null;

  return {
    "vault:init": async (req: VaultInitRequest) => {
      const result = await getContainer().createVault.execute(req.passphrase);
      if (result.ok) {
        pendingKitText = renderRecoveryKit(
          result.value.vaultId,
          result.value.keyHex,
          result.value.createdAt,
        );
      }
      return toIpcResult(
        result,
        (v): VaultInitResponse => ({
          vaultId: v.vaultId,
          createdAt: v.createdAt,
        }),
      );
    },

    "vault:readRecoveryKit": (): RecoveryKitResponse | null => {
      if (pendingKitText === null) return null;
      const text = pendingKitText;
      pendingKitText = null;
      return { text };
    },

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
