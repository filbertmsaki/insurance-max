import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Put,
} from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { TenantScoped } from '@insurance-max/portal-shared';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { CompanyTiramisConfigurationService } from '../services/company-tiramis-configuration.service';
import { UpsertCompanyTiramisConfigurationDto } from '../dto/upsert-company-tiramis-configuration.dto';

class ActivateCompanyTiramisEnvironmentDto {
  @IsOptional()
  @IsBoolean()
  confirm_live_activation?: boolean;

  @IsOptional()
  @IsBoolean()
  force_activation?: boolean;
}

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
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
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
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
  ) {
    return this.companyTiramisConfigurationService.validate(
      user.companyId!,
      environment,
    );
  }

  @Post(':environment/activate')
  @TenantScoped()
  @Permissions('company-tiramis-config:update')
  @ApiOperation({
    summary:
      "Validate and activate the current company's TIRA environment configuration",
  })
  activateMyTiramisEnvironment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Body() dto: ActivateCompanyTiramisEnvironmentDto,
  ) {
    return this.companyTiramisConfigurationService.activate(
      user.companyId!,
      environment,
      user.id,
      {
        confirmLive: dto.confirm_live_activation,
        forceActivation: dto.force_activation,
      },
    );
  }

  @Post(':environment/api-key/generate')
  @TenantScoped()
  @Permissions('company-tiramis-config:update')
  @ApiOperation({
    summary: "Generate or rotate the current company's TIRAMIS service API key",
  })
  generateMyTiramisServiceApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
  ) {
    return this.companyTiramisConfigurationService.generateServiceApiKey(
      user.companyId!,
      environment,
      user.id,
    );
  }
}
