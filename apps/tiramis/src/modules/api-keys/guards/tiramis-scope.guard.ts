import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';
import {
  PUBLIC_SERVICE_ENDPOINT,
  SERVICE_SCOPES,
} from '@insurance-max/shared-kernel';

/**
 * Enforces @ServiceScopes() against the scopes bound to the validated API
 * key (TiramisApiKeyGuard populates request.servicePrincipal.scopes before
 * this guard runs). Previously @ServiceScopes() was metadata read only by
 * the audit interceptor - no guard actually denied an under-scoped caller.
 *
 * TIRAMIS_SCOPE_ENFORCEMENT_MODE gates the rollout: 'audit' (default) logs
 * violations without blocking, so existing API keys can be backfilled with
 * the right scopes before 'enforce' is switched on and starts denying.
 */
@Injectable()
export class TiramisScopeGuard implements CanActivate {
  private readonly logger = new Logger(TiramisScopeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_SERVICE_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SERVICE_SCOPES,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { servicePrincipal?: ServicePrincipal }>();

    const grantedScopes = request.servicePrincipal?.scopes ?? [];
    const missingScopes = requiredScopes.filter(
      (scope) => !grantedScopes.includes(scope),
    );

    if (missingScopes.length === 0) {
      return true;
    }

    const enforcementMode = this.configService.get<string>(
      'TIRAMIS_SCOPE_ENFORCEMENT_MODE',
      'audit',
    );

    if (enforcementMode !== 'enforce') {
      this.logger.warn(
        `Scope violation (audit mode, not blocked): serviceId=${
          request.servicePrincipal?.serviceId ?? 'unknown'
        } path=${request.method} ${
          request.originalUrl ?? request.url
        } missingScopes=${missingScopes.join(',')}`,
      );
      return true;
    }

    throw new ForbiddenException({
      code: 'TIRAMIS_SCOPE_NOT_PERMITTED',
      message: 'The API key does not have permission for this operation.',
    });
  }
}
