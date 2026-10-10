import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';
import { TiramisAdministratorGuard } from '../../api-keys/guards/tiramis-administrator.guard';
import { TIRAMIS_NOTIFICATION_EVENT_TYPES } from '../../portal-notifications/services/tiramis-portal-notification.service';
import { TiramisCertificateInspectorService } from '../../security/services/tiramis-certificate-inspector.service';
import { TiramisConfigService } from '../services/tiramis-config.service';
import {
  TIRAMIS_CERTIFICATE_FILES,
  TiramisSystemProfileService,
} from '../services/tiramis-system-profile.service';

class UpdatePlatformProfileDto {
  @IsOptional() @IsString() @MaxLength(100) clientCode?: string | null;
  /** Write-only; omit to keep the stored key. */
  @IsOptional() @IsString() @MaxLength(500) clientKey?: string | null;
  @IsOptional() @IsString() @MaxLength(50) systemCode?: string | null;
  @IsOptional() @IsString() @MaxLength(150) systemName?: string | null;
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) callbackUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(500) clientCertificatePassword?:
    | string
    | null;
  @IsOptional() @IsString() @MaxLength(500) publicCertificatePassword?:
    | string
    | null;
  @IsOptional() @IsString() @MaxLength(100) signatureAlgorithm?: string | null;
  @IsOptional() @IsBoolean() allowExpiredCertificates?: boolean | null;
  @IsOptional()
  @IsArray()
  @IsIn(TIRAMIS_NOTIFICATION_EVENT_TYPES, { each: true })
  portalNotificationEvents?: string[] | null;
}

class UploadCertificateDto {
  @IsIn(Object.keys(TIRAMIS_CERTIFICATE_FILES))
  kind!: keyof typeof TIRAMIS_CERTIFICATE_FILES;

  @IsString()
  contentBase64!: string;

  /** The certificate's password; stored encrypted with it when given. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  password?: string;
}

class PortalWebhookKeyDto {
  @IsString()
  apiKey!: string;
}

/**
 * Platform → TIRAMIS Integration: the TIRA identity, credentials, certificates
 * and notification policy for this server's active TIRA_ENV, shared by every company.
 * Platform administrators only.
 */
@Controller('tiramis/platform/profiles')
@PublicServiceEndpoint()
@UseGuards(TiramisAdministratorGuard)
export class TiramisPlatformProfileController {
  constructor(
    private readonly profiles: TiramisSystemProfileService,
    private readonly configService: TiramisConfigService,
    private readonly certificateInspector: TiramisCertificateInspectorService,
  ) {}

  @Get()
  list() {
    const active = this.profiles.getActiveEnvironment();
    return {
      environment: active,
      active: this.profiles.describe(active),
    };
  }

  @Get('active')
  getActive() {
    return this.profiles.describe(this.profiles.getActiveEnvironment());
  }

  @Put('active')
  async updateActive(
    @Body() dto: UpdatePlatformProfileDto,
    @Req() request: Request,
  ) {
    const activeEnvironment = this.profiles.getActiveEnvironment();
    await this.profiles.update(activeEnvironment, dto, this.actor(request));
    return this.profiles.describe(activeEnvironment);
  }

  @Post('active/certificates')
  async uploadActiveCertificate(
    @Body() dto: UploadCertificateDto,
    @Req() request: Request,
  ) {
    return this.storeCertificateForActive(dto, request);
  }

  @Post('active/validate')
  async validateActive() {
    return this.validateActiveProfile();
  }

  @Put('active/portal-webhook-api-key')
  async setActivePortalWebhookApiKey(
    @Body() dto: PortalWebhookKeyDto,
    @Req() request: Request,
  ) {
    const activeEnvironment = this.profiles.getActiveEnvironment();
    await this.profiles.setPortalWebhookApiKey(
      activeEnvironment,
      dto.apiKey,
      this.actor(request),
    );
    return {
      environment: activeEnvironment,
      portalWebhookApiKeyConfigured: true,
    };
  }

  @Get(':environment')
  get(@Param('environment') environment: string) {
    return this.profiles.describe(
      this.profiles.normalizeEnvironment(environment),
    );
  }

  @Put(':environment')
  async update(
    @Param('environment') environment: string,
    @Body() dto: UpdatePlatformProfileDto,
    @Req() request: Request,
  ) {
    const activeEnvironment = this.profiles.normalizeEnvironment(environment);
    await this.profiles.update(activeEnvironment, dto, this.actor(request));
    return this.profiles.describe(activeEnvironment);
  }

  @Post(':environment/certificates')
  async uploadCertificate(
    @Param('environment') environment: string,
    @Body() dto: UploadCertificateDto,
    @Req() request: Request,
  ) {
    this.profiles.describe(this.profiles.normalizeEnvironment(environment));
    return this.storeCertificateForActive(dto, request);
  }

  private async storeCertificateForActive(
    dto: UploadCertificateDto,
    request: Request,
  ) {
    const activeEnvironment = this.profiles.getActiveEnvironment();
    const effective = this.profiles.getEffective(activeEnvironment);
    const password =
      dto.password ??
      (dto.kind === 'clientPrivate'
        ? effective.clientCertificatePassword
        : effective.publicCertificatePassword);

    await this.profiles.storeCertificate({
      environment: activeEnvironment,
      kind: dto.kind,
      contentBase64: dto.contentBase64,
      validate: (temporaryPath) => {
        try {
          this.certificateInspector.inspectCertificate({
            certificatePath: temporaryPath,
            password,
          });
        } catch (error: any) {
          throw new BadRequestException(
            `The certificate could not be opened with its password: ${error?.message || error}`,
          );
        }
      },
    });

    if (dto.password !== undefined) {
      await this.profiles.update(
        activeEnvironment,
        dto.kind === 'clientPrivate'
          ? { clientCertificatePassword: dto.password }
          : { publicCertificatePassword: dto.password },
        this.actor(request),
      );
    }

    return this.profiles.describe(activeEnvironment);
  }

  /** Checks identity, credentials and both certificates for an environment. */
  @Post(':environment/validate')
  async validate(@Param('environment') environment: string) {
    this.profiles.describe(this.profiles.normalizeEnvironment(environment));
    return this.validateActiveProfile();
  }

  private async validateActiveProfile() {
    const activeEnvironment = this.profiles.getActiveEnvironment();
    let security: Awaited<
      ReturnType<TiramisConfigService['validateConfigurationSecurity']>
    >;
    try {
      security = await this.configService.validateConfigurationSecurity(
        this.configService.getSystemRuntimeConfiguration(activeEnvironment),
      );
    } catch (error: any) {
      const message = error?.message || 'Validation failed';
      await this.profiles.recordValidation(activeEnvironment, {
        valid: false,
        message,
      });
      return { valid: false, message, errors: [message], warnings: [] };
    }

    const message = security.ok
      ? security.warnings.length
        ? `Valid with warnings: ${security.warnings.join('; ')}`
        : 'Valid.'
      : security.errors.join('; ');
    await this.profiles.recordValidation(activeEnvironment, {
      valid: security.ok,
      message,
    });
    return {
      valid: security.ok,
      message,
      errors: security.errors,
      warnings: security.warnings,
      certificates: security.certificates,
    };
  }

  /** Key TIRAMIS sends to the portal webhook for this environment. */
  @Put(':environment/portal-webhook-api-key')
  async setPortalWebhookApiKey(
    @Param('environment') environment: string,
    @Body() dto: PortalWebhookKeyDto,
    @Req() request: Request,
  ) {
    const activeEnvironment = this.profiles.normalizeEnvironment(environment);
    await this.profiles.setPortalWebhookApiKey(
      activeEnvironment,
      dto.apiKey,
      this.actor(request),
    );
    return {
      environment: activeEnvironment,
      portalWebhookApiKeyConfigured: true,
    };
  }

  private actor(request: Request) {
    const admin = (request as any).tiramisAdministrator as
      | { id?: string; email?: string }
      | undefined;
    return admin?.email || admin?.id || 'platform-admin';
  }
}
