import { useEffect, useState } from "react";
import { NavBar } from "./components/nav-bar.js";
import { ConnectToolsScreen } from "./screens/connect-tools.js";
import { CreateVaultScreen } from "./screens/create-vault.js";
import { DashboardScreen } from "./screens/dashboard.js";
import { ImportScreen } from "./screens/import.js";
import { LockedScreen, type UnlockCredential } from "./screens/locked.js";
import { MigrationConfirmScreen } from "./screens/migration-confirm.js";
import { NoVaultScreen } from "./screens/no-vault.js";
import { PackPreviewScreen } from "./screens/pack-preview.js";
import { ProjectScreen } from "./screens/project.js";
import { RecoveryKitScreen } from "./screens/recovery-kit.js";
import { RelocateVaultScreen } from "./screens/relocate-vault.js";
import { SearchScreen } from "./screens/search.js";
import { SyncScreen } from "./screens/sync.js";
import { getBridge } from "./state/bridge.js";
import { I18nProvider } from "./state/i18n-context.js";
import {
  afterCreateSuccess,
  afterKitAcknowledged,
  afterLock,
  afterMigrationCancelled,
  afterStatusCheck,
  afterUnlockFailure,
  afterUnlockSuccess,
  afterUnlockUpgradeRequired,
  canNavigateAwayFrom,
  creating,
  INITIAL_STATE,
  type SessionState,
} from "./state/session-state.js";
import { ThemeProvider } from "./state/theme-context.js";
import { INITIAL_WORKSPACE_VIEW, type WorkspaceView } from "./state/workspace-nav.js";

const bridge = getBridge();

export function App() {
  const [preferences, setPreferences] = useState<Awaited<
    ReturnType<typeof bridge.preferences.read>
  > | null>(null);
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const [dbPath, setDbPath] = useState<string>("");
  const [pendingCredential, setPendingCredential] = useState<UnlockCredential | null>(null);

  useEffect(() => {
    (async () => {
      const prefs = await bridge.preferences.read();
      setPreferences(prefs);
      const status = await bridge.vault.status();
      if (status.ok) {
        setDbPath(status.value.dbPath);
        setState(afterStatusCheck(status.value));
      }
    })();
  }, []);

  if (preferences === null) return null; // "checking" — nothing renders yet, no flash of the wrong language

  return (
    <I18nProvider preferences={preferences}>
      <ThemeProvider preferences={preferences}>
        <Router
          state={state}
          setState={setState}
          dbPath={dbPath}
          pendingCredential={pendingCredential}
          setPendingCredential={setPendingCredential}
        />
      </ThemeProvider>
    </I18nProvider>
  );
}

function Router({
  state,
  setState,
  dbPath,
  pendingCredential,
  setPendingCredential,
}: {
  state: SessionState;
  setState: (s: SessionState) => void;
  dbPath: string;
  pendingCredential: UnlockCredential | null;
  setPendingCredential: (c: UnlockCredential | null) => void;
}) {
  // D-U(a)'s invariant, asserted at the routing boundary: once kit-pending,
  // the only escape is RecoveryKitScreen's own onAcknowledged callback.
  if (state.phase === "kit-pending") {
    return (
      <RecoveryKitScreen
        bridge={bridge}
        onAcknowledged={() => {
          if (!canNavigateAwayFrom({ phase: "kit-pending" })) return;
          setState(afterKitAcknowledged());
        }}
      />
    );
  }

  switch (state.phase) {
    case "checking":
      return null;

    case "no-vault":
      return (
        <NoVaultScreen
          bridge={bridge}
          onCreateVault={() => setState(creating())}
          onPointedAtExisting={() => setState(afterLock())}
        />
      );

    case "creating":
      return <CreateVaultScreen bridge={bridge} onCreated={() => setState(afterCreateSuccess())} />;

    case "locked":
      return (
        <LockedScreen
          bridge={bridge}
          onUnlocked={(result) => setState(afterUnlockSuccess(result.fork))}
          onUpgradeRequired={(credential) => {
            setPendingCredential(credential);
            setState(afterUnlockUpgradeRequired());
          }}
        />
      );

    case "unlocking":
      return null;

    case "upgrade-required":
      if (pendingCredential === null) {
        // Should be unreachable — onUpgradeRequired always sets it first.
        setState(afterUnlockFailure());
        return null;
      }
      return (
        <MigrationConfirmScreen
          bridge={bridge}
          credential={pendingCredential}
          dbPath={dbPath}
          onCancel={() => {
            setPendingCredential(null);
            setState(afterMigrationCancelled());
          }}
          onUnlocked={(result) => {
            setPendingCredential(null);
            setState(afterUnlockSuccess(result.fork));
          }}
        />
      );

    case "unlocked":
      return <Workspace onVaultRelocated={() => setState(afterLock())} />;

    default:
      return null;
  }
}

/** Dashboard/search/sync are the nav-bar's three top-level destinations; project, pack-preview, and relocate-vault are drill-downs, reached from Dashboard/Sync, that don't get their own nav entry. */
function Workspace({ onVaultRelocated }: { onVaultRelocated: () => void }) {
  const [view, setView] = useState<WorkspaceView>(INITIAL_WORKSPACE_VIEW);

  return (
    <div className="workspace">
      <NavBar active={view.screen} onNavigate={(screen) => setView({ screen })} />
      {view.screen === "dashboard" && (
        <DashboardScreen
          bridge={bridge}
          onSelectProject={(project) => setView({ screen: "project", project })}
          onConnectTool={() => setView({ screen: "connect-tools" })}
          onImportHistory={() => setView({ screen: "import" })}
        />
      )}
      {view.screen === "connect-tools" && <ConnectToolsScreen bridge={bridge} />}
      {view.screen === "import" && <ImportScreen bridge={bridge} />}
      {view.screen === "project" && (
        <ProjectScreen
          bridge={bridge}
          project={view.project}
          onBack={() => setView({ screen: "dashboard" })}
          onViewPack={(project) => setView({ screen: "pack-preview", project })}
        />
      )}
      {view.screen === "search" && <SearchScreen bridge={bridge} />}
      {view.screen === "pack-preview" && (
        <PackPreviewScreen
          bridge={bridge}
          project={view.project}
          onBack={() => setView({ screen: "project", project: view.project })}
        />
      )}
      {view.screen === "sync" && (
        <SyncScreen bridge={bridge} onMoveVault={() => setView({ screen: "relocate-vault" })} />
      )}
      {view.screen === "relocate-vault" && (
        // The move locks the vault as its first step (§4.7 step 31) — "Unlock
        // again" hands control back to the Router's own "locked" screen
        // rather than staying inside a workspace the vault can no longer back.
        <RelocateVaultScreen bridge={bridge} onDone={onVaultRelocated} />
      )}
    </div>
  );
}
