import { HttpService } from '@nestjs/axios';

import {
  BadGatewayException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { firstValueFrom } from 'rxjs';

import { RequestContextService } from '@insurance-max/shared-kernel';

import {
  TiramisHttpRequest,
  TiramisHttpResponse,
} from '../interfaces/tiramis-http.interface';

@Injectable()
export class TiramisHttpClientService {
  private readonly logger = new Logger(TiramisHttpClientService.name);

  constructor(
    private readonly httpService: HttpService,

    private readonly configService: ConfigService,

    private readonly requestContextService: RequestContextService,
  ) {}

  async postXml(request: TiramisHttpRequest): Promise<TiramisHttpResponse> {
    const requestId =
      this.requestContextService.getRequestId() || 'background-job';

    const logPayloads =
      this.configService.get<boolean>('tiramisService.logPayloads') ?? false;

    try {
      this.logger.log(
        JSON.stringify({
          event: 'tira.request.sent',
          requestId,
          url: request.url,
          clientCode: request.headers.ClientCode,
          payloadBytes: Buffer.byteLength(request.xml, 'utf8'),
          ...(logPayloads ? { xml: request.xml } : {}),
        }),
      );

      const response = await firstValueFrom(
        this.httpService.post(request.url, request.xml, {
          headers: request.headers,

          timeout: request.timeout,

          responseType: 'text',

          validateStatus: () => true,
        }),
      );

      const result: TiramisHttpResponse = {
        statusCode: response.status,

        statusText: response.statusText,

        rawXml:
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data),

        headers: response.headers,
      };

      this.logger.log(
        JSON.stringify({
          event: 'tira.response.received',
          requestId,
          statusCode: result.statusCode,
          statusText: result.statusText,
          payloadBytes: Buffer.byteLength(result.rawXml, 'utf8'),
          ...(logPayloads ? { rawXml: result.rawXml } : {}),
        }),
      );

      return result;
    } catch (error: unknown) {
      const requestError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };

      if (requestError.code === 'ECONNABORTED') {
        throw new RequestTimeoutException({
          code: 'TIRA_REQUEST_TIMEOUT',

          message:
            'The external TIRA API did not respond within the configured timeout.',
        });
      }

      this.logger.error(
        JSON.stringify({
          event: 'tira.request.failed',
          requestId,
          message: requestError.message || 'Unknown error',
        }),
        requestError.stack,
      );

      throw new BadGatewayException({
        code: 'TIRA_COMMUNICATION_FAILED',

        message: 'Failed to communicate with the external TIRA API.',
      });
    }
  }
}
