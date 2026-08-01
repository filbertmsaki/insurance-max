import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import {
  TiramisHttpRequest,
  TiramisHttpResponse,
} from '../interfaces/tiramis-http.interface';

@Injectable()
export class TiramisHttpClientService {
  private readonly logger = new Logger(TiramisHttpClientService.name);

  constructor(private readonly httpService: HttpService) {}

  async postXml(request: TiramisHttpRequest): Promise<TiramisHttpResponse> {
    try {
      this.logger.debug(
        JSON.stringify({
          event: 'tira.request.sent',
          url: request.url,
          contentType: request.headers['Content-Type'],
          clientCode: request.headers.ClientCode,
          xml: request.xml,
        }),
      );

      const response = await firstValueFrom(
        this.httpService.post(request.url, request.xml, {
          headers: request.headers,
          timeout: request.timeout || 60000,
          responseType: 'text',
          validateStatus: () => true,
        }),
      );

      const result = {
        statusCode: response.status,
        statusText: response.statusText,
        rawXml:
          typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data),
        headers: response.headers,
      };

      this.logger.debug(
        JSON.stringify({
          event: 'tira.response.received',
          statusCode: result.statusCode,
          statusText: result.statusText,
          rawXml: result.rawXml,
        }),
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `TIRAMIS HTTP request failed: ${error.message}`,
        error.stack,
      );

      throw new BadGatewayException(
        `Failed to communicate with TIRAMIS: ${error.message}`,
      );
    }
  }
}
