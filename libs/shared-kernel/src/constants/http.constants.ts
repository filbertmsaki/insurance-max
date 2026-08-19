export const HTTP_HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  IDEMPOTENCY_KEY: 'x-idempotency-key',
} as const;

export const SKIP_API_ENVELOPE = 'insurance-max:skip-api-envelope';
