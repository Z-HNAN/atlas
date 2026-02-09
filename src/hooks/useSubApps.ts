import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubApp } from "../types";
import { loadSubApps, saveSubApps } from "../lib/storage";

export const useSubApps = () => {
  const [subApps, setSubApps] = useState<SubApp[]>(() => loadSubApps());

  useEffect(() => {
    saveSubApps(subApps);
  }, [subApps]);

  const addSubApp = useCallback((app: SubApp) => {
    setSubApps((prev) => [...prev, app]);
  }, []);

  const removeSubApp = useCallback((name: string) => {
    setSubApps((prev) => prev.filter((app) => app.name !== name));
  }, []);

  return useMemo(
    () => ({
      subApps,
      addSubApp,
      removeSubApp
    }),
    [subApps, addSubApp, removeSubApp]
  );
};
