import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTiramisApiKeys1795500000000 implements MigrationInterface {
  name = 'CreateTiramisApiKeys1795500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "api_key" varchar(255) NOT NULL,
        "key_prefix" varchar(24),
        "service_name" varchar(120) NOT NULL,
        "scopes" text,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "expires_at" timestamptz,
        "last_used_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_api_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tiramis_api_keys_api_key"
      ON "tiramis_api_keys" ("api_key")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_api_keys_service_name"
      ON "tiramis_api_keys" ("service_name")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_api_key_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "api_key_id" uuid,
        "action" varchar(60) NOT NULL,
        "outcome" varchar(30) NOT NULL,
        "service_name" varchar(120),
        "request_id" varchar(128),
        "ip_address" varchar(80),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_api_key_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_api_key_audit_key_created"
      ON "tiramis_api_key_audit_logs" ("api_key_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_api_key_audit_key_created"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tiramis_api_key_audit_logs"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_api_keys_service_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_api_keys_api_key"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_api_keys"`);
  }
}
