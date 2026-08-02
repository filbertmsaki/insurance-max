import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type TiraSubmissionResult = {
  request?: Record<string, any> | null;
  response?: Record<string, any> | null;
  transaction?: Record<string, any> | null;
  attempt?: Record<string, any> | null;
  tiraResponse?: Record<string, any> | null;
  signatureVerified?: boolean | null;
};

@Injectable()
export class TiramisResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map((value: unknown) => this.formatSubmissionResponse(value)));
  }

  private formatSubmissionResponse(value: unknown): unknown {
    if (!this.isSubmissionResult(value)) {
      return value;
    }

    const result = value;
    const request = result.request || {};
    const response = result.response || {};
    const attempt = result.attempt || {};
    const tiraResponse = result.tiraResponse || {};
    const xml =
      response.rawResponseXml ||
      tiraResponse.rawXml ||
      attempt.responseXml ||
      null;
    const statusCode =
      response.responseStatusCode ||
      attempt.responseStatusCode ||
      this.readXmlValue(xml, 'ResponseStatusCode');
    const responseId =
      response.responseId ||
      attempt.responseId ||
      this.readXmlValue(xml, 'ResponseId');
    const message =
      response.responseStatusDesc ||
      attempt.responseStatusDesc ||
      this.readXmlValue(xml, 'ResponseStatusDesc');
    const currentAttempt = Number(attempt.attemptNo || 1);
    const maxAttempts = Number(attempt.maxRetries || 5);
    const isSuccessful =
      request.status === 'SUCCESS' ||
      attempt.status === 'FINAL_SUCCESS' ||
      statusCode === 'TIRA001';

    return {
      success: isSuccessful,
      service:
        result.transaction?.serviceType ||
        response.verificationType ||
        request.verificationType ||
        'TIRAMIS',
      request: {
        requestId: request.requestId || attempt.requestId || null,
        attempt: currentAttempt,
        maxAttempts,
        remainingAttempts: Math.max(maxAttempts - currentAttempt, 0),
        retryable: Boolean(attempt.isRetryable),
      },
      tira: {
        responseId: responseId || null,
        statusCode: statusCode || null,
        message: message || null,
        signatureVerified: result.signatureVerified ?? null,
        receivedAt:
          response.respondedAt || attempt.finalResponseReceivedAt || null,
      },
      xml,
    };
  }

  private isSubmissionResult(value: unknown): value is TiraSubmissionResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const result = value as TiraSubmissionResult;
    return Boolean(
      result.attempt &&
      (result.tiraResponse || result.response || result.request) &&
      (result.response?.rawResponseXml ||
        result.tiraResponse?.rawXml ||
        result.attempt.responseXml),
    );
  }

  private readXmlValue(xml: string | null, tagName: string): string | null {
    if (!xml) {
      return null;
    }

    const match = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i').exec(
      xml,
    );

    return match?.[1]?.trim() || null;
  }
}
