import { ensureFinanceUuidV4 } from '../finance-uuid-v4';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive, empty draft structures. No Company mapping, seeds or permissions. */
export class FinanceScopeFoundations1796000000000 implements MigrationInterface {
  name = 'FinanceScopeFoundations1796000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await ensureFinanceUuidV4(queryRunner);
    await queryRunner.query(`CREATE TABLE "finance_legal_entities" (
      "id" uuid NOT NULL DEFAULT public.finance_uuid_v4(), "tenant_id" uuid NOT NULL,
      "entity_code" varchar(50) NOT NULL, "legal_name" varchar(200) NOT NULL,
      "business_profile" varchar(50) NOT NULL, "jurisdiction_code" varchar(50),
      "state" varchar(10) NOT NULL DEFAULT 'DRAFT',
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_entity" PRIMARY KEY ("id"),
      CONSTRAINT "CK_fin_entity_state" CHECK ("state" IN ('DRAFT', 'DISABLED')),
      CONSTRAINT "CK_fin_entity_code" CHECK (btrim("entity_code") <> '' AND "entity_code" = btrim("entity_code")),
      CONSTRAINT "CK_fin_entity_profile" CHECK (btrim("business_profile") <> ''),
      CONSTRAINT "CK_fin_entity_name" CHECK (btrim("legal_name") <> '')
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_entity_scope" ON "finance_legal_entities" ("tenant_id", "id")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_entity_code" ON "finance_legal_entities" ("tenant_id", "entity_code")',
    );
    await queryRunner.query(`CREATE TABLE "finance_accounting_books" (
      "id" uuid NOT NULL DEFAULT public.finance_uuid_v4(), "tenant_id" uuid NOT NULL, "legal_entity_id" uuid NOT NULL,
      "book_code" varchar(50) NOT NULL, "state" varchar(10) NOT NULL DEFAULT 'DRAFT',
      "accounting_basis_code" varchar(50), "functional_assessment_id" uuid,
      "calendar_id" uuid, "chart_release_id" uuid, "presentation_context_id" uuid,
      "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_book" PRIMARY KEY ("id"),
      CONSTRAINT "CK_fin_book_state" CHECK ("state" IN ('DRAFT', 'DISABLED')),
      CONSTRAINT "CK_fin_book_code" CHECK (btrim("book_code") <> '' AND "book_code" = btrim("book_code")),
      CONSTRAINT "FK_fin_book_entity" FOREIGN KEY ("tenant_id", "legal_entity_id")
        REFERENCES "finance_legal_entities" ("tenant_id", "id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_book_scope" ON "finance_accounting_books" ("tenant_id", "legal_entity_id", "id")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_book_code" ON "finance_accounting_books" ("tenant_id", "legal_entity_id", "book_code")',
    );
    await queryRunner.query(`CREATE TABLE "finance_scope_memberships" (
      "id" uuid NOT NULL DEFAULT public.finance_uuid_v4(), "tenant_id" uuid NOT NULL,
      "legal_entity_id" uuid NOT NULL, "book_id" uuid NOT NULL, "subject_id" uuid NOT NULL,
      "subject_kind" varchar(10) NOT NULL, "state" varchar(12) NOT NULL DEFAULT 'DRAFT',
      "permission" varchar(20) NOT NULL DEFAULT 'READ_DRAFT', "authority_reference" varchar(200) NOT NULL,
      "valid_from" timestamptz NOT NULL, "valid_to" timestamptz, "revoked_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_member" PRIMARY KEY ("id"),
      CONSTRAINT "CK_fin_member_kind" CHECK ("subject_kind" IN ('USER', 'WORKER')),
      CONSTRAINT "CK_fin_member_state" CHECK ("state" IN ('DRAFT', 'ENABLED', 'REVOKED')),
      CONSTRAINT "CK_fin_member_permission" CHECK ("permission" = 'READ_DRAFT'),
      CONSTRAINT "CK_fin_member_interval" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from"),
      CONSTRAINT "CK_fin_member_authority" CHECK (btrim("authority_reference") <> ''),
      CONSTRAINT "FK_fin_member_book" FOREIGN KEY ("tenant_id", "legal_entity_id", "book_id")
        REFERENCES "finance_accounting_books" ("tenant_id", "legal_entity_id", "id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_fin_scope_subject" ON "finance_scope_memberships" ("tenant_id", "subject_kind", "subject_id", "legal_entity_id", "book_id")',
    );
    await queryRunner.query(`CREATE TABLE "finance_legal_entity_source_maps" (
      "id" uuid NOT NULL DEFAULT public.finance_uuid_v4(), "tenant_id" uuid NOT NULL, "legal_entity_id" uuid NOT NULL,
      "source_system" varchar(50) NOT NULL, "source_company_id" varchar(200) NOT NULL,
      "legal_role" varchar(50) NOT NULL, "business_profile" varchar(50) NOT NULL,
      "mapping_version" integer NOT NULL, "valid_from" date NOT NULL, "valid_to" date,
      "state" varchar(10) NOT NULL DEFAULT 'DRAFT', "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_fin_source" PRIMARY KEY ("id"),
      CONSTRAINT "CK_fin_source_state" CHECK ("state" = 'DRAFT'),
      CONSTRAINT "CK_fin_source_version" CHECK ("mapping_version" > 0),
      CONSTRAINT "CK_fin_source_interval" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from"),
      CONSTRAINT "CK_fin_source_fields" CHECK (btrim("source_system") <> '' AND btrim("source_company_id") <> '' AND btrim("legal_role") <> '' AND btrim("business_profile") <> ''),
      CONSTRAINT "FK_fin_source_entity" FOREIGN KEY ("tenant_id", "legal_entity_id")
        REFERENCES "finance_legal_entities" ("tenant_id", "id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_fin_source_version" ON "finance_legal_entity_source_maps" ("tenant_id", "legal_entity_id", "source_system", "source_company_id", "legal_role", "mapping_version")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [usage] = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM "finance_legal_entities" UNION ALL
      SELECT 1 FROM "finance_accounting_books" UNION ALL
      SELECT 1 FROM "finance_scope_memberships" UNION ALL
      SELECT 1 FROM "finance_legal_entity_source_maps"
    ) AS "in_use"`);
    if (usage.in_use)
      throw new Error(
        'Finance scope rollback requires empty draft structures; retain and review existing records.',
      );
    // No CASCADE: unexpected dependent records must stop a rollback.
    await queryRunner.query('DROP TABLE "finance_legal_entity_source_maps"');
    await queryRunner.query('DROP TABLE "finance_scope_memberships"');
    await queryRunner.query('DROP TABLE "finance_accounting_books"');
    await queryRunner.query('DROP TABLE "finance_legal_entities"');
  }
}
