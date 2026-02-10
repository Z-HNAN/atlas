import type { AppConfig } from "../types";

const STORAGE_KEY = "gipsy-apps";

export const loadApps = (): AppConfig[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppConfig[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.name && item?.url);
  } catch {
    return [];
  }
};

export const saveApps = (apps: AppConfig[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};
