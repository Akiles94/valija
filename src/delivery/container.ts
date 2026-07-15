import { ulid } from "ulid";
import { GetContextPack } from "../context/application/use-cases/get-context-pack.use-case.js";
import { ListProjects } from "../context/application/use-cases/list-projects.use-case.js";
import { SaveContext } from "../context/application/use-cases/save-context.use-case.js";
import { SearchContext } from "../context/application/use-cases/search-context.use-case.js";
import { ShowProject } from "../context/application/use-cases/show-project.use-case.js";
import { SqliteVaultSessions } from "../context/infra/vault-sessions.js";
import type { Clock, IdGenerator } from "../shared/application/ports/clock.js";
import { resolveVaultPaths, type VaultPaths } from "../shared/infra/vault-paths.js";
import { CreateVault } from "../vault/application/use-cases/create-vault.use-case.js";
import { LockVault } from "../vault/application/use-cases/lock-vault.use-case.js";
import { UnlockVault } from "../vault/application/use-cases/unlock-vault.use-case.js";
import { VaultStatus } from "../vault/application/use-cases/vault-status.use-case.js";
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
  showProject: ShowProject;
}

export function buildContainer(): Container {
  const paths = resolveVaultPaths();
  const store = new FileVaultStore(paths);
  const crypto = new Argon2VaultCrypto();
  const keychain = new OsKeychain();
  const sessions = new SqliteVaultSessions(paths, keychain);
  return {
    paths,
    createVault: new CreateVault(store, crypto, keychain, systemClock, ulidIds),
    unlockVault: new UnlockVault(store, crypto, keychain),
    lockVault: new LockVault(store, keychain),
    vaultStatus: new VaultStatus(store, keychain),
    saveContext: new SaveContext(sessions, systemClock, ulidIds),
    listProjects: new ListProjects(sessions),
    searchContext: new SearchContext(sessions),
    getContextPack: new GetContextPack(sessions, systemClock),
    showProject: new ShowProject(sessions),
  };
}
