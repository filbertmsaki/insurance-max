import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap, type Observable } from 'rxjs';
import {
  buildStructuredLog,
  observabilityMetrics,
} from '@insurance-max/observability';

import type { RequestWithContext } from '../interfaces';
import { RequestContextService } from '../context';

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('InsuranceMaxHTTP');

  constructor(private readonly contextService: RequestContextService) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (executionContext.getType() !== 'http') {
      return next.handle();
    }

    const request = executionContext
      .switchToHttp()
      .getRequest<Request & RequestWithContext>();

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = executionContext
            .switchToHttp()
            .getResponse<{ statusCode: number }>();

          this.writeLog({
            request,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          });
        },

        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;

          this.writeLog({
            request,
            statusCode,
            durationMs: Date.now() - startedAt,
            error,
          });
        },
      }),
    );
  }

  private writeLog(params: {
    request: Request & RequestWithContext;
    statusCode: number;
    durationMs: number;
    error?: unknown;
  }): void {
    const requestId =
      params.request.requestId ||
      this.contextService.getRequestId() ||
      'unknown';

    const route = params.request.originalUrl || params.request.url;
    const slowThresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 2000);

    observabilityMetrics.recordHttpRequest(
      params.request.method,
      route,
      params.statusCode,
      params.durationMs,
      slowThresholdMs,
    );

    const logPayload = buildStructuredLog('http.request.completed', {
      requestId,
      correlationId:
        params.request.correlationId ||
        this.contextService.getCorrelationId() ||
        requestId,
      method: params.request.method,
      path: route,
      statusCode: params.statusCode,
      durationMs: params.durationMs,
      sourceService: params.request.sourceService || null,
    });

    if (params.statusCode >= 500) {
      this.logger.error(
        logPayload,
        params.error instanceof Error ? params.error.stack : undefined,
      );

      return;
    }

    if (params.statusCode >= 400) {
      this.logger.warn(logPayload);
      return;
    }

    this.logger.log(logPayload);
  }
}
