/**
 * Re-syncs the portal webhook API key (scope tiramis:notify) to TIRAMIS for
 * every active company TIRAMIS configuration. Saving or validating a
 * configuration in the portal does this automatically; this command repairs
 * existing environments in one go.
 *
 * Usage: npm run tiramis:sync-webhook-keys
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { CompanyTiramisConfigurationService } from '../../../modules/tiramis/services/company-tiramis-configuration.service';

async function bootstrap() {
  const logger = new Logger('SyncTiramisWebhookKeys');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const results = await app
      .get(CompanyTiramisConfigurationService)
      .syncAllPortalWebhookApiKeys();

    if (!results.length) {
      logger.warn('No active company TIRAMIS configuration was found.');
    }

    for (const result of results) {
      const label = `company ${result.companyId} (${result.environment})`;
      if (result.ok) {
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
