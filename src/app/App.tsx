import { useEffect, useState } from "react";
import DataErrorBanner from "../components/feedback/DataErrorBanner";
import NetworkStatusBanner from "../components/feedback/NetworkStatusBanner";
import { useCloudSync } from "../features/trips/hooks/useCloudSync";
import { useTrips } from "../features/trips/hooks/useTrips";
import { applyPwaUpdate } from "../lib/pwa";
import AppProviders from "./providers";
import AppRouter from "./router";

const AppContent = () => {
  const tripsState = useTrips();
  const cloudSync = useCloudSync({
    repository: tripsState.repository,
    localDataVersion: tripsState.envelope?.dataVersion ?? null,
    localDirty: tripsState.envelope?.sync.dirty ?? false,
    onLocalChange: tripsState.reload,
  });
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = () => setIsUpdateReady(true);
    window.addEventListener("pwa:need-refresh", handleNeedRefresh);
    return () =>
      window.removeEventListener("pwa:need-refresh", handleNeedRefresh);
  }, []);

  return (
    <>
      {isUpdateReady ? (
        <div className="pwa-update-banner" role="status">
          <span>发现新版本，刷新即可更新。</span>
          <button
            className="pwa-update-btn"
            type="button"
            onClick={() => void applyPwaUpdate()}
          >
            刷新
          </button>
        </div>
      ) : null}
      <NetworkStatusBanner />
      {tripsState.error ? (
        <DataErrorBanner
          error={tripsState.error}
          onDismiss={tripsState.dismissError}
          onRetry={() => void tripsState.reload()}
        />
      ) : null}
      <AppRouter
        trips={tripsState.trips}
        geocodeCache={tripsState.geocodeCache}
        envelope={tripsState.envelope}
        storageSize={tripsState.storageSize}
        cloudSync={cloudSync}
        onAddTrip={tripsState.addTrip}
        onAddGeneratedTrip={tripsState.addGeneratedTrip}
        onReplaceTrip={tripsState.replaceTrip}
        onRemoveTrip={tripsState.removeTrip}
        onAddPoint={tripsState.addPoint}
        onCacheGeocode={tripsState.cacheGeocode}
        onExportData={tripsState.exportData}
        onExportLatestBackup={tripsState.exportLatestBackup}
        onImportData={tripsState.importData}
        onResetData={tripsState.resetData}
      />
    </>
  );
};

const App = () => (
  <AppProviders>
    <AppContent />
  </AppProviders>
);

export default App;
