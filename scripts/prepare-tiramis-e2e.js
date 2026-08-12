require('ts-node/register');
require('tsconfig-paths/register');

const { createCipheriv, createHash, randomBytes } = require('crypto');

process.env.NODE_ENV = process.env.NODE_ENV || 'e2e';

const portalDataSource =
  require('../apps/insurance-portal-service/src/database/data-source').default;
const {
  ALLIANCE_TENANT,
} = require('../apps/insurance-portal-service/src/database/seeds/data/alliance.seed-data');
const {
  runAllSeeders,
} = require('../apps/insurance-portal-service/src/database/seeds');
const tiramisDataSource =
  require('../apps/tiramis/src/database/data-source').default;
const {
  runTiramisConfigSeed,
} = require('../apps/tiramis/src/database/seeders/seed-tiramis-config');
const {
  TiramisApiKeyEntity,
} = require('../apps/tiramis/src/modules/api-keys/entities/tiramis-api-key.entity');
const {
  TiramisApiKeyAuditEntity,
} = require('../apps/tiramis/src/modules/api-keys/entities/tiramis-api-key-audit.entity');

async function getAppliedMigrationCount(dataSource) {
  try {
    const rows = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM migrations',
    );
    return Number(rows?.[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function resetMigrations(dataSource, label) {
  const appliedCount = await getAppliedMigrationCount(dataSource);

  console.log(
    `\n[${label}] resetting schema (${appliedCount} recorded migration(s))`,
  );
  await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  console.log(`[${label}] running migrations`);
  await dataSource.runMigrations();
}

async function preparePortalService() {
  await portalDataSource.initialize();

  try {
    await resetMigrations(portalDataSource, 'insurance-portal-service');
    console.log('[insurance-portal-service] running seeders');
    await runAllSeeders(portalDataSource);
  } finally {
    if (portalDataSource.isInitialized) {
      await portalDataSource.destroy();
    }
  }
}

async function prepareTiramisService() {
  await tiramisDataSource.initialize();

  try {
    await resetMigrations(tiramisDataSource, 'tiramis');
    console.log('[tiramis] seeding configuration');
    await runTiramisConfigSeed(tiramisDataSource);
  } finally {
    if (tiramisDataSource.isInitialized) {
      await tiramisDataSource.destroy();
    }
  }
}

function encryptPortalApiKey(apiKey) {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_ACCESS_SECRET is required to encrypt the portal-side TIRAMIS API key.',
    );
  }

  const iv = randomBytes(12);
  const key = createHash('sha256').update(secret, 'utf8').digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'enc:v1:aes-256-gcm',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

async function provisionLocalPortalApiKey() {
  await portalDataSource.initialize();
  await tiramisDataSource.initialize();

  try {
    console.log(
      '[integration] provisioning local TIRAMIS service API key for the Alliance portal company',
    );

    const apiKey = `tms_${randomBytes(32).toString('base64url')}`;
    const keyRepository = tiramisDataSource.getRepository(TiramisApiKeyEntity);

    const savedKey = await keyRepository.save(
      keyRepository.create({
        name: 'Insurance Portal Service Local E2E',
        serviceName: 'insurance-portal-service',
        tenantCompanyCode: ALLIANCE_TENANT.companyCode,
        tenantSystemCode: ALLIANCE_TENANT.systemCode,
        tenantEnvironment: 'test',
        apiKey,
        keyPrefix: apiKey.slice(0, 18),
        scopes: [
          'tiramis:admin',
          'tiramis:prepare',
          'tiramis:submit',
          'tiramis:read',
          'tiramis:verify',
          'tiramis:retry',
          'tiramis:invoke',
        ],
        description: 'Auto-generated during scripts/prepare-tiramis-e2e.js',
        isActive: true,
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
      }),
    );

    await tiramisDataSource.getRepository(TiramisApiKeyAuditEntity).save({
      apiKeyId: savedKey.id,
      action: 'CREATED',
      outcome: 'SUCCESS',
      serviceName: 'insurance-portal-service',
      metadata: { source: 'prepare-tiramis-e2e' },
    });

    const encryptedApiKey = encryptPortalApiKey(apiKey);
    const tiramisBaseUrl =
      process.env.TIRAMIS_SERVICE_BASE_URL || 'http://127.0.0.1:9091';

    await portalDataSource.query(
      `
      UPDATE tiramis_company_configurations
      SET
        service_api_key_encrypted = $1,
        source_service = COALESCE(source_service, $2),
        base_url = COALESCE(base_url, $3),
        validation_status = 'NOT_VALIDATED',
        validated_at = NULL,
        validation_message = NULL,
        updated_at = now()
      WHERE environment = 'test'
        AND company_code = $4
      `,
      [
        encryptedApiKey,
        'insurance-portal-service',
        tiramisBaseUrl,
        ALLIANCE_TENANT.companyCode,
      ],
    );

    await portalDataSource.query(
      `
      UPDATE companies
      SET
        tira_integration_enabled = true,
        settings = COALESCE(settings, '{}'::jsonb)
          || jsonb_build_object('tiramis_target_environment', 'test'),
        updated_at = now()
      WHERE slug = $1
      `,
      [ALLIANCE_TENANT.slug],
    );
  } finally {
    if (portalDataSource.isInitialized) {
      await portalDataSource.destroy();
    }

    if (tiramisDataSource.isInitialized) {
      await tiramisDataSource.destroy();
    }
  }
}

async function main() {
  console.log(
    'Preparing Tiramis E2E databases with a fresh migration reset and seed.',
  );

  await preparePortalService();
  await prepareTiramisService();
  await provisionLocalPortalApiKey();

  console.log('\nFresh E2E database preparation completed.');
}

main().catch((error) => {
  console.error('Failed to prepare Tiramis E2E databases:', error);
  process.exitCode = 1;
});
