import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CompanyTiramisConfigurationService } from '../services/company-tiramis-configuration.service';

/**
 * Read-only, zero-configuration visibility into the company's TIRAMIS
 * connection status. Linking/generating/rotating the API key and
 * activating an environment is a platform-admin action — see
 * PlatformTiramisConfigurationController — not company self-service.
 */
@ApiTags('Company TIRA configuration')
@ApiBearerAuth()
@Controller('companies/my/tiramis-configurations')
export class CompanyTiramisConfigurationController {
  constructor(
    private readonly companyTiramisConfigurationService: CompanyTiramisConfigurationService,
  ) {}

  @Get()
  @TenantScoped()
  @Permissions('company-tiramis-config:read')
  @ApiOperation({ summary: "List the current company's TIRA configurations" })
  findMyTiramisConfigurations(@CurrentUser() user: AuthenticatedUser) {
    return this.companyTiramisConfigurationService.findAll(user.companyId!);
  }
}
