import { MigrationInterface, QueryRunner } from 'typeorm';

export class DashboardMvpIndexes1793500000000 implements MigrationInterface {
  name = 'DashboardMvpIndexes1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_dashboard_branch_created"
      ON "quotations" ("company_id", "branch_id", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_dashboard_insurer_created"
      ON "quotations" ("insurer_company_id", "quotation_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_dashboard_intermediary_created"
      ON "quotations" ("intermediary_company_id", "quotation_status", "created_at")
      WHERE "intermediary_company_id" IS NOT NULL
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotations_dashboard_creator_created"
      ON "quotations" ("company_id", "created_by", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_dashboard_branch_created"
      ON "policies" ("company_id", "branch_id", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_dashboard_end_date"
      ON "policies" ("company_id", "end_date", "policy_status")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_dashboard_insurer_created"
      ON "policies" ("insurer_company_id", "policy_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policies_dashboard_intermediary_created"
      ON "policies" ("intermediary_company_id", "policy_status", "created_at")
      WHERE "intermediary_company_id" IS NOT NULL
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_dashboard_status_created"
      ON "invoices" ("company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_dashboard_due_date"
      ON "invoices" ("company_id", "due_date", "balance_amount")
      WHERE "deleted_at" IS NULL
        AND "balance_amount" > 0
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_receipts_dashboard_created"
      ON "receipts" ("company_id", "created_at", "status")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commission_dashboard_intermediary"
      ON "commission_transactions" ("intermediary_company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commission_dashboard_insurer"
      ON "commission_transactions" ("insurer_company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_dashboard_company"
      ON "tiramis_submission_tracking" ("source_company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_dashboard_user"
      ON "tiramis_submission_tracking" ("source_company_id", "source_user_id", "created_at")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_tracking_dashboard_user"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_tracking_dashboard_company"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_commission_dashboard_insurer"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_commission_dashboard_intermediary"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_receipts_dashboard_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_dashboard_due_date"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_dashboard_status_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_policies_dashboard_intermediary_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_policies_dashboard_insurer_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_policies_dashboard_end_date"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_policies_dashboard_branch_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_dashboard_creator_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_dashboard_intermediary_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_dashboard_insurer_created"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_dashboard_branch_created"
    `);
  }
}
