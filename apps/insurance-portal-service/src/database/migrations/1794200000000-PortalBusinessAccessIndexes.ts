import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supporting indexes for PortalBusinessAccessService's customer/intermediary
 * scoped queries. Note: the "quotations" table stores its status column as
 * "quotation_status" (the Quotation entity's `status` TS property maps to
 * that DB column name via @Column({ name: 'quotation_status' })).
 */
export class PortalBusinessAccessIndexes1794200000000
  implements MigrationInterface
{
  name = 'PortalBusinessAccessIndexes1794200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_customer_portal"
      ON "quotations" ("company_id", "customer_id", "quotation_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quotation_intermediary_portal"
      ON "quotations" ("intermediary_company_id", "quotation_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_customer_portal"
      ON "policies" ("company_id", "customer_id", "policy_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_policy_intermediary_portal"
      ON "policies" ("intermediary_company_id", "policy_status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_customer_portal"
      ON "invoices" ("company_id", "customer_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_intermediary_portal"
      ON "invoices" ("intermediary_company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commission_intermediary_portal"
      ON "commission_transactions" ("intermediary_company_id", "status", "created_at")
      WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_commission_intermediary_portal"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_invoice_intermediary_portal"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_customer_portal"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_policy_intermediary_portal"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_policy_customer_portal"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotation_intermediary_portal"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_quotation_customer_portal"`,
    );
  }
}
