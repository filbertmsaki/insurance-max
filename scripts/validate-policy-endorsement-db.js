const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv(
  path.join(process.cwd(), 'apps', 'insurance-portal-service', '.env'),
);

const client = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD,
  database:
    process.env.DB_DATABASE ?? process.env.DB_NAME ?? 'insurance_portal_db',
  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

const checks = [];

async function queryCheck(name, sql) {
  const result = await client.query(sql);
  const count = Number(result.rows[0]?.count ?? 0);

  checks.push({
    name,
    count,
    passed: count === 0,
  });
}

async function main() {
  await client.connect();

  try {
    await queryCheck(
      'Duplicate issued policies',
      `
      SELECT COUNT(*)::int
      FROM (
        SELECT "company_id", "quotation_id", "source_quotation_revision"
        FROM "policies"
        WHERE "deleted_at" IS NULL
          AND "quotation_id" IS NOT NULL
          AND "source_quotation_revision" IS NOT NULL
        GROUP BY "company_id", "quotation_id", "source_quotation_revision"
        HAVING COUNT(*) > 1
      ) duplicates
      `,
    );

    await queryCheck(
      'System-issued policies without active version',
      `
      SELECT COUNT(*)::int
      FROM "policies"
      WHERE "deleted_at" IS NULL
        AND "issued_by_system" = true
        AND "active_version_id" IS NULL
      `,
    );

    await queryCheck(
      'Policies with multiple current versions',
      `
      SELECT COUNT(*)::int
      FROM (
        SELECT "policy_id"
        FROM "policy_versions"
        WHERE "is_current" = true
        GROUP BY "policy_id"
        HAVING COUNT(*) > 1
      ) invalid
      `,
    );

    await queryCheck(
      'Accepted endorsements not applied',
      `
      SELECT COUNT(*)::int
      FROM "policy_transactions"
      WHERE "transaction_type" = 'ENDORSEMENT'
        AND "submission_status" = 'ACCEPTED'
        AND "stage" <> 'APPLIED'
      `,
    );

    await queryCheck(
      'Applied endorsements without target version',
      `
      SELECT COUNT(*)::int
      FROM "policy_transactions"
      WHERE "transaction_type" = 'ENDORSEMENT'
        AND "stage" = 'APPLIED'
        AND "target_policy_version_id" IS NULL
      `,
    );

    await queryCheck(
      'Policy active-version mismatch',
      `
      SELECT COUNT(*)::int
      FROM "policy_transactions" pt
      JOIN "policies" p
        ON p."id" = pt."source_policy_id"
      WHERE pt."transaction_type" = 'ENDORSEMENT'
        AND pt."stage" = 'APPLIED'
        AND p."active_version_id" IS DISTINCT FROM pt."target_policy_version_id"
      `,
    );

    await queryCheck(
      'Required replacement cover note missing',
      `
      SELECT COUNT(*)::int
      FROM "policy_transactions" pt
      JOIN "policy_endorsements" pe
        ON pe."policy_transaction_id" = pt."id"
      WHERE pt."stage" = 'APPLIED'
        AND pe."requires_new_cover_note" = true
        AND pe."replacement_cover_note_reference" IS NULL
      `,
    );

    await queryCheck(
      'Applied credit endorsement without refund',
      `
      SELECT COUNT(*)::int
      FROM "policy_transactions" pt
      WHERE pt."transaction_type" = 'ENDORSEMENT'
        AND pt."stage" = 'APPLIED'
        AND pt."premium_effect" = 'CREDIT'
        AND CAST(pt."return_premium" AS numeric) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM "finance_refunds" fr
          WHERE fr."company_id" = pt."company_id"
            AND fr."source_type" = 'ENDORSEMENT'
            AND fr."source_record_id" = pt."id"
        )
      `,
    );

    const passed = checks.every((check) => check.passed);
    console.table(checks);

    const outputDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, 'policy-endorsement-validation.json'),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          passed,
          checks,
        },
        null,
        2,
      ),
    );

    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
