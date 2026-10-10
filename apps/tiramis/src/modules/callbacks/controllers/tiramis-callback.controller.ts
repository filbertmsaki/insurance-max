import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Post,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import {
  PublicServiceEndpoint,
  RawResponse,
} from '@insurance-max/shared-kernel';

import { TiramisCallbackService } from '../services/tiramis-callback.service';
import { TiramisConfigService } from '../../config/services/tiramis-config.service';

@Controller('tiramis/callbacks')
@PublicServiceEndpoint()
export class TiramisCallbackController {
  private readonly logger = new Logger(TiramisCallbackController.name);

  constructor(
    private readonly tiramisCallbackService: TiramisCallbackService,
    private readonly tiramisConfigService: TiramisConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleActiveCallback(@Body() rawXml: string): Promise<string> {
    return this.processCallback(
      this.tiramisConfigService.resolveRuntimeEnvironment(),
      rawXml,
      null,
    );
  }

  @Post(':callbackRoute')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleCallback(
    @Param('callbackRoute') callbackRoute: string,
    @Body() rawXml: string,
  ): Promise<string> {
    this.assertSupportedCallbackRoute(callbackRoute);

    return this.processCallback(
      this.tiramisConfigService.resolveRuntimeEnvironment(),
      rawXml,
      callbackRoute,
    );
  }

  private async processCallback(
    normalizedEnvironment: 'uat' | 'production',
    rawXml: string,
    callbackRoute: string | null,
  ): Promise<string> {
    const activeEnvironment =
      this.tiramisConfigService.resolveRuntimeEnvironment();
    if (normalizedEnvironment !== activeEnvironment) {
      throw new BadRequestException(
        `This server is configured for TIRA_ENV=${activeEnvironment}; ${normalizedEnvironment} callbacks are not accepted here.`,
      );
    }

    this.logger.debug(
      `Received callback for env=${normalizedEnvironment}, route=${callbackRoute ?? 'default'}, bodyType=${typeof rawXml}, bodyLength=${
        typeof rawXml === 'string' ? rawXml.length : 0
      }, bodySha256=${
        typeof rawXml === 'string'
          ? createHash('sha256').update(rawXml, 'utf8').digest('hex')
          : 'n/a'
      }`,
    );

    const acknowledgement = await this.tiramisCallbackService.handleCallback({
      environment: normalizedEnvironment,
      rawXml,
    });

    return acknowledgement.acknowledgementXml;
  }

  private assertSupportedCallbackRoute(callbackRoute: string): void {
    const value = callbackRoute.trim().toLowerCase();
    if (['motor', 'non-motor', 'fleet'].includes(value)) return;
    throw new BadRequestException(
      `Unsupported TIRA callback route: ${callbackRoute}`,
    );
  }
}
