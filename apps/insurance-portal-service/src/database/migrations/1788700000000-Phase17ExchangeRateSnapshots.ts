import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase17ExchangeRateSnapshots1788700000000 implements MigrationInterface {
  name = 'Phase17ExchangeRateSnapshots1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_notes"
      ADD COLUMN "exchange_rate_snapshot" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_cover_notes"
      DROP COLUMN "exchange_rate_snapshot"
    `);
  }
}
