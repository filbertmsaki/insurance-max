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

  VITE_BACKEND_URL: z.string().trim().url().default('http://localhost:9090'),

  VITE_API_BASE_URL: optionalUrl,

  VITE_API_PREFIX: z.string().trim().min(1).default('api/v1'),

  VITE_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(60000),

  VITE_API_WITH_CREDENTIALS: z.enum(['true', 'false']).default('false'),

  VITE_WEBSOCKET_URL: optionalUrl,
});

const result = environmentSchema.safeParse(import.meta.env);

if (!result.success) {
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid frontend environment configuration: ${issues}`);
}

const environment = result.data;

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

export const PORTAL_BACKEND_URL = normalizeBaseUrl(
  environment.VITE_BACKEND_URL,
);

const apiPrefix = normalizePath(environment.VITE_API_PREFIX);

export const API_BASE_URL = environment.VITE_API_BASE_URL
  ? normalizeBaseUrl(environment.VITE_API_BASE_URL)
  : `${PORTAL_BACKEND_URL}/${apiPrefix}`;

export const API_TIMEOUT_MS = environment.VITE_API_TIMEOUT_MS;

export const API_WITH_CREDENTIALS =
  environment.VITE_API_WITH_CREDENTIALS === 'true';

export const AUTH_API_URL = `${API_BASE_URL}/auth`;

export const FILE_UPLOAD_API_URL = `${API_BASE_URL}/uploads`;

export const WEBSOCKET_URL = environment.VITE_WEBSOCKET_URL || '';
