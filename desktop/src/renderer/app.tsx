import { useEffect, useState } from "react";
import { CreateVaultScreen } from "./screens/create-vault.js";
import { LockedScreen, type UnlockCredential } from "./screens/locked.js";
import { MigrationConfirmScreen } from "./screens/migration-confirm.js";
import { NoVaultScreen } from "./screens/no-vault.js";
import { RecoveryKitScreen } from "./screens/recovery-kit.js";
import { getBridge } from "./state/bridge.js";
import { I18nProvider } from "./state/i18n-context.js";
import {
  afterCreateSuccess,
  afterKitAcknowledged,
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
          onCreateVault={() => setState(creating())}
          onPointAtExisting={() => {
            // Wired to the relocation wizard's mirror flow in Slice 8.
            void bridge.dialog.chooseVaultFolder();
          }}
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
      // Slice 7 builds the dashboard; a minimal placeholder until then.
      return <div className="screen">{"unlocked"}</div>;

    default:
      return null;
  }
}
