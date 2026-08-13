import { MigrationInterface, QueryRunner } from 'typeorm';

export class PricingQuoteIdentifierSequence1786521549525 implements MigrationInterface {
  name = 'PricingQuoteIdentifierSequence1786521549525';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "pricing_quote_identifier_seq"
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DROP SEQUENCE IF EXISTS "pricing_quote_identifier_seq"
    `);
  }
}
