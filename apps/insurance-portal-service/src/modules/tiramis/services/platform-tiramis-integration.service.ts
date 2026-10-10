import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

const ENVIRONMENTS: TiramisEnvironmentName[] = ['local', 'uat', 'production'];

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
    const activeEnvironment = await this.platformAccess.getActiveEnvironment();
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
      this.serviceKeyConfigured(),
    ]);

    return {
      activeEnvironment,
      environmentSwitchedAt: null,
      integrationPermissions:
        settings.integrationPermissions ??
        DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS,
      environments: Object.fromEntries(
        ENVIRONMENTS.map((environment) => [
          environment,
          {
            validationStatus:
              environment === activeEnvironment
                ? settings.validationStatus
                : 'NOT_VALIDATED',
            validatedAt:
              environment === activeEnvironment
                ? (settings.validatedAt ?? null)
                : null,
            serviceApiKeyConfigured:
              environment === activeEnvironment ? keys : false,
            pendingSubmissions: pending[environment] ?? 0,
          },
        ]),
      ),
      environment: {
        validationStatus: settings.validationStatus,
        validatedAt: settings.validatedAt ?? null,
        serviceApiKeyConfigured: keys,
        pendingSubmissions: pending[activeEnvironment] ?? 0,
      },
      profiles:
        profiles && typeof profiles === 'object' && !('error' in profiles)
          ? Object.fromEntries(
              ENVIRONMENTS.map((environment) => [
                environment,
                (profiles as { active?: unknown }).active ?? profiles,
              ]),
            )
          : profiles,
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

  async validateProfile(_environment: TiramisEnvironmentName, actorId: string) {
    const environment = await this.platformAccess.getActiveEnvironment();
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
    settings.validationStatus = result.valid ? 'VALID' : 'INVALID';
    settings.validatedAt = new Date();
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
    settings.serviceApiKeyEncrypted = encrypted;
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

  /** Links a registered insurer to the platform integration. */
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

    await this.tiramisClientService.upsertClientConfiguration({
      companyId,
      environment: await this.platformAccess.getActiveEnvironment(),
      companyCode: insurerCompanyCode,
      insurerCompanyCode,
    });

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
      existing ? 'tiramis.company_link.updated' : 'tiramis.company_link.linked',
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
      .addSelect(['settings.serviceApiKeyEncrypted'])
      .where('settings.id = :id', { id: TIRAMIS_PLATFORM_SETTINGS_ID })
      .getOne();
    return settings ?? (await this.platformAccess.getSettings());
  }

  private async serviceKeyConfigured() {
    const settings = await this.loadSettings();
    return Boolean(settings.serviceApiKeyEncrypted);
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
    return Object.fromEntries(
      rows.map((row) => [row.status, Number(row.count)]),
    );
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
      resource: companyId
        ? 'tiramis_company_link'
        : 'tiramis_platform_settings',
      resourceId: companyId ?? TIRAMIS_PLATFORM_SETTINGS_ID,
      afterState,
    });
  }
}
