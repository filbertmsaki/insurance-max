import { AxiosError } from 'axios';
import type { Path } from 'react-hook-form';

export interface ApiErrorDetails {
  status: number;
  message: string;
  errors?: string[];
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  422: 'The submitted data is invalid. Please check your input.',
  500: 'A server error occurred. Please try again later.',
};

export function parseApiError(error: unknown): ApiErrorDetails {
  if (error instanceof AxiosError && error.response) {
    const { status, data } = error.response;
    const rawMessage = data?.message;

    const message: string = Array.isArray(rawMessage)
      ? rawMessage[0]
      : typeof rawMessage === 'string'
        ? rawMessage
        : (STATUS_MESSAGES[status] ??
          data?.error ??
          error.message ??
          'An unexpected error occurred');

    return {
      status,
      message,
      errors: Array.isArray(rawMessage) ? rawMessage : undefined,
    };
  }
  return { status: 0, message: 'Network error — please check your connection' };
}

export function getApiErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}

/**
 * Maps backend validation error strings to react-hook-form field errors.
 *
 * fieldMap keys are substrings to scan for in each error message;
 * values are the corresponding form field names.
 *
 * Example: { email: 'email', first_name: 'first_name', phone: 'phone' }
 */
export function mapApiErrorsToForm<
  TFieldValues extends Record<string, unknown>,
>(
  error: unknown,
  setError: (field: any, error: { message: string }) => void,
  fieldMap: Partial<Record<string, keyof TFieldValues & string>>,
): void {
  const { errors } = parseApiError(error);
  if (!errors?.length) return;
  for (const msg of errors) {
    const lower = msg.toLowerCase();
    for (const [keyword, field] of Object.entries(fieldMap)) {
      if (lower.includes(keyword.toLowerCase()) && field) {
        setError(field, { message: msg });
        break;
      }
    }
  }
}
