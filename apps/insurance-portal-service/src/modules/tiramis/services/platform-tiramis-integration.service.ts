import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
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
import { TiramisPlatformSettingsEntity } from '../entities/tiramis-platform-settings.entity';
import { TiramisSubmissionTrackingEntity } from '../entities/tiramis-submission-tracking.entity';
import { TiramisSubmissionStatus } from '../enums/tiramis-submission-status.enum';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisServiceApiKeyVaultService } from './tiramis-service-api-key-vault.service';
import { TiramisWebhookCredentialService } from './tiramis-webhook-credential.service';
import { RedisService } from '../../shared/redis/redis.service';

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
    private readonly redis: RedisService,
  ) {}

  // ---------------------------------------------------------------- overview

  async getOverview() {
    const settings = await this.platformAccess.getSettings();
    const activeEnvironment = await this.platformAccess.getActiveEnvironment();
    const [profile, pending, links, keys] = await Promise.all([
      this.tiramisClientService
        .platformAdminRequest<Record<string, unknown>>({
          method: 'GET',
          url: `/api/tiramis/platform/profiles/${activeEnvironment}`,
          environment: activeEnvironment,
          failureMessage: 'Unable to read the TIRA profile from TIRAMIS.',
        })
        .catch((error: Error) => ({ error: error.message })),
      this.pendingByEnvironment(),
      this.linkCounts(),
      this.serviceKeyConfigured(activeEnvironment),
    ]);

    return {
      activeEnvironment,
      environmentSwitchedAt: null,
      integrationPermissions:
        settings.integrationPermissions ??
        DEFAULT_TIRAMIS_INTEGRATION_PERMISSIONS,
      environment: {
        name: activeEnvironment,
        validationStatus: settings.validationStatus,
        validatedAt: settings.validatedAt ?? null,
        serviceApiKeyConfigured: keys,
        pendingSubmissions: pending[activeEnvironment] ?? 0,
      },
      connections: await Promise.all(
        (['uat', 'production'] as const).map(async (environment) => {
          const profile =
            await this.platformAccess.getConnectionProfile(environment);
          const baseUrl =
            profile?.baseUrl ??
            (await this.platformAccess.getBaseUrl(environment));
          const portalOutboundIps = await this.tiramisClientService
            .getPlatformServiceKeyAllowedIps({
              environment,
              baseUrl: profile?.candidateBaseUrl ?? baseUrl,
            })
            .catch(() => null);
          return {
            environment,
            baseUrl,
            candidateBaseUrl: profile?.candidateBaseUrl ?? null,
            portalWebhookUrl:
              await this.tiramisClientService.getPortalWebhookUrl(environment),
            // Retain the response field for older clients; editable callback
            // candidates are no longer used.
            candidatePortalWebhookUrl: null,
            webhookSourceIp: profile?.webhookSourceIp ?? null,
            portalOutboundIps,
            serviceApiKeyConfigured: Boolean(
              await this.platformAccess.getServiceApiKey(environment),
            ),
            validationStatus: profile?.validationStatus ?? 'NOT_VALIDATED',
            validatedAt: profile?.validatedAt ?? null,
            lastTestResult: profile?.lastTestResult ?? null,
            previousBaseUrl: profile?.previousBaseUrl ?? null,
            configurationSource: profile?.baseUrl
              ? 'database'
              : 'environment-fallback',
          };
        }),
      ),
      profile,
      companies: links,
    };
  }

  // ---------------------------------------------------------------- profiles

  updateProfile(profile: unknown) {
    return this.tiramisClientService.platformAdminRequest({
      method: 'PUT',
      url: '/api/tiramis/platform/profiles/active',
      data: profile,
      failureMessage: 'Unable to save the TIRA profile.',
    });
  }

  uploadCertificate(upload: unknown) {
    return this.tiramisClientService.platformAdminRequest({
      method: 'POST',
      url: '/api/tiramis/platform/profiles/active/certificates',
      data: upload,
      failureMessage: 'Unable to store the certificate.',
    });
  }

  async validateProfile(actorId: string) {
    const environment = await this.platformAccess.getActiveEnvironment();
    const result = await this.tiramisClientService.platformAdminRequest<{
      valid: boolean;
      message: string;
    }>({
      method: 'POST',
      url: '/api/tiramis/platform/profiles/active/validate',
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
    allowedIps: string[],
    actorId: string,
    requestedEnvironment?: 'uat' | 'production',
  ) {
    const environment =
      requestedEnvironment ??
      (await this.platformAccess.getActiveEnvironment());
    const candidateUrl = (
      await this.platformAccess.getConnectionProfile(environment)
    )?.candidateBaseUrl;
    const apiKey = await this.tiramisClientService.issuePlatformServiceKey({
      environment,
      allowedIps,
      baseUrl: candidateUrl ?? undefined,
    });
    const encrypted = this.apiKeyVault.encrypt(apiKey);
    await this.platformAccess.saveConnectionProfile(environment, {
      serviceApiKeyEncrypted: encrypted,
      updatedBy: actorId,
      validationStatus: 'NOT_VALIDATED',
      validatedAt: null,
      lastTestResult: null,
    });

    // TIRAMIS needs the matching webhook key to report results back.
    await this.webhookCredentialService.syncPlatformWebhookApiKey(
      environment,
      candidateUrl ?? undefined,
    );

    await this.audit(actorId, 'tiramis.platform.service_api_key.rotated', {
      environment,
    });
    return { environment, serviceApiKeyConfigured: true };
  }

  async updateConnection(
    environment: 'uat' | 'production',
    params: {
      baseUrl?: string;
      /** @deprecated Accepted for old clients but ignored; the callback is Portal-owned. */
      portalWebhookUrl?: string;
      webhookSourceIp?: string;
    },
    actorId: string,
  ) {
    const profile = await this.platformAccess.getConnectionProfile(environment);
    const baseUrl = params.baseUrl?.trim();
    if (baseUrl) {
      const parsed = new URL(baseUrl);
      if (
        !['https:', 'http:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname.endsWith('/api')
      ) {
        throw new BadRequestException(
          'Enter a base URL without credentials, query, fragment, or trailing /api. Production requires HTTPS.',
        );
      }
      if (environment === 'production' && parsed.protocol !== 'https:')
        throw new BadRequestException('Production TIRAMIS URL must use HTTPS.');
    }
    if (params.webhookSourceIp?.trim()) {
      const [address, prefix] = params.webhookSourceIp.trim().split('/');
      const version = isIP(address);
      const maxPrefix = version === 4 ? 32 : 128;
      if (
        !version ||
        (prefix !== undefined &&
          (!/^\d+$/.test(prefix) || Number(prefix) > maxPrefix))
      )
        throw new BadRequestException(
          'Callback source must be a valid IP address or CIDR.',
        );
    }
    const saved = await this.platformAccess.saveConnectionProfile(environment, {
      ...(baseUrl ? { candidateBaseUrl: baseUrl } : {}),
      ...(params.webhookSourceIp !== undefined
        ? { webhookSourceIp: params.webhookSourceIp.trim() || null }
        : {}),
      updatedBy: actorId,
      validationStatus: 'NOT_VALIDATED',
      validatedAt: null,
      lastTestResult: null,
    });
    if (params.baseUrl !== undefined) {
      const configuredWebhookUrl =
        await this.tiramisClientService.getPortalWebhookUrl(environment);
      const host = configuredWebhookUrl
        ? new URL(configuredWebhookUrl).hostname
        : '';
      const previousHosts = [
        profile?.portalWebhookUrl,
        profile?.candidatePortalWebhookUrl,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => new URL(value).hostname);
      const allowedHosts = [
        ...new Set([...previousHosts, host].filter(Boolean)),
      ];
      await this.tiramisClientService.platformAdminRequest({
        method: 'PUT',
        url: `/api/tiramis/platform/profiles/${environment}/portal-webhook-settings`,
        data: { allowedHosts },
        environment,
        baseUrl: saved.candidateBaseUrl ?? saved.baseUrl ?? undefined,
        failureMessage:
          'Unable to synchronize the callback host policy to TIRAMIS.',
      });
    }
    if (params.webhookSourceIp !== undefined)
      await this.webhookCredentialService.syncPlatformWebhookApiKey(
        environment,
        saved.candidateBaseUrl ?? undefined,
      );
    await this.audit(actorId, 'tiramis.platform.connection.updated', {
      environment,
      baseUrl: saved.candidateBaseUrl ?? saved.baseUrl,
      portalWebhookUrl:
        await this.tiramisClientService.getPortalWebhookUrl(environment),
      webhookSourceIp: saved.webhookSourceIp,
    });
    return {
      environment,
      baseUrl: saved.baseUrl,
      candidateBaseUrl: saved.candidateBaseUrl,
      candidatePortalWebhookUrl: null,
      portalWebhookUrl:
        await this.tiramisClientService.getPortalWebhookUrl(environment),
      webhookSourceIp: saved.webhookSourceIp,
      validationStatus: saved.validationStatus,
    };
  }

  async activateConnection(environment: 'uat' | 'production', actorId: string) {
    const profile = await this.platformAccess.getConnectionProfile(environment);
    const hasUrl = Boolean(
      profile?.candidateBaseUrl ||
      profile?.baseUrl ||
      (await this.platformAccess.getBaseUrl(environment)),
    );
    if (
      !hasUrl ||
      !profile?.lastTestResult ||
      profile.lastTestResult.success !== true
    )
      throw new ConflictException(
        'Run and pass the full connection test before activating this environment.',
      );
    const pending = (await this.pendingByEnvironment())[environment] ?? 0;
    const currentBaseUrl =
      profile?.baseUrl ?? (await this.platformAccess.getBaseUrl(environment));
    if (
      profile?.candidateBaseUrl &&
      profile.candidateBaseUrl !== currentBaseUrl &&
      pending > 0
    )
      throw new ConflictException(
        `Drain ${pending} pending submissions before switching this environment to another TIRAMIS server.`,
      );
    if (profile?.candidateBaseUrl)
      await this.platformAccess.saveConnectionProfile(environment, {
        ...(profile.candidateBaseUrl
          ? { baseUrl: profile.candidateBaseUrl }
          : {}),
        candidateBaseUrl: null,
        ...(profile.candidateBaseUrl
          ? { previousBaseUrl: currentBaseUrl }
          : {}),
        validationStatus: 'VALID',
        validatedAt: new Date(),
        updatedBy: actorId,
      });
    await this.platformAccess.activateEnvironment(environment, actorId);
    await this.audit(actorId, 'tiramis.platform.environment.activated', {
      environment,
    });
    return this.getOverview();
  }

  async testConnection(environment: 'uat' | 'production', actorId: string) {
    const profile = await this.platformAccess.getConnectionProfile(environment);
    if (!profile?.candidateBaseUrl && !profile?.baseUrl)
      throw new BadRequestException(
        'Save the candidate TIRAMIS base URL before testing.',
      );
    let result: Record<string, unknown>;
    try {
      const apiKey = await this.platformAccess.getServiceApiKey(environment);
      let authenticated = false;
      let serviceTest: unknown = null;
      if (apiKey) {
        serviceTest = await this.tiramisClientService.checkPlatformConnection(
          environment,
          profile?.candidateBaseUrl ?? undefined,
        );
        authenticated = true;
      }
      const callback =
        await this.tiramisClientService.getPortalWebhookUrl(environment);
      const webhook = callback
        ? await this.tiramisClientService.testPlatformWebhook(
            environment,
            callback,
            profile?.candidateBaseUrl ?? undefined,
          )
        : {
            success: false,
            message:
              'Portal callback URL could not be generated from APP_URL and API routing configuration.',
          };
      result = {
        success: authenticated && webhook.success === true,
        portalToTiramis: {
          success: authenticated,
          authenticated,
          details: serviceTest,
        },
        tiramisToPortal: webhook,
        testedAt: new Date().toISOString(),
      };
    } catch (error) {
      result = {
        success: false,
        message:
          error instanceof Error ? error.message : 'Connection test failed.',
        testedAt: new Date().toISOString(),
      };
    }
    await this.platformAccess.saveConnectionProfile(environment, {
      lastTestResult: result,
      validationStatus: result.success === true ? 'VALID' : 'INVALID',
      validatedAt: new Date(),
      updatedBy: actorId,
    });
    await this.audit(actorId, 'tiramis.platform.connection.tested', {
      environment,
      success: result.success === true,
      result,
    });
    return result;
  }

  async detectConnectionIps(
    environment: 'uat' | 'production',
    actorId: string,
  ) {
    const profile = await this.platformAccess.getConnectionProfile(environment);
    const baseUrl = profile?.candidateBaseUrl ?? profile?.baseUrl ?? undefined;
    if (!baseUrl && !(await this.platformAccess.getBaseUrl(environment))) {
      throw new BadRequestException(
        'Save a TIRAMIS base URL before detecting source IPs.',
      );
    }

    const webhookUrl =
      await this.tiramisClientService.getPortalWebhookUrl(environment);
    if (!webhookUrl) {
      throw new BadRequestException(
        'The Portal callback URL could not be generated.',
      );
    }
    const probeUrl = new URL(webhookUrl);
    probeUrl.pathname = probeUrl.pathname.replace(
      /\/notifications\/?$/,
      '/source-ip-detection',
    );
    const challengeToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256')
      .update(challengeToken, 'utf8')
      .digest('hex');
    const challengeKey = `tiramis:connection-ip-probe:${tokenHash}`;

    try {
      await this.redis.set(challengeKey, environment, 120);
      const [portalOutbound, tiramisOutbound] = await Promise.all([
        this.tiramisClientService.detectPortalOutboundIp(environment, baseUrl),
        this.tiramisClientService.detectTiramisOutboundIp({
          environment,
          webhookUrl: probeUrl.toString(),
          challengeToken,
          baseUrl,
        }),
      ]);
      if (
        portalOutbound.environment !== environment ||
        tiramisOutbound.environment !== environment
      ) {
        throw new BadRequestException(
          'The detected source IP response came from a different TIRAMIS environment.',
        );
      }
      const result = {
        environment,
        // Each value comes from the receiving server's observed request.ip.
        portalOutboundIp: portalOutbound.observedIp,
        tiramisOutboundIp: tiramisOutbound.observedIp,
        detectedAt: new Date().toISOString(),
      };
      await this.audit(
        actorId,
        'tiramis.platform.connection.ips_detected',
        result,
      );
      return result;
    } finally {
      await this.redis.del(challengeKey);
    }
  }

  async syncWebhookApiKey(actorId: string) {
    const environment = await this.platformAccess.getActiveEnvironment();
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

  private async serviceKeyConfigured(environment: 'uat' | 'production') {
    return Boolean(await this.platformAccess.getServiceApiKey(environment));
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
      rows.map((row) => [row.environment ?? 'uat', Number(row.count)]),
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
