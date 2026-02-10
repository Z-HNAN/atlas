import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppConfig } from "../types";
import { loadApps, saveApps } from "../lib/storage";

export const useApps = () => {
  const [apps, setApps] = useState<AppConfig[]>(() => loadApps());

  useEffect(() => {
    saveApps(apps);
  }, [apps]);

  const addApp = useCallback((app: AppConfig) => {
    setApps((prev) => [...prev, app]);
  }, []);

  const removeApp = useCallback((name: string) => {
    setApps((prev) => prev.filter((app) => app.name !== name));
  }, []);

  return useMemo(
    () => ({
      apps,
      addApp,
      removeApp
    }),
    [apps, addApp, removeApp]
  );
};
