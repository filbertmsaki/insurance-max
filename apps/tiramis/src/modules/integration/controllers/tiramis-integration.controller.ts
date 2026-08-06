import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { type TiramisSubmissionEnvelope } from '@insurance-max/contracts';
import { ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisTenantContextGuard } from '../../../common/guards/tiramis-tenant-context.guard';
import { TiramisIntegrationService } from '../services/tiramis-integration.service';

@Controller('internal/tiramis/integration')
@ServiceScopes('tiramis:submit')
@UseGuards(TiramisTenantContextGuard)
export class TiramisIntegrationController {
  constructor(
    private readonly tiramisIntegrationService: TiramisIntegrationService,
  ) {}

  @Post('submissions')
  acceptSubmission(@Body() envelope: TiramisSubmissionEnvelope) {
    return this.tiramisIntegrationService.acceptSubmission(envelope);
  }
}
