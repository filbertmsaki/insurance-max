import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';

import { HTTP_HEADERS } from '../constants';
import type { RequestWithContext } from '../interfaces';
import { RequestContextService } from '../context';

const VALID_REQUEST_ID = /^[A-Za-z0-9._:/-]{1,128}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: RequestContextService) {}

  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = this.readIdentifier(
      request.headers[HTTP_HEADERS.REQUEST_ID],
    );

    const correlationId = this.readIdentifier(
      request.headers[HTTP_HEADERS.CORRELATION_ID],
      requestId,
    );

    request.requestId = requestId;
    request.correlationId = correlationId;

    response.setHeader(HTTP_HEADERS.REQUEST_ID, requestId);
    response.setHeader(HTTP_HEADERS.CORRELATION_ID, correlationId);

    this.contextService.run(
      {
        requestId,
        correlationId,
        startedAt: Date.now(),
        bearerToken: this.readBearerToken(request.headers.authorization),
      },
      next,
    );
  }

  private readIdentifier(
    value: string | string[] | undefined,
    fallback?: string,
  ): string {
    const candidate = this.readHeader(value);

    if (candidate && VALID_REQUEST_ID.test(candidate)) {
      return candidate;
    }

    return fallback || randomUUID();
  }

  private readBearerToken(value: string | undefined): string | undefined {
    const match = value?.match(/^Bearer\s+(.+)$/i);
    return match?.[1].trim() || undefined;
  }

  private readHeader(value: string | string[] | undefined): string | undefined {
    const result = Array.isArray(value) ? value[0] : value;

    const normalized = result?.trim();

    return normalized || undefined;
  }
}
