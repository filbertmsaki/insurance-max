import { Body, Controller, Logger, Param, Post, Put } from '@nestjs/common';
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
  private readonly logger = new Logger(
    TiramisConfigurationValidationController.name,
  );

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

    if (
      dto.allowExpiredCertificates === true &&
      security.certificates?.tiraPublic?.isExpired
    ) {
      this.logger.warn(
        `TIRAMIS certificate expiry validation bypassed for company ${configuration.companyCode}. Certificate expired at ${security.certificates.tiraPublic.validTo}. Environment: ${configuration.environment}.`,
      );
    }

    return {
      valid: security.ok,
      message: this.buildValidationMessage(
        security,
        dto.allowExpiredCertificates === true,
      ),
      configurationId: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      baseUrl: configuration.baseUrl,
      apiKey: {
        status: security.clientKeyMasked ? 'ACTIVE' : 'MISSING',
        masked: security.clientKeyMasked,
      },
      callback: {
        ok: Boolean(configuration.callbackBaseUrl),
        configuredUrl: configuration.callbackBaseUrl,
        expectedPath: null,
        errors: [],
        warnings: [],
      },
      certificates: security.certificates,
      warnings: security.warnings,
      errors: security.errors,
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

  private buildValidationMessage(
    security: {
      ok: boolean;
      errors: string[];
      warnings: string[];
      certificates: {
        tiraPublic: {
          isExpired?: boolean;
          validTo?: string;
        } | null;
      };
    },
    allowExpiredCertificates: boolean,
  ) {
    if (!security.ok) {
      return security.errors.join('; ');
    }

    if (
      allowExpiredCertificates &&
      security.certificates.tiraPublic?.isExpired &&
      security.certificates.tiraPublic.validTo
    ) {
      return `TIRAMIS organization configuration is valid. The TIRA public certificate expired on ${security.certificates.tiraPublic.validTo}, but certificate expiry validation is explicitly allowed for this configuration.`;
    }

    if (security.warnings.length > 0) {
      return `TIRAMIS organization configuration is valid with warnings: ${security.warnings.join('; ')}`;
    }

    return 'TIRAMIS organization configuration is valid.';
  }
}
