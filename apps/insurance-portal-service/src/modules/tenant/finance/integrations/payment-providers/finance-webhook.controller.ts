import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Public } from '@insurance-max/portal-shared';
import type { Request } from 'express';

import { ProviderWebhookService } from './provider-webhook.service';

@Controller('tenant/finance/providers')
export class FinanceWebhookController {
  constructor(
    private readonly providerWebhookService: ProviderWebhookService,
  ) {}

  @Post(':providerCode/webhook')
  @Public()
  providerWebhook(
    @Param('providerCode') providerCode: string,
    @Headers() headers: Record<string, string>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    if (!Buffer.isBuffer(request.rawBody)) {
      throw new BadRequestException(
        'Raw payment-provider webhook body is required.',
      );
    }
    return this.providerWebhookService.process(
      providerCode,
      headers,
      request.rawBody,
    );
  }
}
