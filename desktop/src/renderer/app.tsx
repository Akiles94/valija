import { type ReactNode, useEffect, useState } from "react";
import { shouldPlayTour } from "../main/application/policies/onboarding-tour.js";
import type { AppPreferencesMessage, PreferencesWriteRequest } from "../shared/ipc/messages.js";
import { NavBar } from "./components/nav-bar.js";
import { ConnectToolsScreen } from "./screens/connect-tools.js";
import { CreateVaultScreen } from "./screens/create-vault.js";
import { DashboardScreen } from "./screens/dashboard.js";
import { DiagnosticsScreen } from "./screens/diagnostics.js";
import { ImportScreen } from "./screens/import.js";
import { LockedScreen, type UnlockCredential } from "./screens/locked.js";
import { MigrationConfirmScreen } from "./screens/migration-confirm.js";
import { NoVaultScreen } from "./screens/no-vault.js";
import { OnboardingScreen } from "./screens/onboarding.js";
import { PackPreviewScreen } from "./screens/pack-preview.js";
import { ProjectScreen } from "./screens/project.js";
import { RecoveryKitScreen } from "./screens/recovery-kit.js";
import { RelocateVaultScreen } from "./screens/relocate-vault.js";
import { SearchScreen } from "./screens/search.js";
import { SettingsScreen } from "./screens/settings.js";
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
import { ThemeProvider, useTheme } from "./state/theme-context.js";
import { INITIAL_WORKSPACE_VIEW, type WorkspaceView } from "./state/workspace-nav.js";

const bridge = getBridge();

/** Only place `data-theme` is applied outside the recovery kit's own permanent `dark` (D-Q, item 89b). */
function ThemedRoot({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <div className="app-shell" data-theme={theme}>
      {children}
    </div>
  );
}

export function App() {
  const [preferences, setPreferences] = useState<AppPreferencesMessage | null>(null);
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const [dbPath, setDbPath] = useState<string>("");
  const [pendingCredential, setPendingCredential] = useState<UnlockCredential | null>(null);
  const [overlay, setOverlay] = useState<"tour" | "settings" | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(INITIAL_WORKSPACE_VIEW);

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

  // D-U(a) Option 2: the tour plays the first time this installation reaches
  // the dashboard, on either branch of the entry screen — driven entirely by
  // the persisted flag, never by which branch was taken.
  useEffect(() => {
    if (preferences !== null && state.phase === "unlocked" && shouldPlayTour(preferences)) {
      setOverlay("tour");
    }
  }, [state.phase, preferences]);

  if (preferences === null) return null; // "checking" — nothing renders yet, no flash of the wrong language

  async function updatePreferences(patch: Partial<PreferencesWriteRequest>) {
    if (preferences === null) return;
    const next: PreferencesWriteRequest = {
      theme: preferences.theme,
      language: preferences.language,
      tourSeen: preferences.tourSeen,
      ...patch,
    };
    await bridge.preferences.write(next);
    setPreferences(await bridge.preferences.read());
  }

  // Writes `tourSeen` *before* clearing the overlay, so by the time this
  // installation's tour-trigger effect re-evaluates, `preferences.tourSeen`
  // is already true and it does not reopen (Skip and "Get started" both
  // route here — D-U(b)'s rider).
  async function finishTour() {
    await updatePreferences({ tourSeen: true });
    setOverlay(null);
  }

  return (
    <I18nProvider preferences={preferences}>
      <ThemeProvider preferences={preferences}>
        <ThemedRoot>
          {overlay === "tour" && canNavigateAwayFrom(state) ? (
            <OnboardingScreen onDone={() => void finishTour()} />
          ) : overlay === "settings" && canNavigateAwayFrom(state) ? (
            <SettingsScreen
              preferences={preferences}
              unlocked={state.phase === "unlocked"}
              onUpdatePreferences={(patch) => void updatePreferences(patch)}
              onClose={() => setOverlay(null)}
              onReplayTour={() => setOverlay("tour")}
              onOpenDiagnostics={() => {
                setOverlay(null);
                setWorkspaceView({ screen: "diagnostics" });
              }}
              onOpenRelocate={() => {
                setOverlay(null);
                setWorkspaceView({ screen: "relocate-vault" });
              }}
            />
          ) : (
            <Router
              state={state}
              setState={setState}
              dbPath={dbPath}
              pendingCredential={pendingCredential}
              setPendingCredential={setPendingCredential}
              workspaceView={workspaceView}
              setWorkspaceView={setWorkspaceView}
              onOpenSettings={() => setOverlay("settings")}
            />
          )}
        </ThemedRoot>
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
  workspaceView,
  setWorkspaceView,
  onOpenSettings,
}: {
  state: SessionState;
  setState: (s: SessionState) => void;
  dbPath: string;
  pendingCredential: UnlockCredential | null;
  setPendingCredential: (c: UnlockCredential | null) => void;
  workspaceView: WorkspaceView;
  setWorkspaceView: (v: WorkspaceView) => void;
  onOpenSettings: () => void;
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
          onOpenSettings={onOpenSettings}
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
      return (
        <Workspace
          view={workspaceView}
          setView={setWorkspaceView}
          onOpenSettings={onOpenSettings}
          onVaultRelocated={() => setState(afterLock())}
        />
      );

    default:
      return null;
  }
}

/** Dashboard/search/sync are the nav-bar's three top-level destinations; project, pack-preview, relocate-vault, connect-tools, import, and diagnostics are drill-downs, reached from Dashboard/Sync/Settings, that don't get their own nav entry. */
function Workspace({
  view,
  setView,
  onOpenSettings,
  onVaultRelocated,
}: {
  view: WorkspaceView;
  setView: (v: WorkspaceView) => void;
  onOpenSettings: () => void;
  onVaultRelocated: () => void;
}) {
  return (
    <div className="workspace">
      <NavBar
        active={view.screen}
        onNavigate={(screen) => setView({ screen })}
        onOpenSettings={onOpenSettings}
      />
      {view.screen === "dashboard" && (
        <DashboardScreen
          bridge={bridge}
          onSelectProject={(project) => setView({ screen: "project", project })}
          onConnectTool={() => setView({ screen: "connect-tools" })}
          onImportHistory={() => setView({ screen: "import" })}
          onCheckSetup={() => setView({ screen: "diagnostics" })}
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
        <SyncScreen
          bridge={bridge}
          onMoveVault={() => setView({ screen: "relocate-vault" })}
          onCheckSetup={() => setView({ screen: "diagnostics" })}
        />
      )}
      {view.screen === "diagnostics" && <DiagnosticsScreen bridge={bridge} />}
      {view.screen === "relocate-vault" && (
        // The move locks the vault as its first step (§4.7 step 31) — "Unlock
        // again" hands control back to the Router's own "locked" screen
        // rather than staying inside a workspace the vault can no longer back.
        <RelocateVaultScreen bridge={bridge} onDone={onVaultRelocated} />
      )}
    </div>
  );
}
