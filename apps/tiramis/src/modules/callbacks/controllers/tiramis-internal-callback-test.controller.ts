import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RawResponse, ServiceScopes } from '@insurance-max/shared-kernel';

import { TIRAMIS_DEFAULTS } from '../../../config/tiramis-defaults';
import { TiramisCallbackService } from '../services/tiramis-callback.service';

@Controller('internal/tiramis/callback-tests')
@ServiceScopes('tiramis:callback:test')
export class TiramisInternalCallbackTestController {
  constructor(
    private readonly tiramisCallbackService: TiramisCallbackService,
    private readonly configService: ConfigService,
  ) {}

  @Post('live')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleLiveCallbackTest(@Body() rawXml: string): Promise<string> {
    if (
      !this.configService.get<boolean>(
        'tiramisService.internalCallbackTestsEnabled',
        TIRAMIS_DEFAULTS.internalCallbackTestsEnabled,
      )
    ) {
      throw new ForbiddenException('Internal callback testing is disabled');
    }

    const acknowledgement =
      await this.tiramisCallbackService.handleInternalLiveTestCallback(rawXml);

    return acknowledgement.acknowledgementXml;
  }
}
