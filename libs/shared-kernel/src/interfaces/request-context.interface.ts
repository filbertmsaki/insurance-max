import type { Request } from 'express';
import type { ServicePrincipal } from '@insurance-max/contracts';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  sourceService?: string;
  startedAt: number;

  servicePrincipal?: ServicePrincipal;
}

export interface RequestWithContext extends Request {
  requestId?: string;
  correlationId?: string;
  sourceService?: string;
}
