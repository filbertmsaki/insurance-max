export const TIRAMIS_DEFAULTS = {
  requestTimeoutMs: 60_000,
  logPayloads: false,
  requestLogEnabled: true,
  requestLogRedactXml: true,
  requestLogRedactedXmlTags: '',
  callbackDeadLetterRawXmlMode: 'redacted' as const,
  callbackDiagnosticsRetentionEnabled: true,
  callbackDiagnosticsRetentionDays: 180,
  portalNotifyEnabled: true,
  portalWebhookTimeoutMs: 5_000,
  portalWebhookMaxAttempts: 8,
  portalWebhookRetryDelaysSeconds: [5, 15, 30, 60, 300, 900, 1800, 3600],
  portalOutboxBatchSize: 20,
  portalOutboxIntervalMs: 10_000,
  retryEnabled: true,
  retryBatchSize: 20,
  retryMaxAttempts: 5,
  retryBaseDelaySeconds: 60,
  retryMaxDelaySeconds: 900,
  finalCallbackTimeoutMinutes: 30,
  legacyRawApiKeysEnabled: true,
  internalCallbackTestsEnabled: false,
};

export function isProductionEnvironment(): boolean {
  return (
    process.env.APP_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

export function optionalStringEnv(
  name: string,
  fallback: string,
  activeEnvironment: NodeJS.ProcessEnv = process.env,
): string {
  const value = activeEnvironment[name];
  return value?.trim() ? value.trim() : fallback;
}

export function optionalBooleanEnv(
  name: string,
  fallback: boolean,
  activeEnvironment: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = activeEnvironment[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (['true', '1', 'yes', 'on'].includes(value)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be a boolean value`);
}

export function optionalNumberEnv(
  name: string,
  fallback: number,
  activeEnvironment: NodeJS.ProcessEnv = process.env,
): number {
  const value = activeEnvironment[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
}

export function optionalNumberListEnv(
  name: string,
  fallback: number[],
  activeEnvironment: NodeJS.ProcessEnv = process.env,
): number[] {
  const value = activeEnvironment[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));

  if (!parsed.length || parsed.length !== value.split(',').length) {
    throw new Error(`${name} must be a comma-separated list of numbers`);
  }

  return parsed;
}
