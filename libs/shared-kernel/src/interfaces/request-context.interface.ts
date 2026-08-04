import type { Request } from 'express';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  sourceService?: string;
  startedAt: number;
}

export interface RequestWithContext extends Request {
  requestId?: string;
  correlationId?: string;
  sourceService?: string;
}
