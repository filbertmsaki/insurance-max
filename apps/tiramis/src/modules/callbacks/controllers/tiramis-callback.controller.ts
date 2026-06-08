import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';

import { TiramisCallbackService } from '../services/tiramis-callback.service';

@Controller('tiramis/callbacks')
export class TiramisCallbackController {
  constructor(
    private readonly tiramisCallbackService: TiramisCallbackService,
  ) {}

  @Post(':environment')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  async handleCallback(
    @Param('environment') environment: string,
    @Body() rawXml: string,
  ): Promise<string> {
    const acknowledgement = await this.tiramisCallbackService.handleCallback({
      environment,
      rawXml,
    });

    return acknowledgement.acknowledgementXml;
  }
}
