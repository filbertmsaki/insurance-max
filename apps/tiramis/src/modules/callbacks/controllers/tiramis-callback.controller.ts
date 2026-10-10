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
    return this.handleCallback(
      this.tiramisConfigService.resolveRuntimeEnvironment(),
      rawXml,
    );
  }

  @Post(':environment')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleCallback(
    @Param('environment') environment: string,
    @Body() rawXml: string,
  ): Promise<string> {
    const normalizedEnvironment = this.normalizeEnvironment(environment);
    const activeEnvironment =
      this.tiramisConfigService.resolveRuntimeEnvironment();
    if (normalizedEnvironment !== activeEnvironment) {
      throw new BadRequestException(
        `This server is configured for TIRA_ENV=${activeEnvironment}; ${normalizedEnvironment} callbacks are not accepted here.`,
      );
    }

    this.logger.debug(
      `Received callback for env=${normalizedEnvironment}, bodyType=${typeof rawXml}, bodyLength=${
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

  private normalizeEnvironment(environment: string): 'uat' | 'production' {
    const value = environment.trim().toLowerCase();
    if (value === 'live' || value === 'production') return 'production';
    if (value === 'test' || value === 'local' || value === 'uat') return 'uat';
    throw new BadRequestException(
      `Unsupported TIRA callback environment: ${environment}`,
    );
  }
}
