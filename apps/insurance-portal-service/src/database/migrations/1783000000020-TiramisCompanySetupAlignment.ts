import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisCompanySetupAlignment1783000000020 implements MigrationInterface {
  name = 'TiramisCompanySetupAlignment1783000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "tira_company_code" character varying(30),
      ADD COLUMN IF NOT EXISTS "tira_insurer_company_code" character varying(30),
      ADD COLUMN IF NOT EXISTS "tira_client_code" character varying(60),
      ADD COLUMN IF NOT EXISTS "tira_system_code" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_system_name" character varying(150)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_companies_tira_company_code"
      ON "companies" ("tira_company_code")
      WHERE "tira_company_code" IS NOT NULL
        AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_company_configurations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "environment" character varying(20) NOT NULL DEFAULT 'test',
        "company_code" character varying(30) NOT NULL,
        "company_name" character varying(150),
        "insurer_company_code" character varying(30),
        "insurer_company_name" character varying(150),
        "client_code" character varying(60),
        "client_key" character varying(255),
        "system_code" character varying(100),
        "system_name" character varying(150),
        "base_url" character varying(500),
        "callback_url" character varying(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_company_configurations"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_company_config_company_environment"
          UNIQUE ("company_id", "environment"),
        CONSTRAINT "FK_tiramis_company_config_company"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_company_config_company_id"
      ON "tiramis_company_configurations" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_company_config_environment"
      ON "tiramis_company_configurations" ("environment")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_company_config_company_code"
      ON "tiramis_company_configurations" ("company_code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_sale_points" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "branch_code" character varying(50),
        "branch_name" character varying(120),
        "sale_point_code" character varying(50) NOT NULL,
        "sale_point_name" character varying(120),
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_sale_points"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_sale_points_company_sale_point"
          UNIQUE ("company_id", "sale_point_code"),
        CONSTRAINT "FK_tiramis_sale_points_company"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_tiramis_sale_points_branch"
          FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_sale_points_company_id"
      ON "tiramis_sale_points" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_sale_points_branch_id"
      ON "tiramis_sale_points" ("branch_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tiramis_sale_points_sale_point_code"
      ON "tiramis_sale_points" ("sale_point_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_sale_points"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tiramis_company_configurations"`,
    );

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."UQ_companies_tira_company_code"
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "tira_system_name",
      DROP COLUMN IF EXISTS "tira_system_code",
      DROP COLUMN IF EXISTS "tira_client_code",
      DROP COLUMN IF EXISTS "tira_insurer_company_code",
      DROP COLUMN IF EXISTS "tira_company_code"
    `);
  }
}
