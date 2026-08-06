import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsuredDataSourceContext1795000000000 implements MigrationInterface {
  name = 'InsuredDataSourceContext1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      ADD COLUMN IF NOT EXISTS "source_customer_id" character varying(100),
      ADD COLUMN IF NOT EXISTS "source_customer_number" character varying(50),
      ADD COLUMN IF NOT EXISTS "source_customer_kyc_status" character varying(30),
      ADD COLUMN IF NOT EXISTS "source_customer_kyc_version" integer,
      ADD COLUMN IF NOT EXISTS "source_customer_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_tiramis_policy_holder_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_asset_manifest_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "source_asset_count" integer
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_source_customer"
      ON "tiramis_transactions" ("source_customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_customer_snapshot_hash"
      ON "tiramis_transactions" ("source_customer_snapshot_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_asset_manifest"
      ON "tiramis_transactions" ("source_asset_manifest_hash")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_asset_manifest"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_customer_snapshot_hash"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tiramis_source_customer"
    `);

    await queryRunner.query(`
      ALTER TABLE "tiramis_transactions"
      DROP COLUMN IF EXISTS "source_asset_count",
      DROP COLUMN IF EXISTS "source_asset_manifest_hash",
      DROP COLUMN IF EXISTS "source_tiramis_policy_holder_hash",
      DROP COLUMN IF EXISTS "source_customer_snapshot_hash",
      DROP COLUMN IF EXISTS "source_customer_kyc_version",
      DROP COLUMN IF EXISTS "source_customer_kyc_status",
      DROP COLUMN IF EXISTS "source_customer_number",
      DROP COLUMN IF EXISTS "source_customer_id"
    `);
  }
}
