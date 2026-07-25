import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceCompanyIdToTiramisTransactions1783194327680 implements MigrationInterface {
  name = 'AddSourceCompanyIdToTiramisTransactions1783194327680';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" ADD COLUMN IF NOT EXISTS "source_company_id" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" DROP COLUMN IF EXISTS "source_company_id"`,
    );
  }
}
