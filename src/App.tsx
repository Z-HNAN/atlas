import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useApps } from "./hooks/useApps";
import { applyPwaUpdate } from "./lib/pwa";

const getPortalHomeUrl = () => {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(base, window.location.href).toString();
};

const normalizeReturnUrl = (raw: string | null) => {
  const homeUrl = getPortalHomeUrl();
  const value = raw?.trim();
  if (!value) return homeUrl;

  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return homeUrl;
  }
};

const LaunchRedirect = ({
  appName,
  apps,
  returnUrl
}: {
  appName: string;
  apps: { name: string; url: string }[];
  returnUrl: string;
}) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

    const target = apps.find((app) => app.name === appName);
    if (!target) {
      setError(`未找到应用：${appName}`);
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(target.url);
    } catch {
      setError(`应用 url 格式不正确：${target.url}`);
      return;
    }

    targetUrl.searchParams.set("appName", appName);
    targetUrl.searchParams.set("returnUrl", returnUrl);
    window.location.assign(targetUrl.toString());
  }, [appName, returnUrl, apps]);

  if (error) {
    return (
      <section className="page-card">
        <h1 className="section-title">无法跳转</h1>
        <p>{error}</p>
        <div className="form-actions">
          <button className="secondary-btn" onClick={() => navigate("/")}> 
            返回首页
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card" role="status" aria-live="polite">
      <h1 className="section-title">正在跳转</h1>
      <p>即将打开：{appName}</p>
    </section>
  );
};

const AppContent = () => {
  const { apps, addApp, removeApp } = useApps();
  const location = useLocation();
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const appName = searchParams.get("appName")?.trim();
  const returnUrl = normalizeReturnUrl(searchParams.get("returnUrl"));

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
      <main className="app-main-home">
        <Routes>
          <Route
            path="/"
            element={
              appName ? (
                <LaunchRedirect
                  appName={appName}
                  apps={apps}
                  returnUrl={returnUrl}
                />
              ) : (
                <Home apps={apps} onRemoveApp={removeApp} />
              )
            }
          />
          <Route
            path="/settings"
            element={<Settings onAddApp={addApp} />}
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
