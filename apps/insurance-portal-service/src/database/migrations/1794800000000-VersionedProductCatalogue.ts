import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Safe UUID cast used when backfilling from legacy varchar actor columns
 * (insurance_products.created_by / updated_by) that are not guaranteed to
 * contain valid UUID values.
 */
const SAFE_UUID_CAST = (column: string) =>
  `CASE WHEN ${column} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN ${column}::uuid ELSE NULL END`;

export class VersionedProductCatalogue1794800000000 implements MigrationInterface {
  name = 'VersionedProductCatalogue1794800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    /*
     * Category and subclass regulatory mappings.
     */
    await queryRunner.query(`
      ALTER TABLE "insurance_categories"
      ADD COLUMN IF NOT EXISTS "tiramis_category_code" character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_categories"
      ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 100
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_sub_classes"
      ADD COLUMN IF NOT EXISTS "tiramis_sub_class_code" character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_sub_classes"
      ADD COLUMN IF NOT EXISTS "cover_type_code" character varying(50)
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_sub_classes"
      ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 100
    `);

    /*
     * Stable product identity.
     */
    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "lifecycle_status" character varying(30) NOT NULL DEFAULT 'DRAFT'
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "latest_version_number" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "current_version_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD COLUMN IF NOT EXISTS "code_locked_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_product_lifecycle_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD CONSTRAINT "CHK_insurance_product_lifecycle_status"
      CHECK ("lifecycle_status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
    `);

    /*
     * Versioned product definition.
     */
    await queryRunner.query(`
      CREATE TABLE "insurance_product_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,

        "version_number" integer NOT NULL,

        "status" character varying(30) NOT NULL DEFAULT 'DRAFT',
        "review_status" character varying(30) NOT NULL DEFAULT 'DRAFT',

        "product_name" character varying(150) NOT NULL,
        "description" text,

        "business_line" insurance_business_line_enum NOT NULL,
        "supports_fleet" boolean NOT NULL DEFAULT false,

        "tiramis_product_code" character varying(50),

        "cover_note_type" integer NOT NULL DEFAULT 1,
        "default_cover_duration_days" integer NOT NULL DEFAULT 365,
        "currency_code" character varying(3) NOT NULL DEFAULT 'TZS',

        "cover_note_description" text,
        "operative_clause" text,
        "policy_operative_clause" text,
        "special_conditions" text,
        "exclusions" text,

        "allows_cover_text_override" boolean NOT NULL DEFAULT false,

        "effective_from" date,
        "effective_to" date,

        "is_submission_ready" boolean NOT NULL DEFAULT false,
        "definition_hash" character varying(64),

        "review_comments" text,
        "submitted_for_review_by" uuid,
        "submitted_for_review_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "published_by" uuid,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "retired_by" uuid,
        "retired_at" TIMESTAMP WITH TIME ZONE,

        "created_by" uuid,
        "updated_by" uuid,

        "metadata" jsonb,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_insurance_product_versions" PRIMARY KEY ("id"),

        CONSTRAINT "UQ_insurance_product_version_number"
          UNIQUE ("product_id", "version_number"),

        CONSTRAINT "FK_product_version_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_product_version_product"
          FOREIGN KEY ("product_id") REFERENCES "insurance_products"("id") ON DELETE CASCADE,

        CONSTRAINT "CHK_product_version_status"
          CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'RETIRED')),

        CONSTRAINT "CHK_product_version_review_status"
          CHECK ("review_status" IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_REVIEW')),

        CONSTRAINT "CHK_product_version_dates"
          CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from"),

        CONSTRAINT "CHK_product_version_cover_duration"
          CHECK ("default_cover_duration_days" BETWEEN 1 AND 3660),

        CONSTRAINT "CHK_product_version_cover_note_type"
          CHECK ("cover_note_type" BETWEEN 1 AND 99)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_product_versions_company"
      ON "insurance_product_versions" ("company_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_product_versions_product_status"
      ON "insurance_product_versions" ("product_id", "status", "effective_from", "effective_to")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_one_editable_draft"
      ON "insurance_product_versions" ("product_id")
      WHERE "status" = 'DRAFT'
    `);

    /*
     * Product definition items (coverages, benefits, conditions, warranties, exclusions).
     */
    await queryRunner.query(`
      CREATE TABLE "product_definition_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "product_version_id" uuid NOT NULL,

        "code" character varying(50) NOT NULL,
        "item_type" character varying(30) NOT NULL,
        "title" character varying(180) NOT NULL,
        "description" text NOT NULL,
        "is_mandatory" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 100,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_product_definition_items" PRIMARY KEY ("id"),

        CONSTRAINT "UQ_product_definition_item_code"
          UNIQUE ("product_version_id", "code"),

        CONSTRAINT "FK_product_definition_item_version"
          FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_product_definition_item_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,

        CONSTRAINT "CHK_product_definition_item_type"
          CHECK ("item_type" IN ('COVERAGE', 'BENEFIT', 'CONDITION', 'WARRANTY', 'EXCLUSION'))
      )
    `);

    /*
     * Approved add-on definitions. Pricing for these add-ons is configured in Phase 7.
     */
    await queryRunner.query(`
      CREATE TABLE "product_addon_definitions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "product_version_id" uuid NOT NULL,

        "code" character varying(50) NOT NULL,
        "tiramis_addon_code" character varying(50),
        "name" character varying(180) NOT NULL,
        "description" text,

        "is_optional" boolean NOT NULL DEFAULT true,
        "is_default_selected" boolean NOT NULL DEFAULT false,
        "allows_separate_sum_insured" boolean NOT NULL DEFAULT false,
        "maximum_quantity" integer,
        "sort_order" integer NOT NULL DEFAULT 100,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_product_addon_definitions" PRIMARY KEY ("id"),

        CONSTRAINT "UQ_product_addon_definition_code"
          UNIQUE ("product_version_id", "code"),

        CONSTRAINT "FK_product_addon_version"
          FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_product_addon_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,

        CONSTRAINT "CHK_product_addon_maximum_quantity"
          CHECK ("maximum_quantity" IS NULL OR "maximum_quantity" > 0)
      )
    `);

    /*
     * Supporting-document definitions.
     */
    await queryRunner.query(`
      CREATE TABLE "product_document_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "product_version_id" uuid NOT NULL,

        "code" character varying(50) NOT NULL,
        "requirement_type" character varying(40) NOT NULL,
        "applies_to" character varying(40) NOT NULL,
        "name" character varying(180) NOT NULL,
        "description" text,
        "is_mandatory" boolean NOT NULL DEFAULT true,
        "accepted_mime_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "maximum_file_size_mb" integer,
        "sort_order" integer NOT NULL DEFAULT 100,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_product_document_requirements" PRIMARY KEY ("id"),

        CONSTRAINT "UQ_product_document_requirement_code"
          UNIQUE ("product_version_id", "code"),

        CONSTRAINT "FK_product_document_requirement_version"
          FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_product_document_requirement_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,

        CONSTRAINT "CHK_product_document_requirement_type"
          CHECK ("requirement_type" IN ('IDENTITY', 'OWNERSHIP', 'FINANCIAL', 'RISK_INFORMATION', 'REGULATORY', 'OTHER')),

        CONSTRAINT "CHK_product_document_requirement_stage"
          CHECK ("applies_to" IN ('QUOTATION', 'APPROVAL', 'PAYMENT', 'POLICY_ISSUANCE', 'CLAIM'))
      )
    `);

    /*
     * Subclasses available under each immutable version (snapshotted).
     */
    await queryRunner.query(`
      CREATE TABLE "product_version_sub_classes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "company_id" uuid NOT NULL,
        "product_version_id" uuid NOT NULL,
        "sub_class_id" uuid NOT NULL,

        "code_snapshot" character varying(50) NOT NULL,
        "name_snapshot" character varying(150) NOT NULL,
        "description_snapshot" text,
        "tiramis_sub_class_code_snapshot" character varying(50),
        "cover_type_code_snapshot" character varying(50),

        "is_default" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 100,

        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

        CONSTRAINT "PK_product_version_sub_classes" PRIMARY KEY ("id"),

        CONSTRAINT "UQ_product_version_sub_class"
          UNIQUE ("product_version_id", "sub_class_id"),

        CONSTRAINT "FK_product_version_sub_class_version"
          FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_product_version_sub_class_identity"
          FOREIGN KEY ("sub_class_id") REFERENCES "insurance_sub_classes"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_product_version_sub_class_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_version_one_default_sub_class"
      ON "product_version_sub_classes" ("product_version_id")
      WHERE "is_default" = true
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      ADD CONSTRAINT "FK_insurance_product_current_version"
      FOREIGN KEY ("current_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE SET NULL
    `);

    /*
     * Backfill existing products as version 1.
     * They remain available for review, but TIRA submission is blocked
     * until the definition is reviewed and republished (review_status
     * starts as REQUIRES_REVIEW, is_submission_ready stays false).
     *
     * insurance_products.company_id/created_by/updated_by are legacy
     * varchar columns that are not guaranteed to hold valid UUID values,
     * so casts use a safe CASE expression instead of a raw ::uuid cast.
     */
    await queryRunner.query(`
      INSERT INTO "insurance_product_versions" (
        "company_id",
        "product_id",
        "version_number",
        "status",
        "review_status",
        "product_name",
        "description",
        "business_line",
        "supports_fleet",
        "tiramis_product_code",
        "cover_note_type",
        "default_cover_duration_days",
        "currency_code",
        "cover_note_description",
        "operative_clause",
        "policy_operative_clause",
        "special_conditions",
        "exclusions",
        "allows_cover_text_override",
        "effective_from",
        "effective_to",
        "is_submission_ready",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at"
      )
      SELECT
        product."company_id"::uuid,
        product."id",
        1,
        CASE WHEN product."is_active" = true THEN 'PUBLISHED' ELSE 'RETIRED' END,
        'REQUIRES_REVIEW',
        product."product_name",
        product."description",
        product."business_line",
        product."supports_fleet",
        COALESCE(product."tiramis_product_code", product."product_code"),
        CASE WHEN product."business_line" = 'MOTOR' THEN 3 ELSE 1 END,
        365,
        'TZS',
        COALESCE(NULLIF(trim(product."description"), ''), product."product_name"),
        product."product_name",
        product."product_name",
        '',
        '',
        true,
        CURRENT_DATE,
        NULL,
        false,
        ${SAFE_UUID_CAST('product."created_by"')},
        ${SAFE_UUID_CAST('product."updated_by"')},
        product."created_at",
        product."updated_at"
      FROM "insurance_products" product
    `);

    await queryRunner.query(`
      UPDATE "insurance_products" product
      SET
        "latest_version_number" = 1,
        "current_version_id" = version."id",
        "lifecycle_status" = CASE WHEN product."is_active" = true THEN 'ACTIVE' ELSE 'RETIRED' END,
        "code_locked_at" = CASE WHEN product."is_active" = true THEN now() ELSE NULL END
      FROM "insurance_product_versions" version
      WHERE version."product_id" = product."id"
        AND version."version_number" = 1
    `);

    await queryRunner.query(`
      INSERT INTO "product_version_sub_classes" (
        "company_id",
        "product_version_id",
        "sub_class_id",
        "code_snapshot",
        "name_snapshot",
        "description_snapshot",
        "tiramis_sub_class_code_snapshot",
        "cover_type_code_snapshot",
        "is_default",
        "sort_order"
      )
      SELECT
        sub_class."company_id"::uuid,
        version."id",
        sub_class."id",
        sub_class."code",
        sub_class."name",
        sub_class."description",
        sub_class."tiramis_sub_class_code",
        sub_class."cover_type_code",
        false,
        sub_class."sort_order"
      FROM "insurance_sub_classes" sub_class
      INNER JOIN "insurance_product_versions" version
        ON version."product_id" = sub_class."product_id"
        AND version."version_number" = 1
      WHERE sub_class."deleted_at" IS NULL
        AND sub_class."is_active" = true
    `);

    /*
     * Quotation product-version snapshot.
     *
     * Cover-note wording (cover_note_desc, operative_clause) already lives
     * on quotation_cover_note_entries; special_conditions/exclusions are
     * product-level legal text served from the snapshot below rather than
     * duplicated per quotation entry.
     */
    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "product_version_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "product_definition_hash" character varying(64)
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "product_definition_snapshot" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      ADD CONSTRAINT "FK_quotation_product_version"
      FOREIGN KEY ("product_version_id") REFERENCES "insurance_product_versions"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      UPDATE "quotations" quotation
      SET
        "product_version_id" = product."current_version_id",
        "product_definition_snapshot" = jsonb_build_object(
          'productId', product."id",
          'productVersionId', version."id",
          'versionNumber', version."version_number",
          'categoryId', category."id",
          'categoryCode', category."code",
          'categoryName', category."name",
          'productCode', product."product_code",
          'productName', version."product_name",
          'businessLine', version."business_line",
          'tiramisProductCode', version."tiramis_product_code",
          'supportsFleet', version."supports_fleet",
          'coverNoteType', version."cover_note_type",
          'coverNoteDescription', version."cover_note_description",
          'operativeClause', version."operative_clause",
          'policyOperativeClause', version."policy_operative_clause",
          'specialConditions', version."special_conditions",
          'exclusions', version."exclusions",
          'allowsCoverTextOverride', version."allows_cover_text_override",
          'definitionItems', '[]'::jsonb,
          'addons', '[]'::jsonb,
          'documentRequirements', '[]'::jsonb,
          'subClasses', '[]'::jsonb
        )
      FROM "insurance_products" product
      INNER JOIN "insurance_product_versions" version
        ON version."id" = product."current_version_id"
      INNER JOIN "insurance_categories" category
        ON category."id" = product."category_id"
      WHERE quotation."product_id" = product."id"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_quotations_product_version"
      ON "quotations" ("product_version_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_quotations_product_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP CONSTRAINT IF EXISTS "FK_quotation_product_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "quotations"
      DROP COLUMN IF EXISTS "product_definition_snapshot",
      DROP COLUMN IF EXISTS "product_definition_hash",
      DROP COLUMN IF EXISTS "product_version_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      DROP CONSTRAINT IF EXISTS "FK_insurance_product_current_version"
    `);

    await queryRunner.query(
      `DROP TABLE IF EXISTS "product_version_sub_classes"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "product_document_requirements"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_addon_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_definition_items"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "insurance_product_versions"`,
    );

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      DROP CONSTRAINT IF EXISTS "CHK_insurance_product_lifecycle_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_products"
      DROP COLUMN IF EXISTS "code_locked_at",
      DROP COLUMN IF EXISTS "current_version_id",
      DROP COLUMN IF EXISTS "latest_version_number",
      DROP COLUMN IF EXISTS "lifecycle_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_sub_classes"
      DROP COLUMN IF EXISTS "sort_order",
      DROP COLUMN IF EXISTS "cover_type_code",
      DROP COLUMN IF EXISTS "tiramis_sub_class_code"
    `);

    await queryRunner.query(`
      ALTER TABLE "insurance_categories"
      DROP COLUMN IF EXISTS "sort_order",
      DROP COLUMN IF EXISTS "tiramis_category_code"
    `);
  }
}
