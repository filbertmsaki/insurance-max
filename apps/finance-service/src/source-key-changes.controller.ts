import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { FinanceSourceKeyChangesService } from './source-key-changes.service';

/** Exact raw bytes must carry a signature from the pinned provisioning key. */
@Controller('internal/source-key-changes')
export class FinanceSourceKeyChangesController {
  constructor(private readonly changes: FinanceSourceKeyChangesService) {}
  @Post()
  @HttpCode(200)
  apply(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-finance-key-admin-signature') signature: string,
  ) {
    return this.changes.apply(request.rawBody as Buffer, signature);
  }
}
