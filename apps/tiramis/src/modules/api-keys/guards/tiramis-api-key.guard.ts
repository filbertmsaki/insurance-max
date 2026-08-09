import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { ServicePrincipal } from '@insurance-max/contracts';
import {
  PUBLIC_SERVICE_ENDPOINT,
  RequestContextService,
} from '@insurance-max/shared-kernel';

import { TiramisApiKeyService } from '../services/tiramis-api-key.service';

@Injectable()
export class TiramisApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(TiramisApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: TiramisApiKeyService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const principal = await this.apiKeyService.validate(
      this.resolveApiKey(request),
      [],
      {
        ipAddress: request.ip,
        method: request.method,
        path: request.originalUrl ?? request.url,
        requestId: this.requestContextService.getRequestId(),
      },
    );

    const servicePrincipal = this.buildServicePrincipal(request, principal);
    (
      request as Request & { servicePrincipal: ServicePrincipal }
    ).servicePrincipal = servicePrincipal;
    this.requestContextService.setServicePrincipal(servicePrincipal);

    return true;
  }

  private resolveApiKey(request: Request): string | undefined {
    const headerValue = request.headers['x-api-key'];
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    return headerValue;
  }

  private buildServicePrincipal(
    request: Request,
    apiKey: {
      serviceName: string;
      scopes: string[];
    },
  ): ServicePrincipal {
    const context = this.resolveServiceContext(request);

    return {
      serviceId: apiKey.serviceName,
      scopes: apiKey.scopes,
      tenant: context.tenant,
      actor: context.actor,
      product: context.product,
      pricing: context.pricing,
      insuredData: context.insuredData,
      quotationGate: context.quotationGate,
      finance: context.finance,
    };
  }

  private resolveServiceContext(request: Request): Partial<ServicePrincipal> {
    const header = request.headers['x-service-context'];
    if (!header || Array.isArray(header)) {
      return {};
    }

    try {
      return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as
        | Partial<ServicePrincipal>
        | Record<string, never>;
    } catch (error) {
      this.logger.warn(
        `Ignoring malformed X-Service-Context header: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {};
    }
  }
}
