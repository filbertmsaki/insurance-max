export function buildRetryLockId() {
  return `retry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function calculateNextRetryAt(params: {
  retryAttempts: number;
  delayMs?: number;
  baseDelaySeconds?: number;
}) {
  const delayMs =
    params.delayMs ??
    (params.baseDelaySeconds != null
      ? params.baseDelaySeconds * 1000
      : 5 * 60 * 1000);
  return new Date(Date.now() + Math.max(params.retryAttempts, 1) * delayMs);
}

export function isRetryableError(error: any) {
  const text = String(
    error?.message || error?.response?.message || error || '',
  ).toLowerCase();

  return (
    text.includes('timeout') ||
    text.includes('tempor') ||
    text.includes('retry') ||
    text.includes('unavailable') ||
    text.includes('connection')
  );
}
