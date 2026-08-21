import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import {
  API_CONTRACT_VERSION,
  type ApiErrorResponse,
  type ApiFieldError,
} from '@insurance-max/contracts';

import type { RequestWithContext } from '../interfaces';
import { RequestContextService } from '../context';

interface HttpErrorBody {
  statusCode?: number;
  code?: string;
  error?:
    | string
    | {
        code?: string;
        message?: string;
      };
  message?: string | string[];
  errors?: unknown[];
  validation_errors?: unknown[];
  details?: unknown;
  [key: string]: unknown;
}

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly contextService: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();

    const request = http.getRequest<Request & RequestWithContext>();

    const response = http.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = this.getExceptionBody(exception);

    const messages = this.extractMessages(body, exception);

    const fieldErrors = this.extractFieldErrors(body, messages);

    const requestId =
      request.requestId || this.contextService.getRequestId() || 'unknown';

    const correlationId =
      request.correlationId ||
      this.contextService.getCorrelationId() ||
      requestId;

    const environment =
      this.configService.get<string>('app.env') || 'development';

    const isInternalError = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
    const includeDebugError = isInternalError && this.isDebugErrorsEnabled();

    const errorResponse: ApiErrorResponse = {
      success: false,

      error: {
        code: this.resolveErrorCode(body, statusCode),

        message: isInternalError
          ? includeDebugError
            ? messages[0]
            : 'An internal server error occurred.'
          : messages[0],

        ...(fieldErrors.length > 0 ? { errors: fieldErrors } : {}),

        ...(!isInternalError ||
        environment !== 'production' ||
        includeDebugError
          ? {
              details: includeDebugError
                ? this.extractDebugDetails(exception, body, messages)
                : this.extractDetails(body) || null,
            }
          : {}),
      },

      meta: {
        requestId,
        correlationId,
        timestamp: new Date().toISOString(),
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode,
        contractVersion: API_CONTRACT_VERSION,
      },
    };

    response.status(statusCode).json(errorResponse);

    const logMessage = JSON.stringify({
      event: 'http.request.failed',
      requestId,
      correlationId,
      method: request.method,
      path: request.originalUrl || request.url,
      statusCode,
      errorCode: errorResponse.error.code,
      message: messages[0],
    });

    if (isInternalError) {
      this.logger.error(
        logMessage,
        exception instanceof Error ? exception.stack : undefined,
      );

      return;
    }

    this.logger.warn(logMessage);
  }

  private getExceptionBody(exception: unknown): HttpErrorBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        message: exceptionResponse,
      };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      return exceptionResponse as HttpErrorBody;
    }

    return {};
  }

  private extractMessages(body: HttpErrorBody, exception: unknown): string[] {
    const candidates: unknown[] = [];

    if (Array.isArray(body.message)) {
      candidates.push(...body.message);
    } else {
      candidates.push(body.message);
    }

    if (typeof body.error === 'object' && body.error !== null) {
      candidates.push(body.error.message);
    }

    if (Array.isArray(body.validation_errors)) {
      candidates.push(...body.validation_errors);
    }

    const messages = candidates
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .map((value) => value.trim());

    if (messages.length > 0) {
      return [...new Set(messages)];
    }

    if (exception instanceof HttpException) {
      return [exception.message];
    }

    if (exception instanceof Error && exception.message.trim()) {
      return [exception.message.trim()];
    }

    return ['Internal server error'];
  }

  private extractFieldErrors(
    body: HttpErrorBody,
    messages: string[],
  ): ApiFieldError[] {
    const explicitErrors = Array.isArray(body.errors) ? body.errors : [];

    const normalized = explicitErrors
      .map((value) => {
        if (typeof value === 'string') {
          return {
            message: value,
          };
        }

        if (
          value &&
          typeof value === 'object' &&
          typeof (value as Record<string, unknown>).message === 'string'
        ) {
          const record = value as Record<string, unknown>;

          return {
            field: typeof record.field === 'string' ? record.field : undefined,

            code: typeof record.code === 'string' ? record.code : undefined,

            message: record.message as string,
          };
        }

        return null;
      })
      .filter((value): value is ApiFieldError => value !== null);

    if (normalized.length > 0) {
      return normalized;
    }

    if (Array.isArray(body.message) || Array.isArray(body.validation_errors)) {
      return messages.map((message) => ({
        message,
      }));
    }

    return [];
  }

  private resolveErrorCode(body: HttpErrorBody, statusCode: number): string {
    if (typeof body.code === 'string' && body.code.trim()) {
      return body.code.trim();
    }

    if (
      typeof body.error === 'object' &&
      body.error !== null &&
      typeof body.error.code === 'string'
    ) {
      return body.error.code;
    }

    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_');
    }

    const statusName = HttpStatus[statusCode] || 'HTTP_ERROR';

    return String(statusName)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
  }

  private extractDetails(body: HttpErrorBody): Record<string, unknown> | null {
    if (
      body.details &&
      typeof body.details === 'object' &&
      !Array.isArray(body.details)
    ) {
      return body.details as Record<string, unknown>;
    }

    const ignoredKeys = new Set([
      'statusCode',
      'code',
      'message',
      'error',
      'errors',
      'validation_errors',
    ]);

    const details = Object.fromEntries(
      Object.entries(body).filter(([key]) => !ignoredKeys.has(key)),
    );

    return Object.keys(details).length > 0 ? details : null;
  }

  private isDebugErrorsEnabled(): boolean {
    return (
      String(this.configService.get('API_DEBUG_ERRORS_ENABLED')) === 'true'
    );
  }

  private extractDebugDetails(
    exception: unknown,
    body: HttpErrorBody,
    messages: string[],
  ): Record<string, unknown> {
    return {
      ...(this.extractDetails(body) ?? {}),
      exception: exception instanceof Error ? exception.name : 'UnknownError',
      message: messages[0],
    };
  }
}
