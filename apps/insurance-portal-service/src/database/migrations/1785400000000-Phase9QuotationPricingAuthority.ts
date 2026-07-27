import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase9QuotationPricingAuthority1785400000000
  implements MigrationInterface
{
  name = 'Phase9QuotationPricingAuthority1785400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      ADD COLUMN "pricing_quote_id" character varying(30)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_qer_pricing_quote_id"
      ON "quotation_entry_risks" ("pricing_quote_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_qer_pricing_quote_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_entry_risks"
      DROP COLUMN "pricing_quote_id"
    `);
  }
}
