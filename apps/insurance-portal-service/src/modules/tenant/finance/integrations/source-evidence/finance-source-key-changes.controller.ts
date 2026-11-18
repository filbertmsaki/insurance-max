import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Public } from '@insurance-max/portal-shared';
import type { Request } from 'express';
import { FinanceSourceKeyChangesService } from './finance-source-key-changes.service';

/**
 * Provisioning of source signing keys. Authentication is the pinned Ed25519
 * administrator signature over the exact raw body, not a portal session.
 * Formerly POST /internal/source-key-changes on the standalone Finance Service.
 */
@Controller('internal/finance/source-key-changes')
export class FinanceSourceKeyChangesController {
  constructor(private readonly changes: FinanceSourceKeyChangesService) {}

  @Post()
  @Public()
  @HttpCode(200)
  apply(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-finance-key-admin-signature') signature: string,
  ) {
    return this.changes.apply(request.rawBody as Buffer, signature);
  }
}
