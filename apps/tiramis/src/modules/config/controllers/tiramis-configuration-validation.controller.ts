import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { ServiceScopes } from '@insurance-max/shared-kernel';

import { TiramisConfigService } from '../services/tiramis-config.service';

class ValidateOrganizationConfigurationDto {
  @IsIn(['test', 'live'])
  environment!: 'test' | 'live';

  @IsString()
  companyCode!: string;

  @IsString()
  systemCode!: string;

  @IsOptional()
  @IsString()
  insurerCompanyCode?: string;

  @IsOptional()
  @IsBoolean()
  allowExpiredCertificates?: boolean;
}

class SetPortalWebhookApiKeyDto {
  @IsString()
  apiKey!: string;
}

class UpsertClientConfigurationDto {
  @IsIn(['test', 'live'])
  environment!: 'test' | 'live';

  @IsString()
  companyCode!: string;

  @IsString()
  systemCode!: string;

  @IsString()
  insurerCompanyCode!: string;

  @IsString()
  clientCode!: string;

  @IsOptional()
  @IsString()
  clientKey?: string;

  @IsOptional()
  @IsString()
  salePointCode?: string;

  @IsOptional()
  @IsString()
  tranCompanyCode?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  callbackBaseUrl?: string;

  @IsOptional()
  @IsString()
  signatureAlgorithm?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('tiramis/configurations')
export class TiramisConfigurationValidationController {
  constructor(private readonly configService: TiramisConfigService) {}

  @Post('validate-organization')
  @ServiceScopes('tiramis:admin')
  async validate(@Body() dto: ValidateOrganizationConfigurationDto) {
    const configuration = await this.configService.getActiveConfiguration({
      environment: dto.environment,
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
    });

    const security = await this.configService.validateConfigurationSecurity(
      configuration,
      { allowExpiredCertificates: dto.allowExpiredCertificates },
    );

    return {
      valid: security.ok,
      message: security.ok
        ? 'TIRAMIS organization configuration is valid.'
        : security.errors.join('; '),
      configurationId: configuration.id,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
    };
  }

  @Put(':configurationId/portal-webhook-api-key')
  @ServiceScopes('tiramis:admin')
  setPortalWebhookApiKey(
    @Param('configurationId') configurationId: string,
    @Body() dto: SetPortalWebhookApiKeyDto,
  ) {
    return this.configService.setPortalWebhookApiKey(
      configurationId,
      dto.apiKey,
    );
  }

  @Put()
  @ServiceScopes('tiramis:admin')
  async upsertClientConfiguration(@Body() dto: UpsertClientConfigurationDto) {
    const configuration =
      await this.configService.upsertClientConfiguration(dto);

    return {
      id: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      insurerCompanyCode: configuration.insurerCompanyCode,
      clientCode: configuration.clientCode,
      salePointCode: configuration.salePointCode,
      tranCompanyCode: configuration.tranCompanyCode,
      baseUrl: configuration.baseUrl,
      callbackBaseUrl: configuration.callbackBaseUrl,
      isActive: configuration.isActive,
    };
  }
}
