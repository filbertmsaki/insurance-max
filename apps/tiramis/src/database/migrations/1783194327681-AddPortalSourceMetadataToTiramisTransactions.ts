import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalSourceMetadataToTiramisTransactions1783194327681
  implements MigrationInterface
{
  name = 'AddPortalSourceMetadataToTiramisTransactions1783194327681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" ADD COLUMN IF NOT EXISTS "source_service" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" ADD COLUMN IF NOT EXISTS "source_company_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" ADD COLUMN IF NOT EXISTS "source_user_id" character varying(100)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_transactions_source_company_id" ON "tiramis_transactions" ("source_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_transactions_source_service" ON "tiramis_transactions" ("source_service")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_transactions_source_service"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_transactions_source_company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" DROP COLUMN IF EXISTS "source_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" DROP COLUMN IF EXISTS "source_company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_transactions" DROP COLUMN IF EXISTS "source_service"`,
    );
  }
}
