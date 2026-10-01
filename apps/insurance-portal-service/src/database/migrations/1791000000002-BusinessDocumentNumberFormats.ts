import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-company number formats for business documents (claims, vouchers,
 * payments...). BusinessReferenceService uses a company's format when one
 * exists and falls back to the prefix hard-coded by the caller otherwise,
 * so existing numbering is unchanged until a company configures one.
 */
export class BusinessDocumentNumberFormats1791000000002 implements MigrationInterface {
  name = 'BusinessDocumentNumberFormats1791000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_document_number_formats" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_type" varchar(60) NOT NULL,
        "prefix" varchar(40) NOT NULL,
        "sequence_length" integer NOT NULL DEFAULT 5,
        "created_by" uuid NULL,
        "updated_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_business_document_number_formats_company_type"
          UNIQUE ("company_id", "document_type"),
        CONSTRAINT "chk_business_document_number_formats_length"
          CHECK ("sequence_length" BETWEEN 3 AND 10)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_document_number_formats"`,
    );
  }
}
