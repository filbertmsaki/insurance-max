import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import { PlatformScoped } from '@insurance-max/portal-shared';
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

class ValidateCompanyTiramisEnvironmentDto {
  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj.allowExpiredCertificates)
  @IsBoolean()
  allow_expired_certificates?: boolean;
}

/**
 * Platform-operator-managed TIRAMIS connection setup for a specific company.
 * Company admins get zero-touch, read-only visibility only (see
 * CompanyTiramisConfigurationController); linking/generating/rotating the
 * TIRAMIS API key and activating an environment is a platform-admin action
 * performed on behalf of the company, not company self-service.
 */
@ApiTags('Platform TIRA configuration')
@ApiBearerAuth()
@Controller('platform/companies/:companyId/tiramis-configurations')
@PlatformScoped()
export class PlatformTiramisConfigurationController {
  constructor(
    private readonly companyTiramisConfigurationService: CompanyTiramisConfigurationService,
  ) {}

  @Get()
  @Roles('OWNER')
  @Permissions('company-tiramis-config:read')
  @ApiOperation({ summary: "List a company's TIRA configurations" })
  findAll(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companyTiramisConfigurationService.findAll(companyId);
  }

  @Put(':environment')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:update')
  @ApiOperation({ summary: "Upsert a company's TIRA configuration" })
  upsert(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Body() dto: UpsertCompanyTiramisConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyTiramisConfigurationService.upsert(
      companyId,
      { ...dto, environment },
      user.id,
    );
  }

  @Post(':environment/validate')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:validate')
  @ApiOperation({ summary: "Validate a company's TIRA configuration" })
  validate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Body() dto: ValidateCompanyTiramisEnvironmentDto,
  ) {
    return this.companyTiramisConfigurationService.validate(
      companyId,
      environment,
      { allowExpiredCertificates: dto.allow_expired_certificates },
    );
  }

  @Post(':environment/activate')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:update')
  @ApiOperation({
    summary: "Validate and activate a company's TIRA environment configuration",
  })
  activate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Body() dto: ActivateCompanyTiramisEnvironmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyTiramisConfigurationService.activate(
      companyId,
      environment,
      user.id,
      {
        confirmLive: dto.confirm_live_activation,
        forceActivation: dto.force_activation,
      },
    );
  }

  @Post(':environment/api-key/generate')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:update')
  @ApiOperation({
    summary: "Generate or rotate a company's TIRAMIS service API key",
  })
  generateServiceApiKey(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyTiramisConfigurationService.generateServiceApiKey(
      companyId,
      environment,
      user.id,
    );
  }
}
