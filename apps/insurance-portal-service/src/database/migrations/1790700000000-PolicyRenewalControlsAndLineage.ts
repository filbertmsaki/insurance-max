import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyRenewalControlsAndLineage1790700000000 implements MigrationInterface {
  name = 'PolicyRenewalControlsAndLineage1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "policies"
      ADD COLUMN IF NOT EXISTS "previous_policy_id" uuid,
      ADD COLUMN IF NOT EXISTS "previous_cover_note_reference_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "renewal_of_policy_id" uuid,
      ADD COLUMN IF NOT EXISTS "renewal_sequence" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "policy_renewals"
      ADD COLUMN IF NOT EXISTS "previous_policy_id" uuid,
      ADD COLUMN IF NOT EXISTS "previous_cover_note_reference_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "renewal_of_policy_id" uuid,
      ADD COLUMN IF NOT EXISTS "renewal_sequence" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      UPDATE "policy_renewals" renewal
      SET
        previous_policy_id = transaction.source_policy_id,
        previous_cover_note_reference_number = renewal.source_cover_note_reference,
        renewal_of_policy_id = COALESCE(policy.renewal_of_policy_id, policy.renewed_from_policy_id, policy.id),
        renewal_sequence = GREATEST(COALESCE(policy.renewal_sequence, 0) + 1, 1)
      FROM "policy_transactions" transaction
      LEFT JOIN "policies" policy ON policy.id = transaction.source_policy_id
      WHERE transaction.id = renewal.policy_transaction_id
        AND renewal.previous_policy_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE "policies" renewed
      SET
        previous_policy_id = renewed.renewed_from_policy_id,
        renewal_of_policy_id = COALESCE(previous.renewal_of_policy_id, previous.renewed_from_policy_id, previous.id),
        renewal_sequence = GREATEST(COALESCE(previous.renewal_sequence, 0) + 1, 1),
        previous_cover_note_reference_number = previous.cover_note_no
      FROM "policies" previous
      WHERE renewed.renewed_from_policy_id = previous.id
        AND renewed.previous_policy_id IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_renewal_lineage"
      ON "policies" ("company_id", "renewal_of_policy_id", "renewal_sequence")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_renewals_previous_policy_period"
      ON "policy_renewals" (
        "company_id",
        "previous_policy_id",
        "renewal_start_date",
        "renewal_end_date"
      )
    `);

    await queryRunner.query(`
      INSERT INTO "company_configs" (
        "company_id",
        "config_key",
        "config_value",
        "value_type",
        "description",
        "is_active"
      )
      SELECT
        company.id,
        'RENEWAL_WINDOW_BEFORE_DAYS',
        '7',
        'number',
        'Number of days before Cover Note End Date when renewal becomes available.',
        true
      FROM "companies" company
      WHERE NOT EXISTS (
        SELECT 1
        FROM "company_configs" config
        WHERE config.company_id = company.id
          AND config.config_key = 'RENEWAL_WINDOW_BEFORE_DAYS'
      )
    `);

    await queryRunner.query(`
      INSERT INTO "company_configs" (
        "company_id",
        "config_key",
        "config_value",
        "value_type",
        "description",
        "is_active"
      )
      SELECT
        company.id,
        'RENEWAL_WINDOW_AFTER_DAYS',
        '7',
        'number',
        'Number of days after Cover Note End Date when renewal remains available.',
        true
      FROM "companies" company
      WHERE NOT EXISTS (
        SELECT 1
        FROM "company_configs" config
        WHERE config.company_id = company.id
          AND config.config_key = 'RENEWAL_WINDOW_AFTER_DAYS'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policy_renewals_previous_policy_period"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policies_renewal_lineage"`,
    );
    await queryRunner.query(`
      ALTER TABLE "policy_renewals"
      DROP COLUMN IF EXISTS "renewal_sequence",
      DROP COLUMN IF EXISTS "renewal_of_policy_id",
      DROP COLUMN IF EXISTS "previous_cover_note_reference_number",
      DROP COLUMN IF EXISTS "previous_policy_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "policies"
      DROP COLUMN IF EXISTS "renewal_sequence",
      DROP COLUMN IF EXISTS "renewal_of_policy_id",
      DROP COLUMN IF EXISTS "previous_cover_note_reference_number",
      DROP COLUMN IF EXISTS "previous_policy_id"
    `);
  }
}
