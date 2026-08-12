import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalReferenceData1786521549519 implements MigrationInterface {
  name = 'GlobalReferenceData1786521549519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reference_countries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "iso2_code" character varying(2),
        "iso3_code" character varying(3) NOT NULL,
        "phone_code" character varying(20),
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reference_countries" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reference_regions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "country_id" uuid NOT NULL,
        "code" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reference_regions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reference_districts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "region_id" uuid NOT NULL,
        "code" character varying(80) NOT NULL,
        "name" character varying(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reference_districts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reference_currencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "code" character varying(10) NOT NULL,
        "symbol" character varying(12),
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reference_currencies" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_countries_iso3" ON "reference_countries" ("iso3_code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_countries_name" ON "reference_countries" ("name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reference_regions_country" ON "reference_regions" ("country_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_regions_country_code" ON "reference_regions" ("country_id", "code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_regions_country_name" ON "reference_regions" ("country_id", "name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reference_districts_region" ON "reference_districts" ("region_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_districts_region_code" ON "reference_districts" ("region_id", "code") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_districts_region_name" ON "reference_districts" ("region_id", "name") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reference_currencies_code" ON "reference_currencies" ("code") WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reference_regions_country'
        ) THEN
          ALTER TABLE "reference_regions"
          ADD CONSTRAINT "FK_reference_regions_country"
          FOREIGN KEY ("country_id") REFERENCES "reference_countries"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reference_districts_region'
        ) THEN
          ALTER TABLE "reference_districts"
          ADD CONSTRAINT "FK_reference_districts_region"
          FOREIGN KEY ("region_id") REFERENCES "reference_regions"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reference_districts" DROP CONSTRAINT IF EXISTS "FK_reference_districts_region"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reference_regions" DROP CONSTRAINT IF EXISTS "FK_reference_regions_country"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_districts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_regions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_currencies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_countries"`);
  }
}
