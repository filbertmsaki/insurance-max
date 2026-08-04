import { z } from 'zod';

const optionalUrl = z
  .union([z.string().trim().url(), z.literal('')])
  .optional();

const environmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Insurance Portal'),

  VITE_APP_ENV: z
    .enum(['local', 'development', 'test', 'uat', 'staging', 'production'])
    .default('development'),

  VITE_APP_PORT: z.coerce.number().int().min(1).max(65535).default(9092),

  VITE_APP_URL: z.string().trim().url().default('http://localhost:9092'),

  VITE_FRONTEND_URL: z.string().trim().url().default('http://localhost:9092'),

  VITE_BACKEND_URL: z.string().trim().url().default('http://localhost:9090'),

  VITE_PORTAL_BACKEND_URL: optionalUrl,

  VITE_API_BASE_URL: optionalUrl,

  VITE_API_PREFIX: z.string().trim().min(1).default('api/v1'),

  VITE_TIRAMIS_URL: optionalUrl,

  VITE_WEBSOCKET_URL: z.string().trim().optional(),
});

const parsed = environmentSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid frontend environment configuration: ${issues}`);
}

const environment = parsed.data;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function normalizePath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export const APP_NAME = environment.VITE_APP_NAME;
export const APP_ENV = environment.VITE_APP_ENV;
export const APP_PORT = environment.VITE_APP_PORT;

export const APP_URL = normalizeBaseUrl(environment.VITE_APP_URL);

export const FRONTEND_URL = normalizeBaseUrl(environment.VITE_FRONTEND_URL);

export const PORTAL_BACKEND_URL = normalizeBaseUrl(
  environment.VITE_BACKEND_URL ||
    environment.VITE_PORTAL_BACKEND_URL ||
    'http://localhost:9090',
);

const apiPrefix = normalizePath(environment.VITE_API_PREFIX);

export const API_BASE_URL = environment.VITE_API_BASE_URL
  ? normalizeBaseUrl(environment.VITE_API_BASE_URL)
  : `${PORTAL_BACKEND_URL}/${apiPrefix}`;

export const API_BASE_URL_DEV = API_BASE_URL;
export const API_BASE_URL_PROD = API_BASE_URL;

export const AUTH_API_URL = `${API_BASE_URL}/auth`;

export const FILE_UPLOAD_API_URL = `${API_BASE_URL}/uploads`;

export const TIRAMIS_API_URL = environment.VITE_TIRAMIS_URL
  ? normalizeBaseUrl(environment.VITE_TIRAMIS_URL)
  : '';

export const WEBSOCKET_URL = environment.VITE_WEBSOCKET_URL || '';
