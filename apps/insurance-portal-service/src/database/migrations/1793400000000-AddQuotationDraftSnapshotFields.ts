import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuotationDraftSnapshotFields1793400000000
  implements MigrationInterface
{
  name = 'AddQuotationDraftSnapshotFields1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "cancellation_reason" text
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "current_wizard_step" character varying(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "draft_payload" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "draft_payload"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "current_wizard_step"
    `);
    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "cancellation_reason"
    `);
  }
}
