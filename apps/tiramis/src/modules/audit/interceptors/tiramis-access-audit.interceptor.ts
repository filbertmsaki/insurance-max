import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { catchError, tap, throwError } from 'rxjs';

import type { ServicePrincipal } from '@insurance-max/contracts';

import { SERVICE_SCOPES } from '@insurance-max/shared-kernel';
import { TiramisAccessAuditEntity } from '../entities/tiramis-access-audit.entity';

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
    @InjectRepository(TiramisAccessAuditEntity)
    private readonly repository: Repository<TiramisAccessAuditEntity>,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<
      Request & { servicePrincipal?: ServicePrincipal }
    >();
    const response = context.switchToHttp().getResponse<Response>();

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(SERVICE_SCOPES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const record = (allowed: boolean, denialReason: string | null) => {
      const principal = request.servicePrincipal;

      void this.repository
        .save(
          this.repository.create({
            requestId:
              (request.headers['x-request-id'] as string | undefined) ??
              null,
            correlationId:
              (request.headers['x-correlation-id'] as string | undefined) ??
              null,
            callingService:
              (request.headers['x-source-service'] as string | undefined) ??
              principal?.serviceId ??
              'unknown',
            actorUserId: principal?.actor?.userId ?? null,
            tenantCompanyId: principal?.tenant?.companyId ?? null,
            serviceScopes: requiredScopes.length
              ? requiredScopes
              : (principal?.scopes ?? null),
            method: request.method,
            path: request.originalUrl || request.url,
            statusCode: response.statusCode,
            allowed,
            denialReason,
          }),
        )
        .catch(() => {
          // Auditing must never break the request lifecycle.
        });
    };

    return next.handle().pipe(
      tap(() => record(true, null)),
      catchError((error: unknown) => {
        const denialReason =
          error instanceof Error ? error.message : 'Request failed';

        record(false, denialReason);

        return throwError(() => error);
      }),
    );
  }
}
