export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Insurance Portal';
export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development';
export const APP_PORT = import.meta.env.VITE_APP_PORT ?? '9091';
export const APP_URL = import.meta.env.VITE_APP_URL ?? 'http://localhost:9091';
export const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ?? 'http://localhost:9091';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL_DEV =
  import.meta.env.VITE_API_BASE_URL_DEV ?? API_BASE_URL;
export const API_BASE_URL_PROD =
  import.meta.env.VITE_API_BASE_URL_PROD ?? API_BASE_URL;
export const PORTAL_BACKEND_URL = import.meta.env.VITE_PORTAL_BACKEND_URL ?? '';
export const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL ?? `${API_BASE_URL}/auth`;
export const FILE_UPLOAD_API_URL =
  import.meta.env.VITE_FILE_UPLOAD_API_URL ?? `${API_BASE_URL}/uploads`;
export const TIRAMIS_API_URL = import.meta.env.VITE_TIRAMIS_API_URL ?? '';
export const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL ?? '';
