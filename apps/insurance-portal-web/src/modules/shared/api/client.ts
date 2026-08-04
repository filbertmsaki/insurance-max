import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';

import {
  isApiSuccessResponse,
  type ApiResponseMeta,
} from '@insurance-max/contracts';

import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  API_WITH_CREDENTIALS,
} from '@/modules/shared/config';

import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import type { LoginResponse } from '@/types';

import { isPaginatedPayload, normalizePaginatedResponse } from './pagination';

import { serializeQueryParameters } from './query-serializer';

import { parseApiError } from '@/lib/api-error';

declare module 'axios' {
  export interface AxiosRequestConfig {
    suppressErrorToast?: boolean;
    skipAuthRefresh?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    suppressErrorToast?: boolean;
    skipAuthRefresh?: boolean;
  }

  export interface AxiosResponse {
    apiMeta?: ApiResponseMeta;
  }
}

function createRequestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return [Date.now().toString(36), Math.random().toString(36).slice(2)].join(
    '-',
  );
}

function unwrapResponse(response: AxiosResponse): AxiosResponse {
  const payload = response.data;

  if (isApiSuccessResponse(payload)) {
    response.apiMeta = payload.meta;
    response.data = payload.data;
  }

  if (isPaginatedPayload(response.data)) {
    response.data = normalizePaginatedResponse(response.data);
  }

  return response;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,

  withCredentials: API_WITH_CREDENTIALS,

  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },

  paramsSerializer: {
    serialize: serializeQueryParameters,
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const requestId =
    config.headers['X-Request-Id']?.toString() || createRequestId();

  config.headers['X-Request-Id'] = requestId;

  config.headers['X-Correlation-Id'] =
    config.headers['X-Correlation-Id']?.toString() || requestId;

  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;

let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  for (const operation of failedQueue) {
    if (error) {
      operation.reject(error);
    } else if (token) {
      operation.resolve(token);
    }
  }

  failedQueue = [];
}

function isPublicAuthRequest(url?: string): boolean {
  if (!url) {
    return false;
  }

  const publicAuthPaths = [
    '/auth/register',
    '/auth/login',
    '/auth/phone-login/send-otp',
    '/auth/phone-login',
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/passwordless/request',
    '/auth/passwordless/complete',
    '/auth/2fa/complete-login',
    '/auth/refresh',
    '/auth/verify-email',
    '/auth/resend-verification',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  return publicAuthPaths.some((path) => url.includes(path));
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const requestId = createRequestId();

  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,

    {
      refresh_token: refreshToken,
    },

    {
      timeout: API_TIMEOUT_MS,

      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Request-Id': requestId,
        'X-Correlation-Id': requestId,
      },
    },
  );

  const normalized = unwrapResponse(response);

  const session = normalized.data as LoginResponse;

  useAuthStore.getState().setSession(session);

  return session.access_token;
}

apiClient.interceptors.response.use(
  (response) => unwrapResponse(response),

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';

    const shouldRefresh =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isPublicAuthRequest(requestUrl);

    if (shouldRefresh) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.assign('/login');

        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          };

          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const accessToken = await refreshAccessToken(refreshToken);

        processQueue(null, accessToken);

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${accessToken}`,
        };

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        useAuthStore.getState().logout();
        window.location.assign('/login');

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const parsedError = parseApiError(error);

    if (error.response?.status !== 401 && !originalRequest.suppressErrorToast) {
      toast.error(parsedError.message);
    }

    return Promise.reject(error);
  },
);
