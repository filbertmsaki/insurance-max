import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { ServiceTokenPayload } from '@insurance-max/contracts';

import {
  PUBLIC_SERVICE_ENDPOINT,
  SERVICE_SCOPES,
} from './service-auth.constants';
import { ServiceTokenService } from './service-token.service';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly requestContextService: RequestContextService,
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

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers['authorization'];

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing service authentication token');
    }

    const token = authorization.slice('Bearer '.length).trim();

    let payload: ServiceTokenPayload;
    try {
      payload = this.serviceTokenService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid service authentication token');
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SERVICE_SCOPES,
      [context.getHandler(), context.getClass()],
    );

    if (requiredScopes?.length) {
      const hasScope = requiredScopes.some((scope) =>
        payload.scopes?.includes(scope),
      );

      if (!hasScope) {
        throw new ForbiddenException('Insufficient service scope');
      }
    }

    const principal = {
      serviceId: payload.sub,
      scopes: payload.scopes,
      tenant: payload.tenant,
      actor: payload.actor,
    };

    (request as Request & { servicePrincipal: unknown }).servicePrincipal =
      principal;

    this.requestContextService.setServicePrincipal(principal);

    return true;
  }
}
