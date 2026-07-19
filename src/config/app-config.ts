import { ENV } from "./env";

const appId = ENV.VITE_APP_ID;

export const APP_CONFIG = {
  appId,
  appName: "Todo Seed",
  schemaVersion: 2,
  storageKey: `app:${appId}:data`,
  cloudSyncEnabled: ENV.VITE_ENABLE_CLOUD_SYNC === "true",
  deepSeekModel: ENV.VITE_DEEPSEEK_MODEL,
} as const;
