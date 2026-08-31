/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPS_SCRIPT_URL?: string;
  readonly VITE_APP_BASE?: string;
  readonly VITE_USE_MOCK_PUBLIC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
