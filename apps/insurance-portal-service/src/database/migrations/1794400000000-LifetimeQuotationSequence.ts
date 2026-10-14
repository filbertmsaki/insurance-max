import { MigrationInterface, QueryRunner } from 'typeorm';

export class LifetimeQuotationSequence1794400000000 implements MigrationInterface {
  name = 'LifetimeQuotationSequence1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH stored_numbers AS (
        SELECT "company_id", "quotation_no" AS value FROM "quotations"
        UNION ALL
        SELECT "company_id", "identifier_value" AS value
        FROM "generated_identifiers"
        WHERE "identifier_type" = 'QUOTATION'
      ), parsed_numbers AS (
        SELECT n."company_id",
          CASE
            WHEN left(n.value, length(c."identifier_prefix")) = c."identifier_prefix"
              AND substring(n.value FROM length(c."identifier_prefix") + 1 FOR 6) ~ '^[0-9]{6}$'
              AND substring(n.value FROM length(c."identifier_prefix") + 7) ~ '^[0-9]{3,10}$'
            THEN substring(n.value FROM length(c."identifier_prefix") + 7)::bigint
            WHEN left(n.value, length(c."identifier_prefix") + 5) = c."identifier_prefix" || '-QTN-'
              AND substring(n.value FROM length(c."identifier_prefix") + 6 FOR 6) ~ '^[0-9]{6}$'
              AND substring(n.value FROM length(c."identifier_prefix") + 12 FOR 1) = '-'
              AND substring(n.value FROM length(c."identifier_prefix") + 13) ~ '^[0-9]{3,10}$'
            THEN substring(n.value FROM length(c."identifier_prefix") + 13)::bigint
          END AS value
        FROM stored_numbers n
        JOIN "companies" c ON c."id" = n."company_id"
        WHERE c."identifier_prefix" IS NOT NULL
      ), historical_values AS (
        SELECT "company_id", "current_value"::bigint AS value
        FROM "identifier_sequences"
        WHERE "identifier_type" = 'QUOTATION'
        UNION ALL
        SELECT "company_id", value FROM parsed_numbers WHERE value IS NOT NULL
      ), maxima AS (
        SELECT "company_id", MAX(value) AS value
        FROM historical_values
        GROUP BY "company_id"
      )
      INSERT INTO "identifier_sequences" (
        "company_id", "identifier_type", "sequence_date",
        "sequence_time_bucket", "current_value"
      )
      SELECT "company_id", 'QUOTATION', 'LIFETIME', '', value
      FROM maxima
      ON CONFLICT ("company_id", "identifier_type", "sequence_date", "sequence_time_bucket")
      DO UPDATE SET "current_value" = GREATEST(
        "identifier_sequences"."current_value", EXCLUDED."current_value"
      ), "updated_at" = NOW()
    `);
  }

  public async down(): Promise<void> {
    // Keep the lifetime counter: removing it could reuse an issued number.
  }
}
