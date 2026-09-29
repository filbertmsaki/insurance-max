import type { ConfigService } from '@nestjs/config';

import { buildUrl } from '@insurance-max/shared-config';

/**
 * The portal endpoint TIRAMIS pushes final TIRA outcomes to. It is derived
 * from the portal's own public API base URL (APP_URL + global prefix) so it
 * always points back at the instance that made the submission — there is no
 * separate env var for it. TIRAMIS rejects any submission without it.
 */
export function resolveTiramisPortalWebhookUrl(
  configService: ConfigService,
): string {
  const apiBaseUrl = configService.get<string>('app.apiBaseUrl')?.trim();

  if (!apiBaseUrl) {
    throw new Error(
      'app.apiBaseUrl is not configured; cannot build the TIRAMIS portal webhook URL.',
    );
  }

  const appVersion = configService.get<string>('app.version') || 'v1';

  return buildUrl(apiBaseUrl, appVersion, 'webhooks/tiramis/notifications');
}
