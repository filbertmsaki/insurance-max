/**
 * Re-syncs the portal webhook API key (scope tiramis:notify) to TIRAMIS for
 * every active company TIRAMIS configuration. Saving or validating a
 * configuration in the portal does this automatically; this command repairs
 * existing environments in one go.
 *
 * TIRAMIS only accepts configuration changes from a platform administrator,
 * so the command signs in as one first:
 *
 * Usage: TIRAMIS_ADMIN_EMAIL=... TIRAMIS_ADMIN_PASSWORD=... npm run tiramis:sync-webhook-keys
 */
import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RequestContextService } from '@insurance-max/shared-kernel';

import { AppModule } from '../../../app.module';
import { AuthService } from '../../../modules/shared/auth/auth.service';
import { CompanyTiramisConfigurationService } from '../../../modules/tiramis/services/company-tiramis-configuration.service';

async function bootstrap() {
  const logger = new Logger('SyncTiramisWebhookKeys');
  const email = process.env.TIRAMIS_ADMIN_EMAIL?.trim();
  const password = process.env.TIRAMIS_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.error(
      'Set TIRAMIS_ADMIN_EMAIL and TIRAMIS_ADMIN_PASSWORD to a platform administrator (OWNER or SUPER_ADMIN) account.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const session = (await app
      .get(AuthService)
      .login(
        { email, password },
        '127.0.0.1',
        'sync-tiramis-webhook-keys',
      )) as {
      access_token?: string;
    };

    if (!session?.access_token) {
      throw new Error(
        'Administrator sign-in did not return an access token (accounts that require two-factor authentication cannot be used here).',
      );
    }

    const requestId = randomUUID();
    const results = await app.get(RequestContextService).run(
      {
        requestId,
        correlationId: requestId,
        startedAt: Date.now(),
        bearerToken: session.access_token,
      },
      () =>
        app
          .get(CompanyTiramisConfigurationService)
          .syncAllPortalWebhookApiKeys(),
    );

    if (!results.length) {
      logger.warn('No active company TIRAMIS configuration was found.');
    }

    for (const result of results) {
      const label = `company ${result.companyId} (${result.environment})`;
      if (result.skipped) {
        logger.log(`Skipped ${label}: ${result.message}`);
      } else if (result.ok) {
        logger.log(`Synced webhook key for ${label}`);
      } else {
        logger.error(`Failed for ${label}: ${result.message}`);
      }
    }

    process.exitCode = results.every((result) => result.ok) ? 0 : 1;
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
