import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../interfaces/api-response.interface';

export function isApiSuccessResponse<T = unknown>(
  value: unknown,
): value is ApiSuccessResponse<T> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiSuccessResponse<T>>;

  return (
    candidate.success === true &&
    'data' in candidate &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null &&
    typeof candidate.meta.requestId === 'string' &&
    typeof candidate.meta.contractVersion === 'string'
  );
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ApiErrorResponse>;

  return (
    candidate.success === false &&
    typeof candidate.error === 'object' &&
    candidate.error !== null &&
    typeof candidate.error.message === 'string' &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  );
}

export function unwrapApiResponse<T>(value: T | ApiSuccessResponse<T>): T {
  return isApiSuccessResponse<T>(value) ? value.data : value;
}
