export interface TraceContext {
  requestId: string | null;
  correlationId: string | null;
  sourceService: string | null;
}

export function buildTraceContext(input: Partial<TraceContext>): TraceContext {
  return {
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? input.requestId ?? null,
    sourceService: input.sourceService ?? null,
  };
}
