import { useEffect, useState } from "react";
import DataErrorBanner from "../components/feedback/DataErrorBanner";
import NetworkStatusBanner from "../components/feedback/NetworkStatusBanner";
import { useCloudSync } from "../features/todos/hooks/useCloudSync";
import { useTodos } from "../features/todos/hooks/useTodos";
import { applyPwaUpdate } from "../lib/pwa";
import AppProviders from "./providers";
import AppRouter from "./router";

const AppContent = () => {
  const todosState = useTodos();
  const cloudSync = useCloudSync({
    repository: todosState.repository,
    localDataVersion: todosState.envelope?.dataVersion ?? null,
    localDirty: todosState.envelope?.sync.dirty ?? false,
    onLocalChange: todosState.reload,
  });
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = () => setIsUpdateReady(true);
    window.addEventListener("pwa:need-refresh", handleNeedRefresh);
    return () => {
      window.removeEventListener("pwa:need-refresh", handleNeedRefresh);
    };
  }, []);

  const handlePwaRefresh = () => {
    void applyPwaUpdate();
  };

  return (
    <div className="app-shell">
      {isUpdateReady && (
        <div className="pwa-update-banner" role="status">
          <span>发现新版本，刷新即可更新。</span>
          <button
            className="pwa-update-btn"
            type="button"
            onClick={handlePwaRefresh}
          >
            刷新
          </button>
        </div>
      )}
      <NetworkStatusBanner />
      {todosState.error && (
        <DataErrorBanner
          error={todosState.error}
          onDismiss={todosState.dismissError}
          onRetry={todosState.reload}
        />
      )}
      <main className="app-main-home">
        <AppRouter
          todos={todosState.todos}
          envelope={todosState.envelope}
          storageSize={todosState.storageSize}
          cloudSync={cloudSync}
          onAddTodo={todosState.addTodo}
          onAddSuggestedTodos={todosState.addSuggestedTodos}
          onToggleTodo={todosState.toggleTodo}
          onRemoveTodo={todosState.removeTodo}
          onClearCompleted={todosState.clearCompleted}
          onExportData={todosState.exportData}
          onExportLatestBackup={todosState.exportLatestBackup}
          onImportData={todosState.importData}
          onResetData={todosState.resetData}
        />
      </main>
    </div>
  );
};

const App = () => (
  <AppProviders>
    <AppContent />
  </AppProviders>
);

export default App;
