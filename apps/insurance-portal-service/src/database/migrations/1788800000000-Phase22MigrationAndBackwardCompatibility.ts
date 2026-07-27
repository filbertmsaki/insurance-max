import { MigrationInterface, QueryRunner } from 'typeorm';

interface LegacyRateColumn {
  table: string;
  column: string;
  description: string;
}

export class Phase22MigrationAndBackwardCompatibility1788800000000
  implements MigrationInterface
{
  name = 'Phase22MigrationAndBackwardCompatibility1788800000000';

  private readonly phaseCode = 'PHASE_22';

  private readonly reviewTable = 'pricing_migration_review_queue';

  private readonly reviewView = 'pricing_migration_phase22_report';

  private readonly rateColumns: LegacyRateColumn[] = [
    {
      table: 'risk_rating_rules',
      column: 'percentage_rate',
      description: 'rating percentage rate',
    },
    {
      table: 'risk_rating_rules',
      column: 'max_discount_rate',
      description: 'maximum discount rate',
    },
    {
      table: 'risk_rating_rules',
      column: 'discount_approval_threshold_rate',
      description: 'discount approval threshold rate',
    },
    {
      table: 'risk_rating_rules',
      column: 'max_loading_rate',
      description: 'maximum loading rate',
    },
    {
      table: 'risk_rating_rules',
      column: 'loading_approval_threshold_rate',
      description: 'loading approval threshold rate',
    },
    {
      table: 'product_tax_rules',
      column: 'tax_rate',
      description: 'product tax rate',
    },
    {
      table: 'product_commission_rules',
      column: 'commission_rate',
      description: 'product commission rate',
    },
    {
      table: 'insurance_company_partners',
      column: 'commission_rate',
      description: 'partner commission rate',
    },
    {
      table: 'commission_transactions',
      column: 'commission_rate',
      description: 'commission transaction rate',
    },
    {
      table: 'quotation_cover_notes',
      column: 'commission_rate',
      description: 'quotation commission rate',
    },
    {
      table: 'quotation_entry_risks',
      column: 'premium_rate',
      description: 'quotation premium rate',
    },
    {
      table: 'quotation_risk_discounts',
      column: 'discount_rate',
      description: 'quotation discount rate',
    },
    {
      table: 'quotation_risk_taxes',
      column: 'tax_rate',
      description: 'quotation tax rate',
    },
    {
      table: 'quotation_entry_addons',
      column: 'addon_premium_rate',
      description: 'quotation addon premium rate',
    },
    {
      table: 'quotation_entry_addon_taxes',
      column: 'tax_rate',
      description: 'quotation addon tax rate',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createReviewInfrastructure(queryRunner);

    for (const spec of this.rateColumns) {
      await this.normalizeLegacyRateColumn(queryRunner, spec);
      await this.flagInvalidRateValues(queryRunner, spec);
    }

    await this.backfillSafeSnapshotMetadata(queryRunner);
    await this.flagQuotationPricingCompatibilityGaps(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP VIEW IF EXISTS "${this.reviewView}"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "${this.reviewTable}"`,
    );
  }

  private async createReviewInfrastructure(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${this.reviewTable}" (
        "id" bigserial PRIMARY KEY,
        "phase" varchar(50) NOT NULL,
        "source_table" varchar(100) NOT NULL,
        "source_record_id" varchar(100) NOT NULL,
        "company_id" varchar(100),
        "quotation_id" varchar(100),
        "pricing_quote_id" varchar(30),
        "issue_code" varchar(100) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'REVIEW',
        "issue_summary" text NOT NULL,
        "current_values" jsonb,
        "suggested_action" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz,
        "resolution_note" text,
        CONSTRAINT "UQ_pmrv_issue"
          UNIQUE ("phase", "source_table", "source_record_id", "issue_code")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pmrv_phase_issue"
      ON "${this.reviewTable}" ("phase", "issue_code")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pmrv_company_id"
      ON "${this.reviewTable}" ("company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pmrv_quotation_id"
      ON "${this.reviewTable}" ("quotation_id")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW "${this.reviewView}" AS
      SELECT
        "phase",
        "issue_code",
        "severity",
        COUNT(*)::bigint AS "record_count",
        MIN("created_at") AS "first_detected_at",
        MAX("created_at") AS "last_detected_at"
      FROM "${this.reviewTable}"
      WHERE "phase" = '${this.phaseCode}'
        AND "resolved_at" IS NULL
      GROUP BY "phase", "issue_code", "severity"
      ORDER BY "issue_code"
    `);
  }

  private async normalizeLegacyRateColumn(
    queryRunner: QueryRunner,
    spec: LegacyRateColumn,
  ): Promise<void> {
    await queryRunner.query(`
      UPDATE "${spec.table}"
      SET "${spec.column}" = "${spec.column}" / 100
      WHERE "${spec.column}" IS NOT NULL
        AND "${spec.column}" > 1
        AND "${spec.column}" <= 100
    `);
  }

  private async flagInvalidRateValues(
    queryRunner: QueryRunner,
    spec: LegacyRateColumn,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        '${spec.table}',
        "id"::text,
        'INVALID_DECIMAL_RATE_RANGE',
        'REVIEW',
        'The ${spec.description} is outside the supported decimal-fraction range after compatibility normalization.',
        jsonb_build_object('${spec.column}', "${spec.column}"),
        'Review the legacy rate value and correct it manually instead of guessing in migration.'
      FROM "${spec.table}"
      WHERE "${spec.column}" IS NOT NULL
        AND ("${spec.column}" < 0 OR "${spec.column}" > 1)
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);
  }

  private async backfillSafeSnapshotMetadata(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      UPDATE "pricing_quotes" AS pq
      SET "rate_book_version" = prb."version"
      FROM "pricing_rate_books" AS prb
      WHERE pq."rate_book_id" = prb."id"
        AND pq."rate_book_version" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "pricing_quotes" AS pq
      SET "matched_rule_version" = rrr."rule_version"
      FROM "risk_rating_rules" AS rrr
      WHERE pq."matched_rule_id" = rrr."id"
        AND pq."matched_rule_version" IS NULL
    `);
  }

  private async flagQuotationPricingCompatibilityGaps(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "quotation_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'quotation_entry_risks',
        qer."id"::text,
        q."company_id"::text,
        q."id"::text,
        'MISSING_PRICING_QUOTE_REFERENCE',
        'REVIEW',
        'The quotation risk does not reference a pricing quote snapshot.',
        jsonb_build_object(
          'risk_code', qer."risk_code",
          'premium_before_discount', qer."premium_before_discount",
          'premium_after_discount', qer."premium_after_discount",
          'premium_including_tax', qer."premium_including_tax"
        ),
        'Recalculate pricing for the quotation risk and save a trusted pricing quote reference.'
      FROM "quotation_entry_risks" AS qer
      INNER JOIN "quotation_cover_note_entries" AS qce
        ON qce."id" = qer."entry_id"
      INNER JOIN "quotation_cover_notes" AS qcn
        ON qcn."id" = qce."cover_note_id"
      INNER JOIN "quotations" AS q
        ON q."id" = qcn."quotation_id"
      WHERE q."deleted_at" IS NULL
        AND qer."pricing_quote_id" IS NULL
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "quotation_id",
        "pricing_quote_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'quotation_entry_risks',
        qer."id"::text,
        q."company_id"::text,
        q."id"::text,
        qer."pricing_quote_id",
        'ORPHAN_PRICING_QUOTE_REFERENCE',
        'REVIEW',
        'The quotation risk references a pricing quote that is missing or soft deleted.',
        jsonb_build_object(
          'risk_code', qer."risk_code",
          'pricing_quote_id', qer."pricing_quote_id"
        ),
        'Recalculate the quotation risk and attach a current pricing quote snapshot.'
      FROM "quotation_entry_risks" AS qer
      INNER JOIN "quotation_cover_note_entries" AS qce
        ON qce."id" = qer."entry_id"
      INNER JOIN "quotation_cover_notes" AS qcn
        ON qcn."id" = qce."cover_note_id"
      INNER JOIN "quotations" AS q
        ON q."id" = qcn."quotation_id"
      LEFT JOIN "pricing_quotes" AS pq
        ON pq."company_id" = q."company_id"
       AND pq."pricing_quote_id" = qer."pricing_quote_id"
       AND pq."deleted_at" IS NULL
      WHERE q."deleted_at" IS NULL
        AND qer."pricing_quote_id" IS NOT NULL
        AND pq."id" IS NULL
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      WITH latest_approved_overrides AS (
        SELECT
          ranked."risk_id",
          ranked."proposed_premium"
        FROM (
          SELECT
            qrpo."risk_id",
            qrpo."proposed_premium",
            ROW_NUMBER() OVER (
              PARTITION BY qrpo."risk_id"
              ORDER BY
                qrpo."approved_at" DESC NULLS LAST,
                qrpo."created_at" DESC,
                qrpo."id" DESC
            ) AS "row_no"
          FROM "quotation_risk_premium_overrides" AS qrpo
          WHERE qrpo."approval_status" = 'APPROVED'
        ) AS ranked
        WHERE ranked."row_no" = 1
      )
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "quotation_id",
        "pricing_quote_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'quotation_entry_risks',
        qer."id"::text,
        q."company_id"::text,
        q."id"::text,
        qer."pricing_quote_id",
        'PREMIUM_MISMATCH_WITHOUT_APPROVED_OVERRIDE',
        'REVIEW',
        'The stored quotation premium does not match the pricing quote snapshot and no matching approved override was found.',
        jsonb_build_object(
          'risk_code', qer."risk_code",
          'premium_before_discount', qer."premium_before_discount",
          'pricing_quote_final_premium', pq."final_premium",
          'approved_override_premium', lao."proposed_premium"
        ),
        'Review the quotation risk premium and either recalculate or record a matching approved override.'
      FROM "quotation_entry_risks" AS qer
      INNER JOIN "quotation_cover_note_entries" AS qce
        ON qce."id" = qer."entry_id"
      INNER JOIN "quotation_cover_notes" AS qcn
        ON qcn."id" = qce."cover_note_id"
      INNER JOIN "quotations" AS q
        ON q."id" = qcn."quotation_id"
      INNER JOIN "pricing_quotes" AS pq
        ON pq."company_id" = q."company_id"
       AND pq."pricing_quote_id" = qer."pricing_quote_id"
       AND pq."deleted_at" IS NULL
      LEFT JOIN latest_approved_overrides AS lao
        ON lao."risk_id" = qer."id"
      WHERE q."deleted_at" IS NULL
        AND qer."pricing_quote_id" IS NOT NULL
        AND qer."premium_before_discount" <> pq."final_premium"
        AND (
          lao."proposed_premium" IS NULL OR
          lao."proposed_premium" <> qer."premium_before_discount"
        )
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "quotation_id",
        "pricing_quote_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'quotation_entry_risks',
        qer."id"::text,
        q."company_id"::text,
        q."id"::text,
        qer."pricing_quote_id",
        'INCONSISTENT_QUOTATION_PREMIUM_VALUES',
        'REVIEW',
        'The quotation risk has internally inconsistent premium values that cannot be corrected safely in migration.',
        jsonb_build_object(
          'risk_code', qer."risk_code",
          'premium_before_discount', qer."premium_before_discount",
          'premium_after_discount', qer."premium_after_discount",
          'premium_excluding_tax_equivalent', qer."premium_excluding_tax_equivalent",
          'premium_including_tax', qer."premium_including_tax"
        ),
        'Review the stored premium values and recalculate the quotation risk from the backend pricing engine.'
      FROM "quotation_entry_risks" AS qer
      INNER JOIN "quotation_cover_note_entries" AS qce
        ON qce."id" = qer."entry_id"
      INNER JOIN "quotation_cover_notes" AS qcn
        ON qcn."id" = qce."cover_note_id"
      INNER JOIN "quotations" AS q
        ON q."id" = qcn."quotation_id"
      WHERE q."deleted_at" IS NULL
        AND (
          qer."premium_before_discount" < 0 OR
          qer."premium_after_discount" < 0 OR
          qer."premium_excluding_tax_equivalent" < 0 OR
          qer."premium_including_tax" < 0 OR
          qer."premium_after_discount" > qer."premium_before_discount" OR
          qer."premium_including_tax" < qer."premium_excluding_tax_equivalent"
        )
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "pricing_quote_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'pricing_quotes',
        pq."id"::text,
        pq."company_id"::text,
        pq."pricing_quote_id",
        'MISSING_RATE_BOOK_VERSION_SNAPSHOT',
        'REVIEW',
        'The pricing quote is still missing its rate-book version snapshot after safe backfill.',
        jsonb_build_object(
          'rate_book_id', pq."rate_book_id",
          'rate_book_version', pq."rate_book_version"
        ),
        'Inspect the referenced rate book and backfill the historical rate-book version if it can be proven safely.'
      FROM "pricing_quotes" AS pq
      WHERE pq."deleted_at" IS NULL
        AND pq."rate_book_id" IS NOT NULL
        AND pq."rate_book_version" IS NULL
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "pricing_quote_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'pricing_quotes',
        pq."id"::text,
        pq."company_id"::text,
        pq."pricing_quote_id",
        'MISSING_MATCHED_RULE_VERSION_SNAPSHOT',
        'REVIEW',
        'The pricing quote is still missing its matched-rule version snapshot after safe backfill.',
        jsonb_build_object(
          'matched_rule_id', pq."matched_rule_id",
          'matched_rule_version', pq."matched_rule_version"
        ),
        'Inspect the referenced rating rule and backfill the historical rule version only if it can be proven safely.'
      FROM "pricing_quotes" AS pq
      WHERE pq."deleted_at" IS NULL
        AND pq."matched_rule_id" IS NOT NULL
        AND pq."matched_rule_version" IS NULL
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "${this.reviewTable}" (
        "phase",
        "source_table",
        "source_record_id",
        "company_id",
        "quotation_id",
        "issue_code",
        "severity",
        "issue_summary",
        "current_values",
        "suggested_action"
      )
      SELECT
        '${this.phaseCode}',
        'quotation_cover_notes',
        qcn."id"::text,
        q."company_id"::text,
        q."id"::text,
        'MISSING_EXCHANGE_RATE_SNAPSHOT',
        'REVIEW',
        'The quotation cover note has an exchange rate but no stored exchange-rate snapshot.',
        jsonb_build_object(
          'currency_code', qcn."currency_code",
          'exchange_rate', qcn."exchange_rate"
        ),
        'Review the historical quotation currency context and backfill an exchange-rate snapshot if it can be proven safely.'
      FROM "quotation_cover_notes" AS qcn
      INNER JOIN "quotations" AS q
        ON q."id" = qcn."quotation_id"
      WHERE q."deleted_at" IS NULL
        AND qcn."exchange_rate_snapshot" IS NULL
        AND qcn."exchange_rate" IS NOT NULL
        AND qcn."exchange_rate" <> 1
      ON CONFLICT ("phase", "source_table", "source_record_id", "issue_code")
      DO NOTHING
    `);
  }
}
