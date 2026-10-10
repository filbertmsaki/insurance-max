import {
  ForbiddenException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Socket } from 'node:net';
import type { ServicePrincipal } from '@insurance-max/contracts';
import {
  PUBLIC_SERVICE_ENDPOINT,
  SERVICE_SCOPES,
  RequestContextService,
} from '@insurance-max/shared-kernel';
import { TiramisApiKeyService } from '../services/tiramis-api-key.service';
import { AuthenticatedTiramisContext } from '../../../common/interfaces/authenticated-tiramis-context.interface';
import { TiramisAccessAuditService } from '../../audit/services/tiramis-access-audit.service';

type TiramisPrincipal = Awaited<ReturnType<TiramisApiKeyService['validate']>>;

@Injectable()
export class TiramisApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(TiramisApiKeyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: TiramisApiKeyService,
    private readonly requestContextService: RequestContextService,
    private readonly accessAuditService: TiramisAccessAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_SERVICE_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SERVICE_SCOPES,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScopes?.length) {
      const error = new ForbiddenException(
        'TIRAMIS endpoint has no service scope configured',
      );
      await this.auditRejectedAccess(context, [], error);
      throw error;
    }
    if (context.getType() === 'rpc') {
      return this.authorizeRpc(context, requiredScopes);
    }
    if (context.getType() !== 'http') {
      const error = new ForbiddenException(
        'Unsupported TIRAMIS service transport',
      );
      await this.auditRejectedAccess(context, requiredScopes, error);
      throw error;
    }

    const request = context.switchToHttp().getRequest<Request>();
    let principal: Awaited<ReturnType<TiramisApiKeyService['validate']>>;
    try {
      principal = await this.apiKeyService.validate(
        this.resolveApiKey(request),
        requiredScopes,
        {
          ipAddress: request.ip,
          method: request.method,
          path: request.originalUrl ?? request.url,
          requestId: this.requestContextService.getRequestId(),
        },
      );
    } catch (error) {
      await this.auditRejectedAccess(context, requiredScopes, error);
      throw error;
    }
    const serviceContext = this.resolveServiceContext(request);
    let tenant: ServicePrincipal['tenant'] | undefined;
    try {
      tenant = this.resolveBoundTenant(principal, serviceContext.tenant);
    } catch (error) {
      await this.auditRejectedAccess(context, requiredScopes, error);
      throw error;
    }
    const servicePrincipal: ServicePrincipal = {
      serviceId: principal.serviceName,
      scopes: principal.scopes,
      tenant,
      actor: serviceContext.actor,
      product: serviceContext.product,
      pricing: serviceContext.pricing,
      insuredData: serviceContext.insuredData,
      quotationGate: serviceContext.quotationGate,
      finance: serviceContext.finance,
    };
    const tiramisContext: AuthenticatedTiramisContext = {
      apiKeyId: principal.id,
      serviceName: principal.serviceName,
      scopes: principal.scopes,
      companyCode: tenant?.companyCode ?? null,
      systemCode: tenant?.systemCode ?? null,
      environment: tenant?.environment ?? null,
      clientConfigurationId: tenant?.clientConfigurationId ?? null,
    };
    Object.assign(request, { servicePrincipal, tiramisContext });
    this.requestContextService.setServicePrincipal(servicePrincipal);
    return true;
  }

  private resolveApiKey(request: Request): string | undefined {
    const value = request.headers['x-api-key'];
    return Array.isArray(value) ? value[0] : value;
  }

  private async authorizeRpc(
    context: ExecutionContext,
    requiredScopes: string[],
  ): Promise<boolean> {
    const data = context.switchToRpc().getData<
      Record<string, unknown> & {
        __serviceAuth?: { apiKey?: string };
      }
    >();
    const rpcContext = context.switchToRpc().getContext();
    const socket = rpcContext?.getSocketRef?.();
    const pattern = rpcContext?.getPattern?.() ?? 'unknown';

    if (!data || typeof data !== 'object' || !data.__serviceAuth?.apiKey) {
      const error = new ForbiddenException(
        'Authenticated TIRAMIS service envelope is required',
      );
      await this.auditRejectedAccess(context, requiredScopes, error);
      throw error;
    }

    let principal: Awaited<ReturnType<TiramisApiKeyService['validate']>>;
    try {
      principal = await this.apiKeyService.validate(
        data.__serviceAuth.apiKey,
        requiredScopes,
        {
          ipAddress: socket?.remoteAddress,
          method: 'RPC',
          path: String(pattern),
          requestId: this.requestContextService.getRequestId(),
        },
      );
    } catch (error) {
      await this.auditRejectedAccess(context, requiredScopes, error);
      throw error;
    }
    delete data.__serviceAuth;

    const servicePrincipal: ServicePrincipal = {
      serviceId: principal.serviceName,
      scopes: principal.scopes,
    };
    const tiramisContext: AuthenticatedTiramisContext = {
      apiKeyId: principal.id,
      serviceName: principal.serviceName,
      scopes: principal.scopes,
      companyCode: null,
      systemCode: null,
      environment: null,
      clientConfigurationId: null,
    };
    Object.assign(data, { servicePrincipal, tiramisContext });
    this.requestContextService.setServicePrincipal(servicePrincipal);
    return true;
  }

  private resolveServiceContext(request: Request): Partial<ServicePrincipal> {
    const header = request.headers['x-service-context'];
    if (!header || Array.isArray(header)) return {};
    try {
      return JSON.parse(
        Buffer.from(header, 'base64url').toString('utf8'),
      ) as Partial<ServicePrincipal>;
    } catch (error) {
      this.logger.warn(
        `Ignoring malformed X-Service-Context header: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {};
    }
  }

  private resolveBoundTenant(
    principal: TiramisPrincipal,
    requestedTenant: ServicePrincipal['tenant'] | undefined,
  ): ServicePrincipal['tenant'] | undefined {
    const binding = {
      companyCode: principal.tenantCompanyCode,
      environment: principal.tenantEnvironment,
      clientConfigurationId: principal.clientConfigurationId,
    };
    const hasBinding = Object.values(binding).some((value) => Boolean(value));
    const hasRequestedTenant =
      requestedTenant &&
      [
        requestedTenant.companyCode,
        requestedTenant.environment,
        requestedTenant.clientConfigurationId,
      ].some((value) => Boolean(value));

    if (!hasBinding && hasRequestedTenant) {
      throw new ForbiddenException(
        'API key is not bound to a TIRAMIS company configuration',
      );
    }

    this.assertTenantMatch(
      'client configuration',
      binding.clientConfigurationId,
      requestedTenant?.clientConfigurationId,
    );
    this.assertTenantMatch(
      'company',
      binding.companyCode,
      requestedTenant?.companyCode,
    );
    this.assertTenantMatch(
      'environment',
      binding.environment,
      requestedTenant?.environment,
    );

    if (!hasBinding) {
      return requestedTenant;
    }

    return {
      ...(requestedTenant ?? {}),
      ...(binding.companyCode ? { companyCode: binding.companyCode } : {}),
      ...(binding.environment ? { environment: binding.environment } : {}),
      ...(binding.clientConfigurationId
        ? { clientConfigurationId: binding.clientConfigurationId }
        : {}),
    } as ServicePrincipal['tenant'];
  }

  private assertTenantMatch(
    label: string,
    bound: string | null | undefined,
    requested: string | null | undefined,
  ) {
    if (!bound || !requested || bound === requested) {
      return;
    }
    throw new ForbiddenException(
      `API key is not authorized for the requested TIRAMIS ${label}`,
    );
  }

  private async auditRejectedAccess(
    context: ExecutionContext,
    requiredScopes: string[],
    error: unknown,
  ) {
    const statusCode =
      typeof (error as { getStatus?: unknown })?.getStatus === 'function'
        ? (error as { getStatus: () => number }).getStatus()
        : 403;
    const denialReason =
      error instanceof Error ? error.constructor.name : 'AuthorizationError';

    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<Request>();
      await this.accessAuditService.record({
        requestId: this.requestContextService.getRequestId(),
        correlationId: request.headers['x-correlation-id'] as string,
        serviceScopes: requiredScopes,
        method: request.method,
        path: `${request.baseUrl}${request.route?.path ?? request.path ?? request.url}`,
        statusCode,
        allowed: false,
        denialReason,
      });
      return;
    }

    if (context.getType() === 'rpc') {
      const rpcContext = context.switchToRpc().getContext();
      await this.accessAuditService.record({
        requestId: this.requestContextService.getRequestId(),
        serviceScopes: requiredScopes,
        method: 'RPC',
        path: String(rpcContext?.getPattern?.() ?? 'unknown'),
        statusCode,
        allowed: false,
        denialReason,
      });
    }
  }
}
