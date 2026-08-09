import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlainTiramisApiKeys1795700000000 implements MigrationInterface {
  name = 'PlainTiramisApiKeys1795700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      DROP COLUMN IF EXISTS "tenant_company_id"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tiramis_api_keys'
            AND column_name = 'key_hash'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tiramis_api_keys'
            AND column_name = 'api_key'
        ) THEN
          ALTER TABLE "tiramis_api_keys" RENAME COLUMN "key_hash" TO "api_key";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      ALTER COLUMN "api_key" TYPE varchar(255)
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_api_keys_key_hash"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tiramis_api_keys_api_key"
      ON "tiramis_api_keys" ("api_key")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_api_keys_api_key"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tiramis_api_keys'
            AND column_name = 'api_key'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'tiramis_api_keys'
            AND column_name = 'key_hash'
        ) THEN
          ALTER TABLE "tiramis_api_keys" RENAME COLUMN "api_key" TO "key_hash";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "tiramis_api_keys"
      ADD COLUMN IF NOT EXISTS "tenant_company_id" varchar(100)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tiramis_api_keys_key_hash"
      ON "tiramis_api_keys" ("key_hash")
    `);
  }
}
