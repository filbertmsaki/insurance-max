import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';

import { ApiClientType } from '@insurance-max/contracts';

import { ApiClientsService } from '../../platform/api-clients/api-clients.service';
import { TiramisClientService } from './tiramis-client.service';

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
  ) {}

  async syncWebhookApiKey(params: {
    companyId: string;
    environment: 'test' | 'live';
    tiramisConfigurationId: string;
  }): Promise<{ apiClientId: string }> {
    const name = `TIRAMIS webhook ${params.tiramisConfigurationId}`;
    const ipWhitelist = [this.resolveTiramisSourceIp()];
    const existing = (await this.apiClientsService.findAll()).find(
      (client) => client.name === name,
    );

    let apiClientId: string;
    let plainKey: string;

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
        scopes: [TIRAMIS_WEBHOOK_SCOPE],
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
      scopes: Array.from(
        new Set([...(existing?.scopes ?? []), TIRAMIS_WEBHOOK_SCOPE]),
      ),
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
   * API keys must be IP-allowlisted. TIRAMIS calls the webhook from its own
   * host, so allowlist TIRAMIS_WEBHOOK_SOURCE_IP, or the host of
   * TIRAMIS_SERVICE_BASE_URL when that is an IP or localhost.
   */
  private resolveTiramisSourceIp(): string {
    const configured = this.configService.get<string | null>(
      'tiramisClient.webhookSourceIp',
    );
    if (configured) {
      return configured;
    }

    const baseUrl = this.configService.get<string>('tiramisClient.baseUrl');
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
