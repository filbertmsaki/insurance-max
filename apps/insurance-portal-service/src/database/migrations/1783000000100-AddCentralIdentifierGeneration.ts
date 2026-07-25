import { MigrationInterface, QueryRunner } from 'typeorm';

type CompanyRow = {
  id: string;
  name: string;
  identifier_prefix: string | null;
};

type ExistingIdentifierRow = {
  identifier_value: string;
  company_id: string;
  identifier_type: string;
  related_entity_type: string;
  related_entity_id: string;
};

export class AddCentralIdentifierGeneration1783000000100 implements MigrationInterface {
  name = 'AddCentralIdentifierGeneration1783000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "identifier_prefix" varchar(20)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_companies_identifier_prefix"
      ON "companies" ("identifier_prefix")
      WHERE "identifier_prefix" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "identifier_sequences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "identifier_type" varchar(40) NOT NULL,
        "sequence_date" varchar(8) NOT NULL,
        "sequence_time_bucket" varchar(6),
        "current_value" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_identifier_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_identifier_sequences_scope" UNIQUE (
          "company_id",
          "identifier_type",
          "sequence_date",
          "sequence_time_bucket"
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generated_identifiers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "identifier_type" varchar(40) NOT NULL,
        "identifier_value" varchar(150) NOT NULL,
        "company_id" uuid NOT NULL,
        "related_entity_type" varchar(120),
        "related_entity_id" varchar(120),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generated_identifiers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_generated_identifiers_value" UNIQUE ("identifier_value"),
        CONSTRAINT "UQ_generated_identifiers_scope" UNIQUE (
          "identifier_type",
          "related_entity_type",
          "related_entity_id"
        )
      )
    `);

    await this.backfillCompanyPrefixes(queryRunner);
    await this.backfillRegistry(queryRunner);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_quotations_quotation_no"
      ON "quotations" ("quotation_no")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_portal_tira_submissions_request_id"
      ON "portal_tira_submissions" ("tiramis_request_id")
      WHERE "tiramis_request_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_portal_tira_submissions_request_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_quotations_quotation_no"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "generated_identifiers"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "identifier_sequences"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_companies_identifier_prefix"
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "identifier_prefix"
    `);
  }

  private async backfillCompanyPrefixes(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const companies = (await queryRunner.query(
      `
        SELECT id, name, identifier_prefix
        FROM companies
        ORDER BY created_at ASC
      `,
    )) as CompanyRow[];

    const used = new Set<string>();
    for (const company of companies) {
      if (company.identifier_prefix) {
        used.add(company.identifier_prefix);
      }
    }

    for (const company of companies) {
      if (company.identifier_prefix) {
        continue;
      }

      const base = this.derivePrefix(company.name);
      if (!base) {
        continue;
      }

      let suffix = 0;
      let candidate = base;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${base}${String(suffix).padStart(2, '0')}`;
      }

      used.add(candidate);
      await queryRunner.query(
        `UPDATE companies SET identifier_prefix = $1 WHERE id = $2`,
        [candidate, company.id],
      );
    }
  }

  private async backfillRegistry(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `
        SELECT
          id::text AS related_entity_id,
          company_id::text AS company_id,
          'QUOTATION' AS identifier_type,
          quotation_no AS identifier_value,
          'quotations' AS related_entity_type
        FROM quotations
        WHERE quotation_no IS NOT NULL

        UNION ALL

        SELECT
          entry.id::text AS related_entity_id,
          quotation.company_id::text AS company_id,
          'COVER_NOTE' AS identifier_type,
          entry.cover_note_number AS identifier_value,
          'quotation_cover_note_entries' AS related_entity_type
        FROM quotation_cover_note_entries entry
        INNER JOIN quotation_cover_notes cover_note
          ON cover_note.id = entry.cover_note_id
        INNER JOIN quotations quotation
          ON quotation.id = cover_note.quotation_id
        WHERE entry.cover_note_number IS NOT NULL

        UNION ALL

        SELECT
          id::text AS related_entity_id,
          company_id::text AS company_id,
          'TIRAMIS_REQUEST' AS identifier_type,
          tiramis_request_id AS identifier_value,
          'portal_tira_submissions' AS related_entity_type
        FROM portal_tira_submissions
        WHERE tiramis_request_id IS NOT NULL
      `,
    )) as ExistingIdentifierRow[];

    for (const row of rows) {
      await queryRunner.query(
        `
          INSERT INTO generated_identifiers (
            identifier_type,
            identifier_value,
            company_id,
            related_entity_type,
            related_entity_id
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT ("identifier_value") DO NOTHING
        `,
        [
          row.identifier_type,
          row.identifier_value,
          row.company_id,
          row.related_entity_type,
          row.related_entity_id,
        ],
      );
    }
  }

  private derivePrefix(companyName: string): string {
    return companyName
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean)
      .map((word) => word[0].toUpperCase())
      .join('')
      .replace(/[^A-Z0-9]/g, '');
  }
}
