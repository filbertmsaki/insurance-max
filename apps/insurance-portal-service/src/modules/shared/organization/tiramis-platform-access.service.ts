import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  TiramisCompanyLinkEntity,
  TiramisCompanyLinkStatus,
} from '../../tiramis/entities/tiramis-company-link.entity';
import {
  TiramisEnvironmentName,
  TiramisPlatformSettingsEntity,
} from '../../tiramis/entities/tiramis-platform-settings.entity';
import { TiramisServiceApiKeyVaultService } from '../../tiramis/services/tiramis-service-api-key-vault.service';

export const TIRAMIS_PLATFORM_SETTINGS_ID = 'platform';

export const DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS = [
  'submit',
  'read_status',
  'receive_notifications',
];

/**
 * Single source of truth for platform-level TIRAMIS access: the active
 * environment, the platform's service credentials, and each company's link
 * status. Companies configure nothing; the platform owner manages all of it.
 */
@Injectable()
export class TiramisPlatformAccessService {
  constructor(
    @InjectRepository(TiramisPlatformSettingsEntity)
    private readonly settingsRepository: Repository<TiramisPlatformSettingsEntity>,
    @InjectRepository(TiramisCompanyLinkEntity)
    private readonly linkRepository: Repository<TiramisCompanyLinkEntity>,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(): Promise<TiramisPlatformSettingsEntity> {
    const settings = await this.settingsRepository.findOne({
      where: { id: TIRAMIS_PLATFORM_SETTINGS_ID },
    });
    return (
      settings ??
      this.settingsRepository.create({
        id: TIRAMIS_PLATFORM_SETTINGS_ID,
        activeEnvironment: this.defaultEnvironment(),
        validationStatus: 'NOT_VALIDATED',
      })
    );
  }

  /** The environment every new submission uses, platform-wide from TIRA_ENV. */
  async getActiveEnvironment(): Promise<TiramisEnvironmentName> {
    return this.defaultEnvironment();
  }

  async isEnvironmentValidated(_environment: TiramisEnvironmentName) {
    const settings = await this.getSettings();
    return settings.validationStatus === 'VALID';
  }

  /** The platform's TIRAMIS service key for an environment, decrypted. */
  async getServiceApiKey(
    environment: TiramisEnvironmentName,
  ): Promise<string | null> {
    const settings = await this.settingsRepository
      .createQueryBuilder('settings')
      .addSelect(['settings.serviceApiKeyEncrypted'])
      .where('settings.id = :id', { id: TIRAMIS_PLATFORM_SETTINGS_ID })
      .getOne();
    void environment;
    return this.apiKeyVault.decrypt(settings?.serviceApiKeyEncrypted);
  }

  async getIntegrationPermissions(): Promise<string[]> {
    const permissions = (await this.getSettings()).integrationPermissions;
    return permissions?.length
      ? permissions
      : DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS;
  }

  getLink(companyId: string) {
    return this.linkRepository.findOne({ where: { companyId } });
  }

  async isCompanyActive(companyId: string): Promise<boolean> {
    return (
      (await this.getLink(companyId))?.status ===
      TiramisCompanyLinkStatus.ACTIVE
    );
  }

  /** Ids of companies whose TIRAMIS integration access is active. */
  async activeCompanyIds(): Promise<Set<string>> {
    const links = await this.linkRepository.find({
      where: { status: TiramisCompanyLinkStatus.ACTIVE },
      select: { companyId: true },
    });
    return new Set(links.map((link) => link.companyId));
  }

  /**
   * Blocks new submissions and new business for a company whose access is
   * not active. Follow-ups of existing submissions are never blocked.
   */
  async assertCompanyCanTransact(companyId: string) {
    const link = await this.getLink(companyId);
    if (link?.status === TiramisCompanyLinkStatus.ACTIVE) return;

    throw new ForbiddenException({
      code:
        link?.status === TiramisCompanyLinkStatus.REVOKED
          ? 'TIRAMIS_ACCESS_REVOKED'
          : 'TIRAMIS_ACCESS_NOT_ACTIVE',
      message:
        link?.status === TiramisCompanyLinkStatus.REVOKED
          ? 'TIRA integration access for this company has been revoked by the platform. Existing records remain available.'
          : 'TIRA integration access has not been activated for this company yet.',
    });
  }

  private defaultEnvironment(): TiramisEnvironmentName {
    const value = this.configService.get<string>('tiramisClient.tiraEnv');
    if (value === 'uat' || value === 'production') return value;
    return 'uat';
  }
}
