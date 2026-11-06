import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuotationOfferValidity1795600000000 implements MigrationInterface {
  name = 'QuotationOfferValidity1795600000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS offer_finalized_at timestamptz, ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz`,
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_quotations_offer_expiry" ON quotations (offer_expires_at) WHERE offer_expires_at IS NOT NULL AND deleted_at IS NULL`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX IF EXISTS "IDX_quotations_offer_expiry"`);
    await runner.query(
      `ALTER TABLE quotations DROP COLUMN IF EXISTS offer_expires_at, DROP COLUMN IF EXISTS offer_finalized_at`,
    );
  }
}
