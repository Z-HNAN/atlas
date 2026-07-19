/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID?: string;
  readonly VITE_ENABLE_CLOUD_SYNC?: "true" | "false";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_DEEPSEEK_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
