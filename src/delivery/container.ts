import { ulid } from "ulid";
import { ExportPack } from "../context/application/export-pack.js";
import { GetContextPack } from "../context/application/get-context-pack.js";
import { ListProjects } from "../context/application/list-projects.js";
import { SaveContext } from "../context/application/save-context.js";
import { SearchContext } from "../context/application/search-context.js";
import { ShowProject } from "../context/application/show-project.js";
import { SqliteVaultSessionFactory } from "../context/infra/session-factory.js";
import type { Clock, IdGenerator } from "../shared/application/ports/clock.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { CreateVault } from "../vault/application/create-vault.js";
import { LockVault } from "../vault/application/lock-vault.js";
import { UnlockVault } from "../vault/application/unlock-vault.js";
import { VaultStatus } from "../vault/application/vault-status.js";
import { Argon2VaultCrypto } from "../vault/infra/argon2.js";
import { FileVaultStore } from "../vault/infra/file-vault-store.js";
import { OsKeychain } from "../vault/infra/keyring.js";

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
