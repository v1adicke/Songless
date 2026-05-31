/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base origin of the backend API in production (split Vercel deploys),
   * e.g. "https://songless-api.vercel.app". Leave unset in local dev so
   * requests stay same-origin and Vite proxies `/api/*` to the backend.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
