import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { SubApp } from "../types";
import { toSubAppId } from "../utils/subApp";

type SubAppHostProps = {
  subApps: SubApp[];
};

const SubAppHost = ({ subApps }: SubAppHostProps) => {
  const { appId } = useParams();
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeApp = useMemo(() => {
    if (!appId) return undefined;
    return subApps.find((app) => toSubAppId(app.name) === appId);
  }, [appId, subApps]);

  useEffect(() => {
    if (!activeApp) {
      console.warn(`Sub-app not found: ${appId}`);
    }
  }, [activeApp, appId]);

  useEffect(() => {
    setLoadError(null);
  }, [appId]);

  useEffect(() => {
    const handleLoadError = (event: Event) => {
      const customEvent = event as CustomEvent<{
        name: string;
        message?: string;
      }>;
      if (customEvent.detail?.name === appId) {
        setLoadError(customEvent.detail.message ?? "子应用加载失败。");
      }
    };

    window.addEventListener("subapp:load-error", handleLoadError);
    return () => {
      window.removeEventListener("subapp:load-error", handleLoadError);
    };
  }, [appId]);

  return (
    <>
      {!activeApp ? (
        <div className="empty-state">
          未找到对应子应用，请检查配置或返回首页。
        </div>
      ) : loadError ? (
        <section className="page-card">
          <h1 className="section-title">子应用加载失败</h1>
          <p>{loadError}</p>
        </section>
      ) : (
        <div id="subapp-root">
          {/* Garfish will mount the sub-app here */}
        </div>
      )}
    </>
  );
};

export default SubAppHost;
