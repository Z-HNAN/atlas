import { ENV } from "./env";

const appId = ENV.VITE_APP_ID;

export const APP_CONFIG = {
  appId,
  appName: "Atlas 虚拟旅行收藏地图",
  schemaVersion: 1,
  storageKey: `app:${appId}:data`,
  cloudSyncEnabled: ENV.VITE_ENABLE_CLOUD_SYNC === "true",
  deepSeekModel: ENV.VITE_DEEPSEEK_MODEL,
  deepSeekBaseUrl: ENV.VITE_DEEPSEEK_BASE_URL.replace(/\/+$/u, ""),
  nominatimBaseUrl: ENV.VITE_NOMINATIM_BASE_URL.replace(/\/+$/u, ""),
} as const;
