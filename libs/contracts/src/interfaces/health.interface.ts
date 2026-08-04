export type HealthState = 'UP' | 'DEGRADED' | 'DOWN';

export interface HealthCheckResult {
  status: HealthState;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ServiceHealthResponse {
  status: HealthState;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  checks?: Record<string, HealthCheckResult>;
}
