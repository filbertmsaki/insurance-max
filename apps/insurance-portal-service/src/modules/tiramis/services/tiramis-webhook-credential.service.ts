import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';

import { ApiClientType } from '@insurance-max/contracts';

import { ApiClientsService } from '../../platform/api-clients/api-clients.service';
import { TiramisClientService } from './tiramis-client.service';
import { TiramisPlatformAccessService } from '../../shared/organization/tiramis-platform-access.service';
import { TiramisCompanyConfigurationEntity } from '../entities/tiramis-company-configuration.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export const TIRAMIS_WEBHOOK_SCOPE = 'tiramis:notify';

/**
 * Keeps the API key TIRAMIS uses for the portal webhook
 * (POST webhooks/tiramis/notifications) in sync on both sides: one
 * INTERNAL_SERVICE api client per TIRAMIS client configuration, scoped to
 * tiramis:notify, whose key is stored on that configuration in TIRAMIS.
 *
 * Every sync rotates the secret. The previous secret stays valid for the
 * rotation grace period, so in-flight callbacks are never rejected.
 */
@Injectable()
export class TiramisWebhookCredentialService {
  private readonly logger = new Logger(TiramisWebhookCredentialService.name);

  constructor(
    private readonly apiClientsService: ApiClientsService,
    private readonly tiramisClientService: TiramisClientService,
    private readonly configService: ConfigService,
    @InjectRepository(TiramisCompanyConfigurationEntity)
    private readonly configurationRepository: Repository<TiramisCompanyConfigurationEntity>,
    private readonly platformAccess: TiramisPlatformAccessService,
  ) {}

  async syncWebhookApiKey(params: {
    companyId: string;
    environment: 'uat' | 'production';
    tiramisConfigurationId: string;
  }): Promise<{ apiClientId: string }> {
    const name = `TIRAMIS webhook ${params.tiramisConfigurationId}`;
    const ipWhitelist = [await this.resolveTiramisSourceIp(params.environment)];
    const existing = (await this.apiClientsService.findAll()).find(
      (client) => client.name === name,
    );

    let apiClientId: string;
    let plainKey: string;
    const configuration = await this.configurationRepository.findOne({
      where: { companyId: params.companyId, environment: params.environment },
    });
    const notificationsEnabled =
      configuration?.integrationPermissions?.includes(
        'receive_notifications',
      ) ?? true;
    const webhookScopes = notificationsEnabled ? [TIRAMIS_WEBHOOK_SCOPE] : [];

    if (existing) {
      const rotated = await this.apiClientsService.rotateSecret(
        existing.id,
        'tiramis-webhook-credential-sync',
      );
      apiClientId = existing.id;
      plainKey = rotated.plainSecret;
    } else {
      const created = await this.apiClientsService.create({
        name,
        scopes: webhookScopes,
        ipWhitelist,
        clientType: ApiClientType.INTERNAL_SERVICE,
        description: `Used by TIRAMIS (${params.environment}) to push callback notifications to the portal webhook.`,
      });
      apiClientId = created.id;
      plainKey = created.plainSecret;
    }

    // Callback bursts must not be throttled back onto the 2-minute status
    // sync.
    await this.apiClientsService.update(apiClientId, undefined, {
      scopes: webhookScopes,
      ip_whitelist: ipWhitelist,
      rate_limit_per_minute: null,
    });

    await this.tiramisClientService.setPortalWebhookApiKey({
      companyId: params.companyId,
      environment: params.environment,
      tiramisConfigurationId: params.tiramisConfigurationId,
      apiKey: plainKey,
    });

    this.logger.log(
      `Portal webhook API key synced to TIRAMIS configuration ${params.tiramisConfigurationId} (${params.environment})`,
    );

    return { apiClientId };
  }

  /**
   * The platform's webhook credential for an environment: one api client per
   * environment, shared by every linked company, whose key TIRAMIS keeps on
   * that environment's platform profile. Rotates the secret on each sync.
   */
  async syncPlatformWebhookApiKey(
    environment: 'uat' | 'production',
    baseUrl?: string,
  ): Promise<{ apiClientId: string }> {
    const name = `TIRAMIS webhook (${environment})`;
    const ipWhitelist = [await this.resolveTiramisSourceIp(environment)];
    const notificationsEnabled = (
      await this.platformAccess.getIntegrationPermissions()
    ).includes('receive_notifications');
    const webhookScopes = notificationsEnabled ? [TIRAMIS_WEBHOOK_SCOPE] : [];
    const existing = (await this.apiClientsService.findAll()).find(
      (client) => client.name === name,
    );

    let apiClientId: string;
    let plainKey: string;
    if (existing) {
      const rotated = await this.apiClientsService.rotateSecret(
        existing.id,
        'tiramis-platform-webhook-sync',
      );
      apiClientId = existing.id;
      plainKey = rotated.plainSecret;
    } else {
      const created = await this.apiClientsService.create({
        name,
        scopes: webhookScopes,
        ipWhitelist,
        clientType: ApiClientType.INTERNAL_SERVICE,
        description: `Used by TIRAMIS (${environment}) to push callback notifications for every linked company.`,
      });
      apiClientId = created.id;
      plainKey = created.plainSecret;
    }

    await this.apiClientsService.update(apiClientId, undefined, {
      scopes: webhookScopes,
      ip_whitelist: ipWhitelist,
      rate_limit_per_minute: null,
    });

    await this.tiramisClientService.platformAdminRequest({
      method: 'PUT',
      url: `/api/tiramis/platform/profiles/${environment}/portal-webhook-api-key`,
      data: { apiKey: plainKey },
      environment,
      baseUrl,
      failureMessage: 'Unable to store the platform webhook key in TIRAMIS.',
    });

    this.logger.log(
      `Platform webhook API key synced to TIRAMIS (${environment})`,
    );
    return { apiClientId };
  }

  /**
   * API keys must be IP-allowlisted. TIRAMIS calls the webhook from its own
   * host, so allowlist TIRAMIS_WEBHOOK_SOURCE_IP, or the host of
   * TIRAMIS_SERVICE_BASE_URL when that is an IP or localhost.
   */
  private async resolveTiramisSourceIp(
    environment: 'uat' | 'production',
  ): Promise<string> {
    const managedProfile =
      await this.platformAccess.getConnectionProfile(environment);
    if (managedProfile?.webhookSourceIp) return managedProfile.webhookSourceIp;
    const configured = this.configService.get<string | null>(
      'tiramisClient.webhookSourceIp',
    );
    if (configured) {
      return configured;
    }

    const baseUrl =
      managedProfile?.baseUrl ||
      (await this.platformAccess.getBaseUrl(environment));
    const host = baseUrl
      ? new URL(baseUrl).hostname.replace(/^\[|\]$/g, '')
      : '';

    if (host === 'localhost') {
      return '127.0.0.1';
    }
    if (isIP(host)) {
      return host;
    }

    throw new Error(
      `Set TIRAMIS_WEBHOOK_SOURCE_IP to the IP the TIRAMIS service calls the portal from (TIRAMIS_SERVICE_BASE_URL host "${host}" is not an IP).`,
    );
  }
}
