import { MigrationInterface, QueryRunner } from 'typeorm';

export class PartnerScopeBranches1792000000000 implements MigrationInterface {
  name = 'PartnerScopeBranches1792000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      ADD COLUMN "branch_ids" uuid[]
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_partner_product_scopes_operations"
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      ADD CONSTRAINT "CHK_insurance_partner_product_scopes_operations"
      CHECK ("allowed_operations" <@ ARRAY['QUOTE','SUBMIT','VIEW_QUOTATION','VIEW_POLICY','REQUEST_ENDORSEMENT','REQUEST_RENEWAL','REQUEST_CANCELLATION','NOTIFY_CLAIM','VIEW_CLAIM','VIEW_PAYMENT','VIEW_COMMISSION']::varchar[])
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_partner_product_scopes_operations"
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      ADD CONSTRAINT "CHK_insurance_partner_product_scopes_operations"
      CHECK ("allowed_operations" <@ ARRAY['QUOTE','SUBMIT','VIEW_QUOTATION','VIEW_POLICY','REQUEST_ENDORSEMENT','REQUEST_RENEWAL','NOTIFY_CLAIM','VIEW_CLAIM','VIEW_PAYMENT','VIEW_COMMISSION']::varchar[])
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partner_product_scopes"
      DROP COLUMN IF EXISTS "branch_ids"
    `);
  }
}
