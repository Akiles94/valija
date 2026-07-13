import { ulid } from "ulid";
import { CreateVault } from "../application/usecases/create-vault.js";
import { ExportPack } from "../application/usecases/export-pack.js";
import { GetContextPack } from "../application/usecases/get-context-pack.js";
import { ListProjects } from "../application/usecases/list-projects.js";
import { LockVault } from "../application/usecases/lock-vault.js";
import { SaveContext } from "../application/usecases/save-context.js";
import { SearchContext } from "../application/usecases/search-context.js";
import { ShowProject } from "../application/usecases/show-project.js";
import { UnlockVault } from "../application/usecases/unlock-vault.js";
import { VaultStatus } from "../application/usecases/vault-status.js";
import type { Clock, IdGenerator } from "../domain/ports/clock.js";
import { Argon2VaultCrypto } from "../infrastructure/crypto/argon2.js";
import { SqliteVaultSessionFactory } from "../infrastructure/db/session-factory.js";
import { OsKeychain } from "../infrastructure/keychain/keyring.js";
import { resolveVaultPaths, type VaultPaths } from "../infrastructure/vault-paths.js";
import { FileVaultStore } from "../infrastructure/vault-store.js";

const systemClock: Clock = { now: () => new Date() };
const ulidIds: IdGenerator = { next: () => ulid() };

export interface Container {
  paths: VaultPaths;
  createVault: CreateVault;
  unlockVault: UnlockVault;
  lockVault: LockVault;
  vaultStatus: VaultStatus;
  saveContext: SaveContext;
  listProjects: ListProjects;
  searchContext: SearchContext;
  getContextPack: GetContextPack;
  exportPack: ExportPack;
  showProject: ShowProject;
}

export function buildContainer(): Container {
  const paths = resolveVaultPaths();
  const store = new FileVaultStore(paths);
  const crypto = new Argon2VaultCrypto();
  const keychain = new OsKeychain();
  const sessions = new SqliteVaultSessionFactory(paths, keychain);
  const getContextPack = new GetContextPack(sessions, systemClock);
  return {
    paths,
    createVault: new CreateVault(store, crypto, keychain, systemClock, ulidIds),
    unlockVault: new UnlockVault(store, crypto, keychain),
    lockVault: new LockVault(store, keychain),
    vaultStatus: new VaultStatus(store, keychain),
    saveContext: new SaveContext(sessions, systemClock, ulidIds),
    listProjects: new ListProjects(sessions),
    searchContext: new SearchContext(sessions),
    getContextPack,
    exportPack: new ExportPack(sessions, getContextPack),
    showProject: new ShowProject(sessions),
  };
}
