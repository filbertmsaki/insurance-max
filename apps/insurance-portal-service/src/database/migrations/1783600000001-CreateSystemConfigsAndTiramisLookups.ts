import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemConfigsAndTiramisLookups1783600000001 implements MigrationInterface {
  name = 'CreateSystemConfigsAndTiramisLookups1783600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "config_key" character varying(120) NOT NULL,
        "config_value" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_system_configs_key" UNIQUE ("config_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_lookups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "group_code" character varying(80) NOT NULL,
        "code" character varying(50) NOT NULL,
        "label" character varying(150) NOT NULL,
        "description" text,
        "metadata" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_lookups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_lookups_group_code" UNIQUE ("group_code", "code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_lookups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_configs"`);
  }
}
