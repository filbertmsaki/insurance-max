import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

const AUTHORIZATION_CONTEXT_LIMIT = 30;
const AUTHORIZATION_CONTEXT_TTL_MS = 60_000;

/**
 * Rate-limits the authorization-context endpoint per authenticated user
 * instead of per IP, so staff behind a shared office NAT are not throttled
 * together while a single token still cannot hammer the endpoint.
 *
 * Must run after the JWT guard so `req.user` is populated.
 */
@Injectable()
export class AuthorizationContextRateLimitGuard implements CanActivate {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const tracker = request.user?.id
      ? `user:${request.user.id}`
      : `ip:${request.ip}`;

    const { isBlocked } = await this.storage.increment(
      `authorization-context:${tracker}`,
      AUTHORIZATION_CONTEXT_TTL_MS,
      AUTHORIZATION_CONTEXT_LIMIT,
      AUTHORIZATION_CONTEXT_TTL_MS,
      'authorization-context',
    );

    if (isBlocked) {
      throw new ThrottlerException();
    }

    return true;
  }
}
