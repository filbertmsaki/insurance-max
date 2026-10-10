import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';

import { TiramisSystemProfileEntity } from '../entities/tiramis-system-profile.entity';
import { TiramisSecretCryptoService } from '../../security/services/tiramis-secret-crypto.service';

export type TiramisEnvironmentName = 'test' | 'live';

/** Fully resolved platform settings for one TIRA environment. */
export interface EffectiveTiramisSystemProfile {
  environment: TiramisEnvironmentName;
  clientCode: string | null;
  clientKey: string | null;
  systemCode: string | null;
  systemName: string | null;
  baseUrl: string | null;
  callbackUrl: string | null;
  clientCertificatePath: string;
  clientCertificatePassword: string | null;
  publicCertificatePath: string;
  publicCertificatePassword: string | null;
  signatureAlgorithm: string;
  allowExpiredCertificates: boolean;
  portalWebhookApiKey: string | null;
  /** null = default event set. */
  portalNotificationEvents: string[] | null;
  /** Where each value came from, for the admin screen. */
  sources: Record<string, 'profile' | 'environment' | 'default' | 'missing'>;
}

export interface UpdateTiramisSystemProfileParams {
  clientCode?: string | null;
  clientKey?: string | null;
  systemCode?: string | null;
  systemName?: string | null;
  baseUrl?: string | null;
  callbackUrl?: string | null;
  clientCertificatePassword?: string | null;
  publicCertificatePassword?: string | null;
  signatureAlgorithm?: string | null;
  allowExpiredCertificates?: boolean | null;
  portalNotificationEvents?: string[] | null;
}

const ENV_NAMES = {
  clientCode: 'TIRA_CLIENT_CODE',
  clientKey: 'TIRA_CLIENT_KEY',
  systemCode: 'TIRA_SYSTEM_CODE',
  systemName: 'TIRA_SYSTEM_NAME',
  clientCertificatePassword: 'TIRA_CLIENT_CERT_PASSWORD',
  publicCertificatePassword: 'TIRA_PUBLIC_CERT_PASSWORD',
} as const;

const DEFAULT_SIGNATURE_ALGORITHM = 'sha1WithRSAEncryption';
const REFRESH_INTERVAL_MS = 60_000;

export const TIRAMIS_CERTIFICATE_FILES = {
  clientPrivate: 'clientprivate.pfx',
  tiraPublic: 'tiramispublic.pfx',
} as const;

/**
 * Platform-level TIRA settings per environment. Profiles are cached in memory
 * because runtime configuration is resolved synchronously on every request;
 * the cache reloads after each change and every minute, so instances converge.
 */
@Injectable()
export class TiramisSystemProfileService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TiramisSystemProfileService.name);
  private cache = new Map<TiramisEnvironmentName, TiramisSystemProfileEntity>();
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(TiramisSystemProfileEntity)
    private readonly repository: Repository<TiramisSystemProfileEntity>,
    private readonly secretCrypto: TiramisSecretCryptoService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) =>
        this.logger.warn(
          `TIRA system profile refresh failed: ${error?.message || error}`,
        ),
      );
    }, REFRESH_INTERVAL_MS);
    this.refreshTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async refresh() {
    const rows = await this.repository.find();
    this.cache = new Map(rows.map((row) => [row.environment, row]));
  }

  /** Effective settings for an environment: profile first, then env vars. */
  getEffective(
    environment: TiramisEnvironmentName,
  ): EffectiveTiramisSystemProfile {
    const row = this.cache.get(environment);
    const suffix = environment.toUpperCase();
    const sources: EffectiveTiramisSystemProfile['sources'] = {};

    const pick = (
      field: string,
      profileValue: string | null | undefined,
      envName: string | null,
    ): string | null => {
      if (profileValue?.trim()) {
        sources[field] = 'profile';
        return profileValue.trim();
      }
      const envValue = envName ? this.envValue(envName) : null;
      sources[field] = envValue ? 'environment' : 'missing';
      // Env values may be plaintext or encrypted with TIRAMIS_SECRET_ENCRYPTION_KEY.
      return envValue ? this.secretCrypto.decryptIfEncrypted(envValue) : null;
    };
    const secret = (value?: string | null) =>
      value ? this.secretCrypto.decryptIfEncrypted(value) : null;

    const certificateDirectory = join(this.certificateBaseDir(), environment);
    const allowExpiredFromEnv =
      this.envValue('TIRA_ALLOW_EXPIRED_CERTIFICATES') === 'true';
    const algorithm = pick(
      'signatureAlgorithm',
      row?.signatureAlgorithm,
      'TIRA_SIGNATURE_ALGORITHM',
    );
    if (!algorithm) sources.signatureAlgorithm = 'default';

    return {
      environment,
      clientCode: pick(
        'clientCode',
        row?.clientCode,
        `${ENV_NAMES.clientCode}_${suffix}`,
      ),
      clientKey: pick(
        'clientKey',
        secret(row?.clientKeyEncrypted),
        `${ENV_NAMES.clientKey}_${suffix}`,
      ),
      systemCode: pick(
        'systemCode',
        row?.systemCode,
        `${ENV_NAMES.systemCode}_${suffix}`,
      ),
      systemName: pick(
        'systemName',
        row?.systemName,
        `${ENV_NAMES.systemName}_${suffix}`,
      ),
      baseUrl: pick('baseUrl', row?.baseUrl, `TIRAMIS_${suffix}_BASE_URL`),
      callbackUrl: pick(
        'callbackUrl',
        row?.callbackUrl,
        `TIRAMIS_${suffix}_CALLBACK_URL`,
      ),
      clientCertificatePath: join(
        certificateDirectory,
        TIRAMIS_CERTIFICATE_FILES.clientPrivate,
      ),
      clientCertificatePassword: pick(
        'clientCertificatePassword',
        secret(row?.clientCertificatePasswordEncrypted),
        `${ENV_NAMES.clientCertificatePassword}_${suffix}`,
      ),
      publicCertificatePath: join(
        certificateDirectory,
        TIRAMIS_CERTIFICATE_FILES.tiraPublic,
      ),
      publicCertificatePassword: pick(
        'publicCertificatePassword',
        secret(row?.publicCertificatePasswordEncrypted),
        `${ENV_NAMES.publicCertificatePassword}_${suffix}`,
      ),
      signatureAlgorithm: algorithm ?? DEFAULT_SIGNATURE_ALGORITHM,
      allowExpiredCertificates:
        row?.allowExpiredCertificates ?? allowExpiredFromEnv,
      portalWebhookApiKey: secret(row?.portalWebhookApiKeyEncrypted),
      portalNotificationEvents: row?.portalNotificationEvents ?? null,
      sources,
    };
  }

  getStored(environment: TiramisEnvironmentName) {
    return this.cache.get(environment) ?? null;
  }

  async update(
    environment: TiramisEnvironmentName,
    params: UpdateTiramisSystemProfileParams,
    actor: string,
  ) {
    const row = await this.loadOrCreate(environment);
    const text = (value: string | null | undefined) =>
      value === undefined ? undefined : value?.trim() || null;
    const encrypt = (value: string | null | undefined) =>
      value === undefined
        ? undefined
        : value?.trim()
          ? this.secretCrypto.encrypt(value.trim())
          : null;

    const plain = {
      clientCode: text(params.clientCode),
      systemCode: text(params.systemCode),
      systemName: text(params.systemName),
      baseUrl: text(params.baseUrl),
      callbackUrl: text(params.callbackUrl),
      signatureAlgorithm: text(params.signatureAlgorithm),
    };
    for (const [field, value] of Object.entries(plain)) {
      if (value !== undefined) (row as any)[field] = value;
    }
    const secrets = {
      clientKeyEncrypted: encrypt(params.clientKey),
      clientCertificatePasswordEncrypted: encrypt(
        params.clientCertificatePassword,
      ),
      publicCertificatePasswordEncrypted: encrypt(
        params.publicCertificatePassword,
      ),
    };
    for (const [field, value] of Object.entries(secrets)) {
      if (value !== undefined) (row as any)[field] = value;
    }
    if (params.allowExpiredCertificates !== undefined) {
      row.allowExpiredCertificates = params.allowExpiredCertificates;
    }
    if (params.portalNotificationEvents !== undefined) {
      row.portalNotificationEvents = params.portalNotificationEvents;
    }

    // Any change to the identity invalidates the previous validation.
    row.validationStatus = 'NOT_VALIDATED';
    row.validatedAt = null;
    row.validationMessage = null;
    row.updatedBy = actor;
    return this.save(row);
  }

  async setPortalWebhookApiKey(
    environment: TiramisEnvironmentName,
    apiKey: string,
    actor: string,
  ) {
    const row = await this.loadOrCreate(environment);
    row.portalWebhookApiKeyEncrypted = this.secretCrypto.encrypt(apiKey);
    row.updatedBy = actor;
    return this.save(row);
  }

  async recordValidation(
    environment: TiramisEnvironmentName,
    result: { valid: boolean; message: string },
  ) {
    const row = await this.loadOrCreate(environment);
    row.validationStatus = result.valid ? 'VALID' : 'INVALID';
    row.validatedAt = new Date();
    row.validationMessage = result.message;
    return this.save(row);
  }

  /**
   * Stores an uploaded certificate for an environment. The file is written
   * next to the old one and swapped in only after it loads with its password.
   */
  async storeCertificate(params: {
    environment: TiramisEnvironmentName;
    kind: keyof typeof TIRAMIS_CERTIFICATE_FILES;
    contentBase64: string;
    validate: (temporaryPath: string) => void;
  }) {
    const content = Buffer.from(params.contentBase64, 'base64');
    if (!content.length) {
      throw new BadRequestException('The certificate file is empty.');
    }
    const directory = join(this.certificateBaseDir(), params.environment);
    mkdirSync(directory, { recursive: true });
    const target = join(directory, TIRAMIS_CERTIFICATE_FILES[params.kind]);
    const temporary = `${target}.upload-${Date.now()}.pfx`;
    writeFileSync(temporary, content, { mode: 0o600 });
    try {
      params.validate(temporary);
    } catch (error) {
      try {
        unlinkSync(temporary);
      } catch {
        // ignore cleanup failure
      }
      throw error;
    }
    renameSync(temporary, target);

    const row = await this.loadOrCreate(params.environment);
    row.validationStatus = 'NOT_VALIDATED';
    row.validatedAt = null;
    row.validationMessage = null;
    await this.save(row);
    return target;
  }

  /** Masked view for administrators (never returns secrets). */
  describe(environment: TiramisEnvironmentName) {
    const effective = this.getEffective(environment);
    const stored = this.getStored(environment);
    const mask = (value: string | null) =>
      value ? (value.length <= 4 ? '****' : `****${value.slice(-4)}`) : null;
    return {
      environment,
      clientCode: effective.clientCode,
      clientKeyMasked: mask(effective.clientKey),
      systemCode: effective.systemCode,
      systemName: effective.systemName,
      baseUrl: effective.baseUrl,
      callbackUrl: effective.callbackUrl,
      clientCertificatePath: effective.clientCertificatePath,
      clientCertificatePasswordConfigured: Boolean(
        effective.clientCertificatePassword,
      ),
      publicCertificatePath: effective.publicCertificatePath,
      publicCertificatePasswordConfigured: Boolean(
        effective.publicCertificatePassword,
      ),
      signatureAlgorithm: effective.signatureAlgorithm,
      allowExpiredCertificates: effective.allowExpiredCertificates,
      portalWebhookApiKeyConfigured: Boolean(effective.portalWebhookApiKey),
      portalNotificationEvents: effective.portalNotificationEvents,
      sources: effective.sources,
      validationStatus: stored?.validationStatus ?? 'NOT_VALIDATED',
      validatedAt: stored?.validatedAt ?? null,
      validationMessage: stored?.validationMessage ?? null,
      updatedAt: stored?.updatedAt ?? null,
      updatedBy: stored?.updatedBy ?? null,
    };
  }

  private async loadOrCreate(environment: TiramisEnvironmentName) {
    return (
      (await this.repository.findOne({ where: { environment } })) ??
      this.repository.create({ environment, validationStatus: 'NOT_VALIDATED' })
    );
  }

  private async save(row: TiramisSystemProfileEntity) {
    const saved = await this.repository.save(row);
    await this.refresh();
    return saved;
  }

  private certificateBaseDir() {
    return (
      this.envValue('TIRAMIS_CERTIFICATE_BASE_DIR') ??
      '/opt/apps/tiramis/certificates'
    );
  }

  private envValue(name: string): string | null {
    const value = this.configService.get<unknown>(name);
    if (value === undefined || value === null) return null;
    return String(value).trim() || null;
  }
}
