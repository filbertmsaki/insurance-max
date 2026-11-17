import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { FinanceSourceAttestationsService } from './source-attestations.service';

/** Source authentication is the scoped Ed25519 signature over the exact raw body. */
@Controller('internal/company-source-attestations')
export class FinanceSourceAttestationsController {
  constructor(
    private readonly attestations: FinanceSourceAttestationsService,
  ) {}
  @Post()
  @HttpCode(200)
  async ingest(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-finance-source-signature') signature: string,
  ) {
    const result = await this.attestations.ingest(
      request.rawBody as Buffer,
      signature,
    );
    return {
      ...result,
      receipt: await this.attestations.signedReceipt(result.id),
    };
  }
  @Post('archive-expired')
  @HttpCode(200)
  async archiveExpired(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-finance-source-signature') signature: string,
  ) {
    const result = await this.attestations.ingest(
      request.rawBody as Buffer,
      signature,
      true,
    );
    return {
      ...result,
      receipt: await this.attestations.signedReceipt(result.id),
    };
  }
}
