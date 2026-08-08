import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDocumentRequirementVersionCompatibility1796306000000 implements MigrationInterface {
  name = 'ProductDocumentRequirementVersionCompatibility1796306000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      ADD COLUMN IF NOT EXISTS "product_version_id" uuid,
      ADD COLUMN IF NOT EXISTS "code" character varying(50),
      ADD COLUMN IF NOT EXISTS "requirement_type" character varying(40),
      ADD COLUMN IF NOT EXISTS "applies_to" character varying(40),
      ADD COLUMN IF NOT EXISTS "name" character varying(180),
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "is_mandatory" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "accepted_mime_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "maximum_file_size_mb" integer,
      ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 100
    `);

    await queryRunner.query(`
      UPDATE "product_document_requirements" requirement
      SET
        "product_version_id" = COALESCE(requirement."product_version_id", product."current_version_id"),
        "code" = COALESCE(
          requirement."code",
          NULLIF(regexp_replace(upper(requirement."document_type"), '[^A-Z0-9]+', '_', 'g'), ''),
          'LEGACY_' || substring(requirement."id"::text from 1 for 8)
        ),
        "requirement_type" = COALESCE(requirement."requirement_type", 'OTHER'),
        "applies_to" = COALESCE(
          requirement."applies_to",
          CASE
            WHEN requirement."is_required_before_quote" THEN 'QUOTATION'
            WHEN requirement."is_required_before_policy" THEN 'POLICY_ISSUANCE'
            WHEN requirement."is_required_before_claim" THEN 'CLAIM'
            ELSE 'APPROVAL'
          END
        ),
        "name" = COALESCE(requirement."name", requirement."document_name"),
        "is_mandatory" = COALESCE(requirement."is_mandatory", requirement."is_required", true),
        "accepted_mime_types" = COALESCE(requirement."accepted_mime_types", '[]'::jsonb),
        "sort_order" = COALESCE(requirement."sort_order", 100)
      FROM "insurance_products" product
      WHERE product."id" = requirement."product_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      ALTER COLUMN "product_id" DROP NOT NULL,
      ALTER COLUMN "document_type" DROP NOT NULL,
      ALTER COLUMN "document_name" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      DROP CONSTRAINT IF EXISTS "FK_product_document_requirement_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      ADD CONSTRAINT "FK_product_document_requirement_version"
      FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      DROP CONSTRAINT IF EXISTS "UQ_product_document_requirement_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      ADD CONSTRAINT "UQ_product_document_requirement_code"
      UNIQUE ("product_version_id", "code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      DROP CONSTRAINT IF EXISTS "UQ_product_document_requirement_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      DROP CONSTRAINT IF EXISTS "FK_product_document_requirement_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "product_document_requirements"
      DROP COLUMN IF EXISTS "sort_order",
      DROP COLUMN IF EXISTS "maximum_file_size_mb",
      DROP COLUMN IF EXISTS "accepted_mime_types",
      DROP COLUMN IF EXISTS "is_mandatory",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "name",
      DROP COLUMN IF EXISTS "applies_to",
      DROP COLUMN IF EXISTS "requirement_type",
      DROP COLUMN IF EXISTS "code",
      DROP COLUMN IF EXISTS "product_version_id"
    `);
  }
}
