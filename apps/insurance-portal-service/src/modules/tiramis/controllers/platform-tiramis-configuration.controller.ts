import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  IsIP,
} from 'class-validator';
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

class RepairCompanyTiramisSecretsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  client_key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  client_private_certificate_password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tira_public_certificate_password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portal_webhook_api_key?: string;
}

class ValidateCompanyTiramisEnvironmentDto {
  @IsOptional()
  @Transform(({ value, obj }) => value ?? obj.allowExpiredCertificates)
  @IsBoolean()
  allow_expired_certificates?: boolean;
}

class DeliveryDiagnosticsQueryDto {
  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class GenerateTiramisApiKeyDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIP(undefined, { each: true })
  allowed_ips!: string[];
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
    summary: "Generate, rotate, or recover a company's TIRAMIS service API key",
  })
  generateServiceApiKey(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: ExpressRequest,
    @Body() dto: GenerateTiramisApiKeyDto,
  ) {
    return this.companyTiramisConfigurationService.generateServiceApiKey(
      companyId,
      environment,
      user.id,
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '',
      dto.allowed_ips,
    );
  }

  @Get(':environment/delivery-diagnostics')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:read')
  @ApiOperation({
    summary: 'Inspect notification delivery and callback outcomes',
  })
  getDeliveryDiagnostics(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Query('requestId') requestId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.companyTiramisConfigurationService.getDeliveryDiagnostics(
      companyId,
      environment,
      { requestId, limit: limit ? Number(limit) : undefined },
    );
  }

  @Get(':environment/secrets/health')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:read')
  @ApiOperation({ summary: 'Check whether TIRAMIS can decrypt its secrets' })
  getSecretHealth(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
  ) {
    return this.companyTiramisConfigurationService.getSecretHealth(
      companyId,
      environment,
    );
  }

  @Post(':environment/secrets/repair')
  @Roles('OWNER')
  @Permissions('company-tiramis-config:update')
  @ApiOperation({
    summary:
      'Re-encrypt TIRAMIS secrets, replacing unreadable ones with the supplied values',
  })
  repairSecrets(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('environment', new ParseEnumPipe({ test: 'test', live: 'live' }))
    environment: 'test' | 'live',
    @Body() dto: RepairCompanyTiramisSecretsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyTiramisConfigurationService.repairSecrets(
      companyId,
      environment,
      user.id,
      {
        clientKey: dto.client_key,
        clientPrivateCertificatePassword:
          dto.client_private_certificate_password,
        tiraPublicCertificatePassword: dto.tira_public_certificate_password,
        portalWebhookApiKey: dto.portal_webhook_api_key,
      },
    );
  }
}
