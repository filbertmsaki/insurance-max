import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReinsurancePremiumAccountCounterpartyResponse1792500000000 implements MigrationInterface {
  name = 'ReinsurancePremiumAccountCounterpartyResponse1792500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reinsurance_premium_accounts"
        ADD COLUMN "confirmed_by" uuid,
        ADD COLUMN "confirmed_at" timestamptz,
        ADD COLUMN "response_note" text
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reinsurance_premium_accounts"
        DROP COLUMN IF EXISTS "response_note",
        DROP COLUMN IF EXISTS "confirmed_at",
        DROP COLUMN IF EXISTS "confirmed_by"
    `);
  }
}
