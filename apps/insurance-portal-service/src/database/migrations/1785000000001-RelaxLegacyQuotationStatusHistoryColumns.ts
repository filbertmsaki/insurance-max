import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxLegacyQuotationStatusHistoryColumns1785000000001 implements MigrationInterface {
  name = 'RelaxLegacyQuotationStatusHistoryColumns1785000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      ALTER COLUMN "old_status" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      ALTER COLUMN "new_status" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      ALTER COLUMN "new_status" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_status_history"
      ALTER COLUMN "old_status" SET NOT NULL
    `);
  }
}
