import type { SubApp } from "../types";

const STORAGE_KEY = "garfish-subapps";

export const loadSubApps = (): SubApp[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SubApp[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.name && item?.url);
  } catch {
    return [];
  }
};

export const saveSubApps = (apps: SubApp[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
};
