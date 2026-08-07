import { Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { Request as ExpressRequest } from 'express';

import { Permissions } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared';

import { RetentionService } from './retention.service';

@ApiTags('Retention')
@ApiBearerAuth('access-token')
@Controller({ path: 'retention', version: '1' })
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get('policies')
  @Permissions('retention:read')
  listPolicies(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.retentionService.listPolicies(req.user.companyId ?? null);
  }

  @Get('legal-holds')
  @Permissions('legal-holds:read')
  listLegalHolds(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.retentionService.listLegalHolds(req.user.companyId ?? null);
  }

  @Post('dry-run')
  @Permissions('retention:dry-run')
  dryRun(@Req() req: ExpressRequest & { user: AuthenticatedUser }) {
    return this.retentionService.dryRun(req.user.companyId ?? null);
  }
}
