require('ts-node/register');
require('tsconfig-paths/register');

const { createCipheriv, createHash, randomBytes } = require('crypto');
const { hashPassword } = require('@insurance-max/portal-shared/utils/hash.util');

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

function encryptTiramisSecret(plainText) {
  const rawKey = process.env.TIRAMIS_SECRET_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      'TIRAMIS_SECRET_ENCRYPTION_KEY is required to encrypt the TIRAMIS portal webhook API key.',
    );
  }

  const key = Buffer.from(rawKey, 'base64');

  if (key.length !== 32) {
    throw new Error('TIRAMIS_SECRET_ENCRYPTION_KEY must be a base64 32-byte key.');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'enc',
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
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

    const portalWebhookClientId =
      process.env.E2E_PORTAL_WEBHOOK_CLIENT_ID ||
      'iam_tiramis_portal_webhook_local';
    const portalWebhookClientSecret =
      process.env.E2E_PORTAL_WEBHOOK_CLIENT_SECRET ||
      'local-tiramis-portal-webhook-secret';
    const portalWebhookApiKey = `${portalWebhookClientId}.${portalWebhookClientSecret}`;
    const portalWebhookSecretHash = await hashPassword(
      portalWebhookClientSecret,
    );

    await portalDataSource.query(
      `
      INSERT INTO api_clients (
        company_id,
        name,
        client_id,
        key_prefix,
        client_secret_hash,
        scopes,
        status,
        client_type,
        environment,
        description,
        ip_whitelist,
        rate_limit_per_minute,
        created_at,
        updated_at
      )
      VALUES (
        NULL,
        'TIRAMIS Portal Webhook Local E2E',
        $1,
        'IMX_TIRAMIS',
        $2,
        ARRAY['tiramis:notify'],
        'ACTIVE',
        'INTERNAL_SERVICE',
        'DEVELOPMENT',
        'Auto-provisioned during scripts/prepare-tiramis-e2e.js',
        $3::jsonb,
        120,
        now(),
        now()
      )
      ON CONFLICT (client_id)
      DO UPDATE SET
        client_secret_hash = EXCLUDED.client_secret_hash,
        scopes = EXCLUDED.scopes,
        status = EXCLUDED.status,
        client_type = EXCLUDED.client_type,
        environment = EXCLUDED.environment,
        ip_whitelist = EXCLUDED.ip_whitelist,
        updated_at = now()
      `,
      [
        portalWebhookClientId,
        portalWebhookSecretHash,
        JSON.stringify(['127.0.0.1', '::1']),
      ],
    );

    await tiramisDataSource.query(
      `
      UPDATE tiramis_client_configurations
      SET
        portal_webhook_api_key_encrypted = $1,
        updated_at = now()
      WHERE environment = 'test'
        AND company_code = $2
      `,
      [
        encryptTiramisSecret(portalWebhookApiKey),
        ALLIANCE_TENANT.companyCode,
      ],
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
