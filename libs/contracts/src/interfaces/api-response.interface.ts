export const API_CONTRACT_VERSION = '1.0' as const;

export const REQUEST_ID_HEADER = 'x-request-id' as const;
export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;
export const SOURCE_SERVICE_HEADER = 'x-source-service' as const;
export const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key' as const;

export interface ApiResponseMeta {
  requestId: string;
  correlationId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  contractVersion: typeof API_CONTRACT_VERSION;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

export interface ApiFieldError {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  errors?: ApiFieldError[];
  details?: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  meta: ApiResponseMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
