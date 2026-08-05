import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalOrganizationContext1794700000000 implements MigrationInterface {
  name = 'PortalOrganizationContext1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_branch_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_department_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_sale_point_id"
      character varying(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_sale_point_code"
      character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS
      "source_company_membership_id"
      character varying(100)
    `);

    // NOTE: "source_user_id" already exists on "tiramis_transactions"
    // (added in an earlier migration and mapped by
    // TiramisTransactionEntity.sourceUserId) — intentionally not
    // re-added here to avoid duplicating it.

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_tiramis_transactions_source_branch"
      ON "tiramis_transactions" (
        "source_branch_id"
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_tiramis_transactions_source_sale_point"
      ON "tiramis_transactions" (
        "source_sale_point_code"
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_transactions_source_sale_point"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_tiramis_transactions_source_branch"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS "source_company_membership_id",
      DROP COLUMN IF EXISTS "source_sale_point_code",
      DROP COLUMN IF EXISTS "source_sale_point_id",
      DROP COLUMN IF EXISTS "source_department_id",
      DROP COLUMN IF EXISTS "source_branch_id"
    `);
  }
}
