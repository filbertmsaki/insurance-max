import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';
import { TiramisAdministratorGuard } from '../../api-keys/guards/tiramis-administrator.guard';

import { TiramisConfigService } from '../services/tiramis-config.service';
import { TiramisPortalNotificationService } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TIRAMIS_NOTIFICATION_EVENT_TYPES } from '../../portal-notifications/services/tiramis-portal-notification.service';

class ValidateOrganizationConfigurationDto {
  @IsOptional()
  @IsString()
  environment?: string;

  @IsString()
  companyCode!: string;

  /** Optional; when given it must match the platform's TIRA system code. */
  @IsOptional()
  @IsString()
  systemCode?: string;

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

class TestPortalWebhookDto {
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl!: string;
}

class NotificationPolicyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(TIRAMIS_NOTIFICATION_EVENT_TYPES, { each: true })
  @IsString({ each: true })
  eventTypes?: string[];
}

/** Company-specific settings only; the TIRA system identity is platform-wide. */
class UpsertClientConfigurationDto {
  @IsOptional()
  @IsString()
  environment?: string;

  @IsString()
  companyCode!: string;

  @IsString()
  insurerCompanyCode!: string;

  @IsOptional()
  @IsString()
  salePointCode?: string;

  @IsOptional()
  @IsString()
  tranCompanyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ResolveOrganizationConfigurationDto {
  @IsOptional()
  @IsString()
  environment?: string;

  @IsString()
  companyCode!: string;

  @IsOptional()
  @IsString()
  systemCode?: string;
}

class SystemIdentityQueryDto {
  @IsOptional()
  @IsString()
  environment?: string;
}

/** Only per-company secrets are stored; TIRA system secrets live in env. */
class RepairSecretsDto {
  @IsOptional()
  @IsString()
  portalWebhookApiKey?: string;
}

@Controller('tiramis/configurations')
@PublicServiceEndpoint()
@UseGuards(TiramisAdministratorGuard)
export class TiramisConfigurationValidationController {
  private readonly logger = new Logger(
    TiramisConfigurationValidationController.name,
  );

  constructor(
    private readonly configService: TiramisConfigService,
    private readonly portalNotificationService: TiramisPortalNotificationService,
  ) {}

  @Post('validate-organization')
  async validate(@Body() dto: ValidateOrganizationConfigurationDto) {
    const configuration = await this.configService.getActiveConfiguration({
      environment:
        dto.environment ?? this.configService.resolveRuntimeEnvironment(),
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
    });

    const security = await this.configService.validateConfigurationSecurity(
      configuration,
      { allowExpiredCertificates: dto.allowExpiredCertificates },
    );

    if (
      security.allowExpiredCertificates &&
      (security.certificates?.tiraPublic?.isExpired ||
        security.certificates?.clientPrivate?.isExpired)
    ) {
      const expiredCertificates = [
        security.certificates?.clientPrivate?.isExpired
          ? `client private certificate expired at ${security.certificates.clientPrivate.validTo}`
          : null,
        security.certificates?.tiraPublic?.isExpired
          ? `TIRA public certificate expired at ${security.certificates.tiraPublic.validTo}`
          : null,
      ]
        .filter(Boolean)
        .join('; ');
      this.logger.warn(
        `TIRAMIS certificate expiry validation bypassed for company ${configuration.companyCode}. ${expiredCertificates}. Environment: ${configuration.environment}.`,
      );
    }

    return {
      valid: security.ok,
      allowExpiredCertificates: security.allowExpiredCertificates,
      message: this.buildValidationMessage(
        security,
        security.allowExpiredCertificates,
      ),
      configurationId: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
      systemName: configuration.systemName,
      clientCode: configuration.clientCode,
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
      portalWebhook: {
        apiKeyConfigured: Boolean(configuration.portalWebhookApiKeyEncrypted),
      },
      certificates: security.certificates,
      warnings: security.warnings,
      errors: security.errors,
    };
  }

  /**
   * Looks up the configuration id without decrypting any secret, so the
   * portal can still reach the repair endpoints when secrets are unreadable.
   */
  @Post('resolve-organization')
  async resolveOrganization(@Body() dto: ResolveOrganizationConfigurationDto) {
    const configuration = await this.configService.getActiveConfiguration({
      environment:
        dto.environment ?? this.configService.resolveRuntimeEnvironment(),
      companyCode: dto.companyCode,
      systemCode: dto.systemCode,
    });

    return {
      configurationId: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      systemCode: configuration.systemCode,
    };
  }

  /** The platform-wide TIRA system identity (no secrets) for an environment. */
  @Post('system-identity')
  getSystemIdentity(@Body() dto: SystemIdentityQueryDto) {
    return this.configService.getSystemIdentity(
      dto.environment ?? this.configService.resolveRuntimeEnvironment(),
    );
  }

  @Get(':configurationId/secret-health')
  getSecretHealth(@Param('configurationId') configurationId: string) {
    return this.configService.getSecretHealth(configurationId);
  }

  @Post(':configurationId/repair-secrets')
  repairSecrets(
    @Param('configurationId') configurationId: string,
    @Body() dto: RepairSecretsDto,
  ) {
    return this.configService.repairSecrets(configurationId, dto);
  }

  @Put(':configurationId/portal-webhook-api-key')
  setPortalWebhookApiKey(
    @Param('configurationId') configurationId: string,
    @Body() dto: SetPortalWebhookApiKeyDto,
  ) {
    return this.configService.setPortalWebhookApiKey(
      configurationId,
      dto.apiKey,
    );
  }

  @Post(':configurationId/portal-webhook-test')
  testPortalWebhook(
    @Param('configurationId') configurationId: string,
    @Body() dto: TestPortalWebhookDto,
  ) {
    return this.portalNotificationService.testWebhook(
      configurationId,
      dto.webhookUrl,
    );
  }

  @Put(':configurationId/portal-notification-policy')
  setPortalNotificationPolicy(
    @Param('configurationId') configurationId: string,
    @Body() dto: NotificationPolicyDto,
  ) {
    return this.configService.setPortalNotificationPolicy(configurationId, dto);
  }

  @Put()
  async upsertClientConfiguration(@Body() dto: UpsertClientConfigurationDto) {
    const configuration =
      await this.configService.upsertClientConfiguration(dto);

    return {
      id: configuration.id,
      environment: configuration.environment,
      companyCode: configuration.companyCode,
      insurerCompanyCode: configuration.insurerCompanyCode,
      salePointCode: configuration.salePointCode,
      tranCompanyCode: configuration.tranCompanyCode,
      isActive: configuration.isActive,
      // Platform-wide system identity, returned for display only.
      systemCode: configuration.systemCode,
      clientCode: configuration.clientCode,
      baseUrl: configuration.baseUrl,
      callbackBaseUrl: configuration.callbackBaseUrl,
    };
  }

  private buildValidationMessage(
    security: {
      ok: boolean;
      errors: string[];
      warnings: string[];
      certificates: {
        clientPrivate: {
          isExpired?: boolean;
          validTo?: string;
        } | null;
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

    const expiredCertificates = [
      security.certificates.clientPrivate?.isExpired &&
      security.certificates.clientPrivate.validTo
        ? `Client private certificate expired on ${security.certificates.clientPrivate.validTo}`
        : null,
      security.certificates.tiraPublic?.isExpired &&
      security.certificates.tiraPublic.validTo
        ? `TIRA public certificate expired on ${security.certificates.tiraPublic.validTo}`
        : null,
    ].filter(Boolean);

    if (allowExpiredCertificates && expiredCertificates.length > 0) {
      return `TIRAMIS organization configuration is valid. ${expiredCertificates.join(' and ')}, but certificate expiry validation is explicitly allowed for this configuration.`;
    }

    if (security.warnings.length > 0) {
      return `TIRAMIS organization configuration is valid with warnings: ${security.warnings.join('; ')}`;
    }

    return 'TIRAMIS organization configuration is valid.';
  }
}
