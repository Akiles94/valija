/**
 * `valija/sdk` — embed the user's own Valija vault in a Node 22 product (docs/sdk.md).
 * Importing this module does nothing: no I/O, no environment read, no output, no timer (§9).
 */
export type { Result } from "../../shared/domain/result.js";
export type {
  ContextPackRequest,
  CreateVaultOptions,
  HandoffRequest,
  KeychainSessionOptions,
  OpenVaultOptions,
  PassphraseOptions,
  RecoveryKeyOptions,
  SaveableType,
  SaveRequest,
  SearchRequest,
} from "./dto/requests.js";
export type {
  CreatedVault,
  ForkNotice,
  ProjectSummary,
  RenderedPack,
  SavedItem,
  SearchHit,
  ValijaVault,
  VaultMode,
} from "./dto/results.js";
export type { ValijaError, ValijaErrorCode } from "./dto/valija-error.js";
export { createVault, openVault } from "./facade/vault-lifecycle.js";
