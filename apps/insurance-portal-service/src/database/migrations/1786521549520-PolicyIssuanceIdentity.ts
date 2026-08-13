import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyIssuanceIdentity1786521549520 implements MigrationInterface {
  name = 'PolicyIssuanceIdentity1786521549520';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_policies_issued_quotation_revision"
      ON "policies" (
        "company_id",
        "quotation_id",
        "source_quotation_revision"
      )
      WHERE "quotation_id" IS NOT NULL
        AND "source_quotation_revision" IS NOT NULL
        AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "UQ_policies_issued_quotation_revision"
    `);
  }
}
