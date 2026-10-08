import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  PUBLIC_SERVICE_ENDPOINT,
  SERVICE_SCOPES,
} from '@insurance-max/shared-kernel';
import type { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { catchError, concatMap, defer, from, map, throwError } from 'rxjs';

import type { ServicePrincipal } from '@insurance-max/contracts';

import { TiramisAccessAuditService } from '../services/tiramis-access-audit.service';

/**
 * Records every TIRAMIS service-to-service access attempt.
 *
 * Never logs Authorization headers, service JWTs, raw API keys, or TIRA
 * client secrets - only the calling service, tenant, actor, scopes,
 * request metadata and the allow/deny outcome.
 */
@Injectable()
export class TiramisAccessAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: TiramisAccessAuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const contextType = context.getType();
    if (contextType !== 'http' && contextType !== 'rpc') {
      return next.handle();
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_SERVICE_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return next.handle();

    const isHttp = contextType === 'http';
    const request = isHttp
      ? context
          .switchToHttp()
          .getRequest<Request & { servicePrincipal?: ServicePrincipal }>()
      : null;
    const response = isHttp
      ? context.switchToHttp().getResponse<Response>()
      : null;
    const rpcData = isHttp
      ? null
      : context.switchToRpc().getData<{
          servicePrincipal?: ServicePrincipal;
        }>();
    const rpcContext = isHttp ? null : context.switchToRpc().getContext();

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(SERVICE_SCOPES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const principal = isHttp
      ? request?.servicePrincipal
      : rpcData?.servicePrincipal;
    const auditMetadata = {
      requestId: isHttp
        ? (request?.headers['x-request-id'] as string | undefined)
        : undefined,
      correlationId: isHttp
        ? (request?.headers['x-correlation-id'] as string | undefined)
        : undefined,
      callingService: principal?.serviceId,
      actorUserId: principal?.actor?.userId,
      tenantCompanyId: principal?.tenant?.companyId,
      serviceScopes: principal?.scopes ?? requiredScopes,
      method: isHttp ? (request?.method ?? 'HTTP') : 'RPC',
      // Exclude query strings because they can contain credentials or PII.
      path: isHttp
        ? `${request?.baseUrl ?? ''}${request?.route?.path ?? request?.path ?? ''}`
        : String(rpcContext?.getPattern?.() ?? 'unknown'),
    };

    return defer(() => from(this.auditService.begin(auditMetadata))).pipe(
      concatMap((auditId) =>
        next.handle().pipe(
          concatMap((value) =>
            from(
              this.auditService.complete(auditId, {
                statusCode: isHttp ? (response?.statusCode ?? 200) : 200,
                allowed: true,
                denialReason: null,
              }),
            ).pipe(map(() => value)),
          ),
          catchError((error: unknown) => {
            const statusCode =
              typeof (error as { getStatus?: unknown })?.getStatus ===
              'function'
                ? (error as { getStatus: () => number }).getStatus()
                : 500;
            const denialReason =
              error instanceof Error ? error.constructor.name : 'RequestError';
            return from(
              this.auditService.complete(auditId, {
                statusCode,
                // Authorization succeeded; the operation failed after access was granted.
                allowed: true,
                denialReason,
              }),
            ).pipe(concatMap(() => throwError(() => error)));
          }),
        ),
      ),
    );
  }
}
