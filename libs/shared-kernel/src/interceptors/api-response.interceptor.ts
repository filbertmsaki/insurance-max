import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';

import {
  API_CONTRACT_VERSION,
  type ApiSuccessResponse,
  isApiSuccessResponse,
} from '@insurance-max/contracts';

import { SKIP_API_ENVELOPE } from '../constants';
import type { RequestWithContext } from '../interfaces';
import { RequestContextService } from '../context';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessResponse<T>
> {
  constructor(
    private readonly reflector: Reflector,
    private readonly contextService: RequestContextService,
  ) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessResponse<T>> {
    if (executionContext.getType() !== 'http') {
      return next.handle();
    }

    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_API_ENVELOPE,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (skipEnvelope) {
      return next.handle();
    }

    const request = executionContext
      .switchToHttp()
      .getRequest<Request & RequestWithContext>();

    const response = executionContext.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (
          data instanceof StreamableFile ||
          Buffer.isBuffer(data) ||
          response.statusCode === 204 ||
          isApiSuccessResponse(data)
        ) {
          return data;
        }

        const requestId =
          request.requestId || this.contextService.getRequestId() || 'unknown';

        const correlationId =
          request.correlationId ||
          this.contextService.getCorrelationId() ||
          requestId;

        return {
          success: true,
          data,
          meta: {
            requestId,
            correlationId,
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.originalUrl || request.url,
            statusCode: response.statusCode,
            contractVersion: API_CONTRACT_VERSION,
          },
        };
      }),
    );
  }
}
