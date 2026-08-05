import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Post,
  Logger,
} from '@nestjs/common';

import {
  PublicServiceEndpoint,
  RawResponse,
} from '@insurance-max/shared-kernel';

import { TiramisCallbackService } from '../services/tiramis-callback.service';

@Controller('tiramis/callbacks')
@PublicServiceEndpoint()
export class TiramisCallbackController {
  private readonly logger = new Logger(TiramisCallbackController.name);

  constructor(
    private readonly tiramisCallbackService: TiramisCallbackService,
  ) {}

  @Post(':environment')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleCallback(
    @Param('environment') environment: string,
    @Body() rawXml: string,
  ): Promise<string> {
    this.logger.debug(
      `Received callback for env=${environment}, bodyType=${typeof rawXml}, bodyLength=${
        typeof rawXml === 'string' ? rawXml.length : 0
      }`,
    );
    if (typeof rawXml === 'string') {
      this.logger.debug(`Callback body preview: ${rawXml.slice(0, 200)}`);
    }

    const acknowledgement = await this.tiramisCallbackService.handleCallback({
      environment,
      rawXml,
    });

    return acknowledgement.acknowledgementXml;
  }
}
