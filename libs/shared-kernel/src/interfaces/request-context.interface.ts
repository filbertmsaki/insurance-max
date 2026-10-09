import type { Request } from 'express';
import type { ServicePrincipal } from '@insurance-max/contracts';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  startedAt: number;
  /** Inbound `Authorization: Bearer` token, forwarded on admin-only downstream calls. */
  bearerToken?: string;

  servicePrincipal?: ServicePrincipal;
}

export interface RequestWithContext extends Request {
  requestId?: string;
  correlationId?: string;
}
