export const BACKEND_URLS = {
  development: 'http://192.168.0.2:8787',
  production: 'https://king-prawn-app-clone-r7mhu.ondigitalocean.app',
} as const;

export type BackendEnvironment = keyof typeof BACKEND_URLS;

const BACKEND_ENVIRONMENT_OVERRIDE: BackendEnvironment | null = null;

export const BACKEND_ENVIRONMENT: BackendEnvironment =
  BACKEND_ENVIRONMENT_OVERRIDE ?? (__DEV__ ? 'development' : 'production');

export const SERVER_URL = BACKEND_URLS[BACKEND_ENVIRONMENT];
