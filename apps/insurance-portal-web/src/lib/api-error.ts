import { AxiosError } from 'axios';

import {
  isApiErrorResponse,
  type ApiFieldError,
} from '@insurance-max/contracts';

export interface ApiErrorDetails {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  correlationId?: string;
  errors?: ApiFieldError[];
  details?: Record<string, unknown> | null;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request is invalid.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with an existing record.',
  422: 'The submitted data is invalid. Please check your input.',
  429: 'Too many requests. Please try again shortly.',
  500: 'A server error occurred. Please try again later.',
  502: 'An external service is currently unavailable.',
  503: 'The service is temporarily unavailable.',
  504: 'The service did not respond in time.',
};

function stringMessages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function parseApiError(error: unknown): ApiErrorDetails {
  if (error instanceof AxiosError && error.response) {
    const status = error.response.status;

    const data = error.response.data;

    if (isApiErrorResponse(data)) {
      return {
        status,
        code: data.error.code,
        message: data.error.message,
        requestId: data.meta.requestId,
        correlationId: data.meta.correlationId,
        errors: data.error.errors,
        details: data.error.details,
      };
    }

    const legacy =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    const legacyMessages = [
      ...stringMessages(legacy.validation_errors),

      ...stringMessages(
        (legacy.details as Record<string, unknown> | undefined)
          ?.validation_errors,
      ),

      ...stringMessages(legacy.message),
    ];

    const message =
      legacyMessages[0] ||
      STATUS_MESSAGES[status] ||
      (typeof legacy.error === 'string' ? legacy.error : error.message) ||
      'An unexpected error occurred.';

    return {
      status,

      code: typeof legacy.code === 'string' ? legacy.code : `HTTP_${status}`,

      message,

      errors:
        legacyMessages.length > 0
          ? legacyMessages.map((validationMessage) => ({
              message: validationMessage,
            }))
          : undefined,

      requestId: error.response.headers['x-request-id'] as string | undefined,

      correlationId: error.response.headers['x-correlation-id'] as
        | string
        | undefined,
    };
  }

  return {
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'Network error. Check your connection and try again.',
  };
}

export function getApiErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}

/**
 * Maps backend validation error strings to react-hook-form field errors.
 *
 * fieldMap keys are substrings to scan for in each error message;
 * values are the corresponding form field names.
 */
export function mapApiErrorsToForm<
  TFieldValues extends Record<string, unknown>,
>(
  error: unknown,
  setError: (field: any, error: { message: string }) => void,
  fieldMap: Partial<Record<string, keyof TFieldValues & string>>,
): void {
  const parsed = parseApiError(error);

  if (!parsed.errors?.length) {
    return;
  }

  for (const apiError of parsed.errors) {
    if (apiError.field && apiError.field in fieldMap) {
      const mappedField = fieldMap[apiError.field];

      if (mappedField) {
        setError(mappedField, { message: apiError.message });
      }

      continue;
    }

    const normalizedMessage = apiError.message.toLowerCase();

    for (const [keyword, field] of Object.entries(fieldMap)) {
      if (field && normalizedMessage.includes(keyword.toLowerCase())) {
        setError(field, { message: apiError.message });
        break;
      }
    }
  }
}
