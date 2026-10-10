import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
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

const ENVIRONMENTS = { test: 'test', live: 'live' } as const;

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
 * and notification policy for each environment, shared by every company.
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
    return {
      test: this.profiles.describe('test'),
      live: this.profiles.describe('live'),
    };
  }

  @Get(':environment')
  get(
    @Param('environment', new ParseEnumPipe(ENVIRONMENTS))
    environment: 'test' | 'live',
  ) {
    return this.profiles.describe(environment);
  }

  @Put(':environment')
  async update(
    @Param('environment', new ParseEnumPipe(ENVIRONMENTS))
    environment: 'test' | 'live',
    @Body() dto: UpdatePlatformProfileDto,
    @Req() request: Request,
  ) {
    await this.profiles.update(environment, dto, this.actor(request));
    return this.profiles.describe(environment);
  }

  @Post(':environment/certificates')
  async uploadCertificate(
    @Param('environment', new ParseEnumPipe(ENVIRONMENTS))
    environment: 'test' | 'live',
    @Body() dto: UploadCertificateDto,
    @Req() request: Request,
  ) {
    const effective = this.profiles.getEffective(environment);
    const password =
      dto.password ??
      (dto.kind === 'clientPrivate'
        ? effective.clientCertificatePassword
        : effective.publicCertificatePassword);

    await this.profiles.storeCertificate({
      environment,
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
        environment,
        dto.kind === 'clientPrivate'
          ? { clientCertificatePassword: dto.password }
          : { publicCertificatePassword: dto.password },
        this.actor(request),
      );
    }

    return this.profiles.describe(environment);
  }

  /** Checks identity, credentials and both certificates for an environment. */
  @Post(':environment/validate')
  async validate(
    @Param('environment', new ParseEnumPipe(ENVIRONMENTS))
    environment: 'test' | 'live',
  ) {
    let security: Awaited<
      ReturnType<TiramisConfigService['validateConfigurationSecurity']>
    >;
    try {
      security = await this.configService.validateConfigurationSecurity(
        this.configService.getSystemRuntimeConfiguration(environment),
      );
    } catch (error: any) {
      const message = error?.message || 'Validation failed';
      await this.profiles.recordValidation(environment, {
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
    await this.profiles.recordValidation(environment, {
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
    @Param('environment', new ParseEnumPipe(ENVIRONMENTS))
    environment: 'test' | 'live',
    @Body() dto: PortalWebhookKeyDto,
    @Req() request: Request,
  ) {
    await this.profiles.setPortalWebhookApiKey(
      environment,
      dto.apiKey,
      this.actor(request),
    );
    return { environment, portalWebhookApiKeyConfigured: true };
  }

  private actor(request: Request) {
    const admin = (request as any).tiramisAdministrator as
      | { id?: string; email?: string }
      | undefined;
    return admin?.email || admin?.id || 'platform-admin';
  }
}
