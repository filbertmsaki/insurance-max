import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { PlatformScoped } from '@insurance-max/portal-shared';
import { CurrentUser } from '@insurance-max/portal-shared/decorators/current-user.decorator';
import { Permissions } from '@insurance-max/portal-shared/decorators/permissions.decorator';
import { Roles } from '@insurance-max/portal-shared/decorators/roles.decorator';
import type { AuthenticatedUser } from '@insurance-max/portal-shared/interfaces/authenticated-user.interface';

import { PlatformTiramisIntegrationService } from '../services/platform-tiramis-integration.service';

const READ = 'platform:tiramis-integration:read';
const MANAGE = 'platform:tiramis-integration:manage';
const COMPANY_ACCESS = 'platform:tiramis-integration:company-access';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(100) clientCode?: string;
  @IsOptional() @IsString() @MaxLength(500) clientKey?: string;
  @IsOptional() @IsString() @MaxLength(50) systemCode?: string;
  @IsOptional() @IsString() @MaxLength(150) systemName?: string;
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) callbackUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) clientCertificatePassword?: string;
  @IsOptional() @IsString() @MaxLength(500) publicCertificatePassword?: string;
  @IsOptional() @IsString() @MaxLength(100) signatureAlgorithm?: string;
  @IsOptional() @IsBoolean() allowExpiredCertificates?: boolean;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portalNotificationEvents?: string[];
}

class UploadCertificateDto {
  @IsIn(['clientPrivate', 'tiraPublic'])
  kind!: 'clientPrivate' | 'tiraPublic';

  @IsString()
  @IsNotEmpty()
  contentBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  password?: string;
}

class GenerateServiceKeyDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIP(undefined, { each: true })
  allowedIps!: string[];
  @IsOptional() @IsIn(['uat', 'production']) environment?: 'uat' | 'production';
}

class IntegrationSettingsDto {
  @IsOptional()
  @IsArray()
  @IsIn(['submit', 'read_status', 'receive_notifications'], { each: true })
  integrationPermissions?: string[];
}

class UpdateConnectionDto {
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string;
  /** @deprecated Accepted for older clients; the Portal generates its callback URL. */
  @IsOptional() @IsString() @MaxLength(500) portalWebhookUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) webhookSourceIp?: string;
}

class LinkCompanyDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  insurerCompanyCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  insurerCompanyName?: string;
}

class RevokeCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

/**
 * Platform → TIRAMIS Integration. The platform owner configures the TIRA
 * integration once, for every company; companies configure nothing.
 */
@ApiTags('Platform TIRAMIS integration')
@ApiBearerAuth()
@PlatformScoped()
@Controller({ path: 'platform/tiramis-integration', version: '1' })
export class PlatformTiramisIntegrationController {
  constructor(private readonly service: PlatformTiramisIntegrationService) {}

  @Get()
  @Roles('OWNER')
  @Permissions(READ)
  @ApiOperation({
    summary: 'Integration overview: active profile and companies',
  })
  overview() {
    return this.service.getOverview();
  }

  @Put('profile')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({
    summary: 'Update the active TIRA identity and credentials',
  })
  updateProfile(@Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(dto);
  }

  @Post('profile/certificates')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({
    summary:
      'Upload a private or public certificate for the active environment',
  })
  uploadCertificate(@Body() dto: UploadCertificateDto) {
    return this.service.uploadCertificate(dto);
  }

  @Post('profile/validate')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({
    summary: 'Validate the identity, credentials and certificates',
  })
  validateProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.service.validateProfile(user.id);
  }

  @Post('profile/service-api-key')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({
    summary: 'Generate or rotate the platform TIRAMIS service key',
  })
  generateServiceApiKey(
    @Body() dto: GenerateServiceKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.generateServiceApiKey(
      dto.allowedIps,
      user.id,
      dto.environment,
    );
  }

  @Post('profile/webhook-api-key')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({ summary: 'Rotate the platform webhook key TIRAMIS uses' })
  syncWebhookApiKey(@CurrentUser() user: AuthenticatedUser) {
    return this.service.syncWebhookApiKey(user.id);
  }

  @Put('connection/:environment')
  @Roles('OWNER')
  @Permissions(MANAGE)
  updateConnection(
    @Param('environment') environment: string,
    @Body() dto: UpdateConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['uat', 'production'].includes(environment))
      throw new BadRequestException('Unsupported TIRAMIS environment.');
    return this.service.updateConnection(
      environment as 'uat' | 'production',
      dto,
      user.id,
    );
  }

  @Post('connection/:environment/test')
  @Roles('OWNER')
  @Permissions(MANAGE)
  testConnection(
    @Param('environment') environment: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['uat', 'production'].includes(environment))
      throw new BadRequestException('Unsupported TIRAMIS environment.');
    return this.service.testConnection(
      environment as 'uat' | 'production',
      user.id,
    );
  }

  @Post('connection/:environment/detect-ips')
  @Roles('OWNER')
  @Permissions(MANAGE)
  detectConnectionIps(
    @Param('environment') environment: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['uat', 'production'].includes(environment))
      throw new BadRequestException('Unsupported TIRAMIS environment.');
    return this.service.detectConnectionIps(
      environment as 'uat' | 'production',
      user.id,
    );
  }

  @Post('connection/:environment/activate')
  @Roles('OWNER')
  @Permissions(MANAGE)
  activateConnection(
    @Param('environment') environment: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!['uat', 'production'].includes(environment))
      throw new BadRequestException('Unsupported TIRAMIS environment.');
    return this.service.activateConnection(
      environment as 'uat' | 'production',
      user.id,
    );
  }

  @Put('settings')
  @Roles('OWNER')
  @Permissions(MANAGE)
  @ApiOperation({ summary: 'Update platform integration permissions' })
  updateSettings(
    @Body() dto: IntegrationSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateIntegrationSettings(dto, user.id);
  }

  @Get('companies')
  @Roles('OWNER')
  @Permissions(READ)
  @ApiOperation({ summary: 'Insurers and their TIRAMIS link status' })
  listCompanies() {
    return this.service.listCompanies();
  }

  @Put('companies/:companyId/link')
  @Roles('OWNER')
  @Permissions(COMPANY_ACCESS)
  @ApiOperation({ summary: 'Link a registered company to TIRAMIS' })
  linkCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: LinkCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.linkCompany(companyId, dto, user.id);
  }

  @Post('companies/:companyId/activate')
  @Roles('OWNER')
  @Permissions(COMPANY_ACCESS)
  @ApiOperation({ summary: "Grant the company's TIRAMIS integration access" })
  activateCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.activateCompany(companyId, user.id);
  }

  @Post('companies/:companyId/revoke')
  @Roles('OWNER')
  @Permissions(COMPANY_ACCESS)
  @ApiOperation({ summary: "Revoke the company's TIRAMIS integration access" })
  revokeCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: RevokeCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.revokeCompany(companyId, dto.reason, user.id);
  }

  @Post('companies/:companyId/restore')
  @Roles('OWNER')
  @Permissions(COMPANY_ACCESS)
  @ApiOperation({ summary: "Restore the company's TIRAMIS integration access" })
  restoreCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.restoreCompany(companyId, user.id);
  }
}
