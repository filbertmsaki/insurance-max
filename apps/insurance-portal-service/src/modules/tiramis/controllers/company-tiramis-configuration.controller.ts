import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CompanyTiramisConfigurationService } from '../services/company-tiramis-configuration.service';
import { UpsertCompanyTiramisConfigurationDto } from '../dto/upsert-company-tiramis-configuration.dto';

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

  @Put(':environment')
  @TenantScoped()
  @Permissions('company-tiramis-config:update')
  @ApiOperation({ summary: "Upsert the current company's TIRA configuration" })
  upsertMyTiramisConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('environment') environment: 'test' | 'live',
    @Body() dto: UpsertCompanyTiramisConfigurationDto,
  ) {
    return this.companyTiramisConfigurationService.upsert(
      user.companyId!,
      { ...dto, environment },
      user.id,
    );
  }

  @Post(':environment/validate')
  @TenantScoped()
  @Permissions('company-tiramis-config:validate')
  @ApiOperation({
    summary: "Validate the current company's TIRA configuration",
  })
  validateMyTiramisConfiguration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('environment') environment: 'test' | 'live',
  ) {
    return this.companyTiramisConfigurationService.validate(
      user.companyId!,
      environment,
    );
  }
}
