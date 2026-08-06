import { Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { Public } from '@insurance-max/portal-shared';
import type { Request } from 'express';

import { ProviderWebhookService } from './services/provider-webhook.service';

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
    return this.providerWebhookService.process(
      providerCode,
      headers,
      request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
    );
  }
}
