import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CompanyType } from '@insurance-max/portal-shared/enums/company-type.enum';

import { Company } from '../../platform/companies/entities/company.entity';
import { AuditService } from '../../shared/audit/audit.service';
import {
  DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS,
  TIRAMIS_PLATFORM_SETTINGS_ID,
  TiramisPlatformAccessService,
} from '../../shared/organization/tiramis-platform-access.service';
import {
  TiramisCompanyLinkEntity,
  TiramisCompanyLinkStatus,
} from '../entities/tiramis-company-link.entity';
import {
  TiramisEnvironmentName,
  TiramisPlatformSettingsEntity,
} from '../entities/tiramis-platform-settings.entity';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisServiceApiKeyVaultService } from './tiramis-service-api-key-vault.service';
import { TiramisWebhookCredentialService } from './tiramis-webhook-credential.service';

/** Submissions still waiting on TIRA (they finish in their own environment). */
const PENDING_STATUSES = [
  TiramisSubmissionStatus.PENDING,
  TiramisSubmissionStatus.SUBMITTING,
  TiramisSubmissionStatus.SENT_TO_TIRAMIS_SERVICE,
  TiramisSubmissionStatus.ACK_ACCEPTED,
  TiramisSubmissionStatus.ACKNOWLEDGED,
  TiramisSubmissionStatus.PENDING_FINAL,
  TiramisSubmissionStatus.RETRY_PENDING,
  TiramisSubmissionStatus.RETRYING,
  TiramisSubmissionStatus.CALLBACK_OVERDUE,
];

const ENVIRONMENTS: TiramisEnvironmentName[] = ['test', 'live'];

/**
 * Platform → TIRAMIS Integration. The platform owner manages the TIRA
 * identity, credentials, certificates, active environment and company access
 * here, once, for every company. Companies configure nothing.
 */
@Injectable()
export class PlatformTiramisIntegrationService {
  constructor(
    @InjectRepository(TiramisPlatformSettingsEntity)
    private readonly settingsRepository: Repository<TiramisPlatformSettingsEntity>,
    @InjectRepository(TiramisCompanyLinkEntity)
    private readonly linkRepository: Repository<TiramisCompanyLinkEntity>,
    @InjectRepository(TiramisSubmissionTrackingEntity)
    private readonly trackingRepository: Repository<TiramisSubmissionTrackingEntity>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly platformAccess: TiramisPlatformAccessService,
    private readonly tiramisClientService: TiramisClientService,
    private readonly webhookCredentialService: TiramisWebhookCredentialService,
    private readonly apiKeyVault: TiramisServiceApiKeyVaultService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------- overview

  async getOverview() {
    const settings = await this.platformAccess.getSettings();
    const [profiles, pending, links, keys] = await Promise.all([
      this.tiramisClientService
        .platformAdminRequest<Record<string, unknown>>({
          method: 'GET',
          url: '/api/tiramis/platform/profiles',
          failureMessage: 'Unable to read the TIRA profiles from TIRAMIS.',
        })
        .catch((error: Error) => ({ error: error.message })),
      this.pendingByEnvironment(),
      this.linkCounts(),
      this.serviceKeysConfigured(),
    ]);

    return {
      activeEnvironment: settings.activeEnvironment,
      environmentSwitchedAt: settings.environmentSwitchedAt ?? null,
      integrationPermissions:
        settings.integrationPermissions ??
        DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS,
      environments: Object.fromEntries(
        ENVIRONMENTS.map((environment) => [
          environment,
          {
            validationStatus:
              environment === 'live'
                ? settings.liveValidationStatus
                : settings.testValidationStatus,
            validatedAt:
              (environment === 'live'
                ? settings.liveValidatedAt
                : settings.testValidatedAt) ?? null,
            serviceApiKeyConfigured: keys[environment],
            pendingSubmissions: pending[environment] ?? 0,
          },
        ]),
      ),
      profiles,
      companies: links,
    };
  }

  // ---------------------------------------------------------------- profiles

  updateProfile(environment: TiramisEnvironmentName, profile: unknown) {
    return this.tiramisClientService.platformAdminRequest({
      method: 'PUT',
      url: `/api/tiramis/platform/profiles/${environment}`,
      data: profile,
      environment,
      failureMessage: 'Unable to save the TIRA profile.',
    });
  }

  uploadCertificate(environment: TiramisEnvironmentName, upload: unknown) {
    return this.tiramisClientService.platformAdminRequest({
      method: 'POST',
      url: `/api/tiramis/platform/profiles/${environment}/certificates`,
      data: upload,
      environment,
      failureMessage: 'Unable to store the certificate.',
    });
  }

  async validateProfile(environment: TiramisEnvironmentName, actorId: string) {
    const result = await this.tiramisClientService.platformAdminRequest<{
      valid: boolean;
      message: string;
    }>({
      method: 'POST',
      url: `/api/tiramis/platform/profiles/${environment}/validate`,
      environment,
      failureMessage: 'Unable to validate the TIRA profile.',
    });

    const settings = await this.loadSettings();
    if (environment === 'live') {
      settings.liveValidationStatus = result.valid ? 'VALID' : 'INVALID';
      settings.liveValidatedAt = new Date();
    } else {
      settings.testValidationStatus = result.valid ? 'VALID' : 'INVALID';
      settings.testValidatedAt = new Date();
    }
    settings.updatedBy = actorId;
    await this.settingsRepository.save(settings);

    await this.audit(actorId, 'tiramis.platform.profile.validated', {
      environment,
      valid: result.valid,
      message: result.message,
    });
    return result;
  }

  // ---------------------------------------------------------------- credentials

  async generateServiceApiKey(
    environment: TiramisEnvironmentName,
    allowedIps: string[],
    actorId: string,
  ) {
    const apiKey = await this.tiramisClientService.issuePlatformServiceKey({
      environment,
      allowedIps,
    });
    const settings = await this.loadSettings();
    const encrypted = this.apiKeyVault.encrypt(apiKey);
    if (environment === 'live') settings.serviceApiKeyLiveEncrypted = encrypted;
    else settings.serviceApiKeyTestEncrypted = encrypted;
    settings.updatedBy = actorId;
    await this.settingsRepository.save(settings);

    // TIRAMIS needs the matching webhook key to report results back.
    await this.webhookCredentialService.syncPlatformWebhookApiKey(environment);

    await this.audit(actorId, 'tiramis.platform.service_api_key.rotated', {
      environment,
    });
    return { environment, serviceApiKeyConfigured: true };
  }

  async syncWebhookApiKey(
    environment: TiramisEnvironmentName,
    actorId: string,
  ) {
    await this.webhookCredentialService.syncPlatformWebhookApiKey(environment);
    await this.audit(actorId, 'tiramis.platform.webhook_api_key.rotated', {
      environment,
    });
    return { environment, portalWebhookApiKeyConfigured: true };
  }

  async updateIntegrationSettings(
    params: { integrationPermissions?: string[] },
    actorId: string,
  ) {
    const settings = await this.loadSettings();
    if (params.integrationPermissions !== undefined) {
      settings.integrationPermissions = params.integrationPermissions;
    }
    settings.updatedBy = actorId;
    await this.settingsRepository.save(settings);
    await this.audit(actorId, 'tiramis.platform.settings.updated', params);
    return this.getOverview();
  }

  // ---------------------------------------------------------------- environment

  /**
   * Switches the platform's active TIRA environment. New submissions from
   * every linked company go to the new environment immediately; submissions
   * already sent keep following up (status, retries, callbacks, notifications)
   * in the environment they were sent to, so both environments' credentials
   * must stay configured until the old environment's pending count is zero.
   */
  async switchEnvironment(
    environment: TiramisEnvironmentName,
    options: { confirmLive?: boolean },
    actorId: string,
  ) {
    if (environment === 'live' && options.confirmLive !== true) {
      throw new BadRequestException(
        'Switching the platform to Production requires explicit confirmation.',
      );
    }

    const settings = await this.loadSettings();
    const previous = settings.activeEnvironment;
    if (previous === environment) {
      return this.getOverview();
    }

    const validation = await this.validateProfile(environment, actorId);
    if (!validation.valid) {
      throw new BadRequestException({
        code: 'TIRAMIS_ENVIRONMENT_NOT_VALID',
        message: `The ${environment} TIRA profile is not valid: ${validation.message}`,
      });
    }
    if (!(await this.platformAccess.getServiceApiKey(environment))) {
      throw new BadRequestException({
        code: 'TIRAMIS_SERVICE_KEY_MISSING',
        message: `Generate the platform service key for ${environment} before switching to it.`,
      });
    }

    const refreshed = await this.loadSettings();
    refreshed.activeEnvironment = environment;
    refreshed.environmentSwitchedAt = new Date();
    refreshed.environmentSwitchedBy = actorId;
    refreshed.updatedBy = actorId;
    await this.settingsRepository.save(refreshed);

    const pending = await this.pendingByEnvironment();
    await this.audit(actorId, 'tiramis.platform.environment.switched', {
      from: previous,
      to: environment,
      pendingInPreviousEnvironment: pending[previous] ?? 0,
    });
    return this.getOverview();
  }

  // ---------------------------------------------------------------- companies

  async listCompanies() {
    const companies = await this.companyRepository.find({
      where: { company_type: CompanyType.INSURANCE_COMPANY },
      select: {
        id: true,
        name: true,
        status: true,
        tira_insurer_company_code: true,
        tira_company_code: true,
      },
      order: { name: 'ASC' },
    });
    const links = await this.linkRepository.find({
      where: { companyId: In(companies.map((company) => company.id)) },
    });
    const byCompany = new Map(links.map((link) => [link.companyId, link]));
    return companies.map((company) => ({
      companyId: company.id,
      companyName: company.name,
      companyStatus: company.status,
      suggestedInsurerCompanyCode:
        company.tira_insurer_company_code ?? company.tira_company_code ?? null,
      link: byCompany.get(company.id) ?? null,
    }));
  }

  /** Links a registered insurer to the platform integration (both environments). */
  async linkCompany(
    companyId: string,
    params: { insurerCompanyCode: string; insurerCompanyName?: string },
    actorId: string,
  ) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Company was not found.');
    if (company.company_type !== CompanyType.INSURANCE_COMPANY) {
      throw new BadRequestException(
        'Only insurance companies are linked to TIRAMIS.',
      );
    }

    const insurerCompanyCode = params.insurerCompanyCode.trim().toUpperCase();
    const duplicate = await this.linkRepository.findOne({
      where: { insurerCompanyCode },
    });
    if (duplicate && duplicate.companyId !== companyId) {
      throw new ConflictException(
        `Insurer company code ${insurerCompanyCode} is already linked to another company.`,
      );
    }

    // Provision the company in TIRAMIS for both environments, so an
    // environment switch never requires per-company work.
    for (const environment of ENVIRONMENTS) {
      await this.tiramisClientService.upsertClientConfiguration({
        companyId,
        environment,
        companyCode: insurerCompanyCode,
        insurerCompanyCode,
      });
    }

    const existing = await this.linkRepository.findOne({
      where: { companyId },
    });
    const link =
      existing ??
      this.linkRepository.create({
        companyId,
        status: TiramisCompanyLinkStatus.LINKED,
        linkedAt: new Date(),
        linkedBy: actorId,
      });
    link.companyName = company.name;
    link.insurerCompanyCode = insurerCompanyCode;
    link.insurerCompanyName = params.insurerCompanyName?.trim() || company.name;
    const saved = await this.linkRepository.save(link);

    await this.audit(
      actorId,
      existing
        ? 'tiramis.company_link.updated'
        : 'tiramis.company_link.linked',
      { insurerCompanyCode, status: saved.status },
      companyId,
    );
    return saved;
  }

  async activateCompany(companyId: string, actorId: string) {
    const link = await this.requireLink(companyId);
    if (link.status === TiramisCompanyLinkStatus.REVOKED) {
      throw new BadRequestException(
        'Access was revoked; use restore to give it back.',
      );
    }
    link.status = TiramisCompanyLinkStatus.ACTIVE;
    link.activatedAt = new Date();
    link.activatedBy = actorId;
    const saved = await this.linkRepository.save(link);
    await this.audit(actorId, 'tiramis.company_link.activated', {}, companyId);
    return saved;
  }

  /**
   * Revokes a company's integration access: new submissions and new business
   * are blocked and it disappears from new-business insurer lists. Existing
   * records stay; submissions already sent finish and report back; queued
   * retries are held until access is restored.
   */
  async revokeCompany(companyId: string, reason: string, actorId: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('A reason is required to revoke access.');
    }
    const link = await this.requireLink(companyId);
    link.status = TiramisCompanyLinkStatus.REVOKED;
    link.revokedAt = new Date();
    link.revokedBy = actorId;
    link.revokeReason = reason.trim();
    const saved = await this.linkRepository.save(link);
    const pending = await this.trackingRepository.count({
      where: { sourceCompanyId: companyId, status: In(PENDING_STATUSES) },
    });
    await this.audit(
      actorId,
      'tiramis.company_link.revoked',
      { reason: link.revokeReason, pendingSubmissions: pending },
      companyId,
    );
    return { ...saved, pendingSubmissions: pending };
  }

  /** Restores access without any technical setup. */
  async restoreCompany(companyId: string, actorId: string) {
    const link = await this.requireLink(companyId);
    if (link.status !== TiramisCompanyLinkStatus.REVOKED) {
      throw new BadRequestException('Only revoked access can be restored.');
    }
    link.status = TiramisCompanyLinkStatus.ACTIVE;
    link.restoredAt = new Date();
    link.restoredBy = actorId;
    const saved = await this.linkRepository.save(link);
    await this.audit(actorId, 'tiramis.company_link.restored', {}, companyId);
    return saved;
  }

  // ---------------------------------------------------------------- helpers

  private async requireLink(companyId: string) {
    const link = await this.linkRepository.findOne({ where: { companyId } });
    if (!link) {
      throw new NotFoundException('This company is not linked to TIRAMIS yet.');
    }
    return link;
  }

  private async loadSettings() {
    const settings = await this.settingsRepository
      .createQueryBuilder('settings')
      .addSelect([
        'settings.serviceApiKeyTestEncrypted',
        'settings.serviceApiKeyLiveEncrypted',
      ])
      .where('settings.id = :id', { id: TIRAMIS_PLATFORM_SETTINGS_ID })
      .getOne();
    return settings ?? (await this.platformAccess.getSettings());
  }

  private async serviceKeysConfigured() {
    const settings = await this.loadSettings();
    return {
      test: Boolean(settings.serviceApiKeyTestEncrypted),
      live: Boolean(settings.serviceApiKeyLiveEncrypted),
    } as Record<TiramisEnvironmentName, boolean>;
  }

  private async pendingByEnvironment(): Promise<Record<string, number>> {
    const rows: Array<{ environment: string | null; count: string }> =
      await this.trackingRepository
        .createQueryBuilder('tracking')
        .select('tracking.tiramisEnvironment', 'environment')
        .addSelect('COUNT(*)', 'count')
        .where('tracking.status IN (:...statuses)', {
          statuses: PENDING_STATUSES,
        })
        .groupBy('tracking.tiramisEnvironment')
        .getRawMany();
    return Object.fromEntries(
      rows.map((row) => [row.environment ?? 'test', Number(row.count)]),
    );
  }

  private async linkCounts() {
    const rows: Array<{ status: string; count: string }> =
      await this.linkRepository
        .createQueryBuilder('link')
        .select('link.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('link.status')
        .getRawMany();
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  private audit(
    actorId: string,
    action: string,
    afterState: Record<string, unknown>,
    companyId?: string,
  ) {
    return this.auditService.logCritical({
      userId: actorId,
      companyId: companyId ?? null,
      action,
      eventCategory: 'platform',
      resource: companyId ? 'tiramis_company_link' : 'tiramis_platform_settings',
      resourceId: companyId ?? TIRAMIS_PLATFORM_SETTINGS_ID,
      afterState,
    });
  }
}
