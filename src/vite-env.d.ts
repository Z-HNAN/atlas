/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID?: string;
  readonly VITE_ENABLE_CLOUD_SYNC?: "true" | "false";
  readonly VITE_SYNC_API_BASE_URL?: string;
  readonly VITE_DEEPSEEK_MODEL?: string;
  readonly VITE_DEEPSEEK_BASE_URL?: string;
  readonly VITE_NOMINATIM_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
