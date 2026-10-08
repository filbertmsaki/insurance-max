import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemApiKeyHashesAndIps1791800000000 implements MigrationInterface {
  name = 'AddSystemApiKeyHashesAndIps1791800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD "api_key_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD "allowed_ips" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ADD "system_key" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "tiramis_api_keys" SET "api_key_hash" = encode(digest("api_key", 'sha256'), 'hex') WHERE "api_key" IS NOT NULL`,
    );
    // Preserve existing callers through the key-hash migration. They remain
    // active, but fail closed on IP until an administrator registers egress IPs.
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ALTER COLUMN "api_key" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tiramis_api_keys_api_key_hash" ON "tiramis_api_keys" ("api_key_hash") WHERE "api_key_hash" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tiramis_api_keys_one_active_per_system" ON "tiramis_api_keys" ("service_name") WHERE "system_key" = true AND "is_active" = true AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_api_keys_api_key"`,
    );
    await queryRunner.query(`UPDATE "tiramis_api_keys" SET "api_key" = NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_tiramis_api_keys_one_active_per_system"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_api_keys_api_key_hash"`,
    );
    // Raw secrets cannot be reconstructed from the hashes. Rollback retains
    // the hashed credential column so existing clients are not silently locked out.
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" ALTER COLUMN "api_key" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP COLUMN "allowed_ips"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_api_keys" DROP COLUMN "system_key"`,
    );
  }
}
