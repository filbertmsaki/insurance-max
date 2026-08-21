import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  HttpCode,
  Post,
} from '@nestjs/common';

import { environment } from '@insurance-max/shared-config';
import { RawResponse, ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisCallbackService } from '../services/tiramis-callback.service';

@Controller('internal/tiramis/callback-tests')
@ServiceScopes('tiramis:callback:test')
export class TiramisInternalCallbackTestController {
  constructor(
    private readonly tiramisCallbackService: TiramisCallbackService,
  ) {}

  @Post('live')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @RawResponse()
  async handleLiveCallbackTest(@Body() rawXml: string): Promise<string> {
    if (environment.TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED !== 'true') {
      throw new ForbiddenException('Internal callback testing is disabled');
    }

    const acknowledgement =
      await this.tiramisCallbackService.handleInternalLiveTestCallback(rawXml);

    return acknowledgement.acknowledgementXml;
  }
}
