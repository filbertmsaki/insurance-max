import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedTiramisContext } from '../interfaces/authenticated-tiramis-context.interface';

type RequestWithTiramisContext = Request & {
  tiramisContext?: AuthenticatedTiramisContext;
};

/**
 * Injects the trusted context TiramisApiKeyGuard resolved from the caller's
 * X-Api-Key. Throws if the guard hasn't run — every route that isn't
 * @PublicServiceEndpoint() populates this, so a missing context here means
 * the decorator was used somewhere unprotected.
 */
export const CurrentTiramisClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedTiramisContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithTiramisContext>();

    if (!request.tiramisContext) {
      throw new UnauthorizedException(
        'No authenticated TIRAMIS client context is available for this request.',
      );
    }

    return request.tiramisContext;
  },
);
