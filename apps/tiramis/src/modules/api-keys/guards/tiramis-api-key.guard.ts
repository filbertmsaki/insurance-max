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
import { AuthenticatedTiramisContext } from '../../../common/interfaces/authenticated-tiramis-context.interface';

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
    const tiramisContext = this.buildAuthenticatedContext(
      principal,
      servicePrincipal,
    );

    (
      request as Request & {
        servicePrincipal: ServicePrincipal;
        tiramisContext: AuthenticatedTiramisContext;
      }
    ).servicePrincipal = servicePrincipal;
    (
      request as Request & { tiramisContext: AuthenticatedTiramisContext }
    ).tiramisContext = tiramisContext;
    this.requestContextService.setServicePrincipal(servicePrincipal);

    return true;
  }

  private buildAuthenticatedContext(
    apiKey: {
      id: string;
      serviceName: string;
      scopes: string[];
    },
    servicePrincipal: ServicePrincipal,
  ): AuthenticatedTiramisContext {
    return {
      apiKeyId: apiKey.id,
      serviceName: apiKey.serviceName,
      scopes: apiKey.scopes,
      companyCode: servicePrincipal.tenant?.companyCode ?? null,
      systemCode: servicePrincipal.tenant?.systemCode ?? null,
      environment: servicePrincipal.tenant?.environment ?? null,
      clientConfigurationId:
        servicePrincipal.tenant?.clientConfigurationId ?? null,
    };
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
      tenantCompanyCode?: string | null;
      tenantSystemCode?: string | null;
      tenantEnvironment?: string | null;
    },
  ): ServicePrincipal {
    const context = this.resolveServiceContext(request);
    const tenant = this.buildTenantContext(apiKey);

    return {
      serviceId: apiKey.serviceName,
      scopes: apiKey.scopes,
      tenant,
      actor: context.actor,
      product: context.product,
      pricing: context.pricing,
      insuredData: context.insuredData,
      quotationGate: context.quotationGate,
      finance: context.finance,
    };
  }

  /**
   * Tenant identity is authenticated routing data and must be sourced
   * exclusively from the validated API key — never from the caller-supplied,
   * unsigned X-Service-Context header. Allowing the header to override the
   * key's own tenantCompanyCode/tenantSystemCode/tenantEnvironment would let
   * an authenticated client impersonate another client's configuration.
   */
  private buildTenantContext(apiKey: {
    serviceName: string;
    tenantCompanyCode?: string | null;
    tenantSystemCode?: string | null;
    tenantEnvironment?: string | null;
    clientConfigurationId?: string | null;
  }): ServicePrincipal['tenant'] {
    const companyCode = apiKey.tenantCompanyCode;
    const systemCode = apiKey.tenantSystemCode;
    const environment = apiKey.tenantEnvironment;
    const clientConfigurationId = apiKey.clientConfigurationId;

    if (!companyCode && !systemCode && !environment && !clientConfigurationId) {
      return undefined;
    }

    return {
      companyId: companyCode ?? apiKey.serviceName,
      ...(companyCode ? { companyCode } : {}),
      ...(systemCode ? { systemCode } : {}),
      ...(environment === 'test' || environment === 'live'
        ? { environment }
        : {}),
      ...(clientConfigurationId ? { clientConfigurationId } : {}),
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
