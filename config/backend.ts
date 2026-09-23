export const BACKEND_URLS = {
  development: 'https://king-prawn-app-clone-r7mhu.ondigitalocean.app',
  production: 'https://king-prawn-app-clone-r7mhu.ondigitalocean.app',
} as const;

export type BackendEnvironment = keyof typeof BACKEND_URLS;

const BACKEND_ENVIRONMENT_OVERRIDE: BackendEnvironment | null = null;

export const BACKEND_ENVIRONMENT: BackendEnvironment =
  BACKEND_ENVIRONMENT_OVERRIDE ?? (__DEV__ ? 'development' : 'production');

export const SERVER_URL = BACKEND_URLS[BACKEND_ENVIRONMENT];
