import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';
import { TenantScoped } from '@insurance-max/portal-shared';

import { OrganizationContextService } from './organization-context.service';

@ApiTags('Organization context')
@ApiBearerAuth()
@TenantScoped()
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(private readonly contextService: OrganizationContextService) {}

  @Get('context')
  getContext(@CurrentUser() user: AuthenticatedUser) {
    return this.contextService.resolve(user.id, user.companyId!);
  }

  @Get('tiramis-readiness')
  async getTiramisReadiness(@CurrentUser() user: AuthenticatedUser) {
    const context = await this.contextService.resolve(user.id, user.companyId!);

    return {
      ready: context.tiramis.ready,
      missingRequirements: context.tiramis.missingRequirements,
    };
  }
}
