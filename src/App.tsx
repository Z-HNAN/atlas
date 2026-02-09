import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import SubAppHost from "./pages/SubAppHost";
import NotFound from "./pages/NotFound";
import TopNav from "./components/TopNav";
import { useSubApps } from "./hooks/useSubApps";
import { initGarfish } from "./lib/garfish";
import { applyPwaUpdate } from "./lib/pwa";

const AppContent = () => {
  const { subApps, addSubApp, removeSubApp } = useSubApps();
  const location = useLocation();
  const isInSubApp = location.pathname.startsWith("/apps/");
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    initGarfish(subApps);
  }, [subApps]);

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
          <button className="pwa-update-btn" onClick={handlePwaRefresh}>
            刷新
          </button>
        </div>
      )}
      {isInSubApp && <TopNav subApps={subApps} />}
      <main className={isInSubApp ? "app-main-subapp" : "app-main-home"}>
        <Routes>
          <Route
            path="/"
            element={<Home subApps={subApps} onRemoveSubApp={removeSubApp} />}
          />
          <Route
            path="/settings"
            element={<Settings onAddSubApp={addSubApp} />}
          />
          <Route
            path="/apps/:appId/*"
            element={<SubAppHost subApps={subApps} />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
