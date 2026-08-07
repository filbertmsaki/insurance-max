import type { ServiceHealthResponse } from '@insurance-max/contracts';

export function sanitizeHealthResponse(
  response: ServiceHealthResponse,
  includeDetails: boolean,
): ServiceHealthResponse {
  if (includeDetails || !response.checks) {
    return response;
  }

  return {
    ...response,
    checks: Object.fromEntries(
      Object.entries(response.checks).map(([key, value]) => [
        key,
        {
          status: value.status,
          latencyMs: value.latencyMs,
          message: value.message,
        },
      ]),
    ),
  };
}
