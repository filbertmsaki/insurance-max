export const OBSERVABILITY_REDACTED_VALUE = '[REDACTED]';

const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
  'refresh_token',
  'access_token',
  'private_key',
]);

export function redactSensitiveFields<T>(
  value: T,
  sensitiveKeys = DEFAULT_SENSITIVE_KEYS,
): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, sensitiveKeys)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (sensitiveKeys.has(key.toLowerCase())) {
        return [key, OBSERVABILITY_REDACTED_VALUE];
      }

      return [key, redactSensitiveFields(item, sensitiveKeys)];
    }),
  ) as T;
}

export function buildStructuredLog(
  event: string,
  payload: Record<string, unknown>,
) {
  return JSON.stringify({
    event,
    ...redactSensitiveFields(payload),
  });
}
