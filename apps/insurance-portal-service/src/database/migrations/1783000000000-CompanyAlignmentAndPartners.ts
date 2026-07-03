import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyAlignmentAndPartners1783000000000
  implements MigrationInterface
{
  name = 'CompanyAlignmentAndPartners1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."companies_company_type_enum" AS ENUM(
          'INSURANCE_COMPANY',
          'REINSURANCE_COMPANY',
          'BROKER',
          'AGENCY',
          'BANCASSURANCE',
          'SERVICE_PROVIDER'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "company_type" "public"."companies_company_type_enum" NOT NULL DEFAULT 'INSURANCE_COMPANY',
      ADD COLUMN IF NOT EXISTS "tira_license_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "tira_license_status" character varying(30),
      ADD COLUMN IF NOT EXISTS "license_issued_at" date,
      ADD COLUMN IF NOT EXISTS "license_expires_at" date,
      ADD COLUMN IF NOT EXISTS "tin" character varying(100),
      ADD COLUMN IF NOT EXISTS "brela_registration_number" character varying(100),
      ADD COLUMN IF NOT EXISTS "regulatory_metadata" jsonb,
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."insurance_company_partners_partner_type_enum" AS ENUM(
          'REINSURANCE_COMPANY',
          'BROKER',
          'AGENCY',
          'BANCASSURANCE',
          'SERVICE_PROVIDER'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."insurance_company_partners_status_enum" AS ENUM(
          'PENDING',
          'ACTIVE',
          'SUSPENDED',
          'TERMINATED',
          'EXPIRED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "insurance_company_partners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "insurer_company_id" uuid NOT NULL,
        "intermediary_company_id" uuid NOT NULL,
        "partner_type" "public"."insurance_company_partners_partner_type_enum" NOT NULL,
        "status" "public"."insurance_company_partners_status_enum" NOT NULL DEFAULT 'PENDING',
        "commission_rate" numeric(5,2),
        "start_date" date,
        "end_date" date,
        "agreement_reference" character varying(100),
        "agreement_document_url" character varying(500),
        "approved_by" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "suspension_reason" text,
        "termination_reason" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_insurance_company_partners" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_current_agency_one_insurer"
      ON "insurance_company_partners" ("intermediary_company_id")
      WHERE partner_type = 'AGENCY'
        AND deleted_at IS NULL
        AND status IN ('PENDING', 'ACTIVE', 'SUSPENDED')
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_insurance_partner_company"
      ON "insurance_company_partners" ("intermediary_company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_insurance_partner_insurer"
      ON "insurance_company_partners" ("insurer_company_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      ADD CONSTRAINT "FK_insurance_company_partners_insurer_company"
      FOREIGN KEY ("insurer_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      ADD CONSTRAINT "FK_insurance_company_partners_intermediary_company"
      FOREIGN KEY ("intermediary_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      DROP CONSTRAINT "FK_insurance_company_partners_intermediary_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      DROP CONSTRAINT "FK_insurance_company_partners_insurer_company"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_insurance_partner_insurer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_insurance_partner_company"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_current_agency_one_insurer"`);
    await queryRunner.query(`DROP TABLE "insurance_company_partners"`);
    await queryRunner.query(
      `DROP TYPE "public"."insurance_company_partners_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."insurance_company_partners_partner_type_enum"`,
    );

    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "deleted_at",
      DROP COLUMN IF EXISTS "regulatory_metadata",
      DROP COLUMN IF EXISTS "brela_registration_number",
      DROP COLUMN IF EXISTS "tin",
      DROP COLUMN IF EXISTS "license_expires_at",
      DROP COLUMN IF EXISTS "license_issued_at",
      DROP COLUMN IF EXISTS "tira_license_status",
      DROP COLUMN IF EXISTS "tira_license_number",
      DROP COLUMN IF EXISTS "company_type"
    `);
    await queryRunner.query(`DROP TYPE "public"."companies_company_type_enum"`);
  }
}
