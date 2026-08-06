import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 15 — adds the reinsurance concepts that had no backing table at all
 * (counterparty profiles, programmes, eligibility rules, signed lines,
 * recovery receipts), plus columns needed for treaty direction/regulatory
 * status and settlement finance-journal linkage/maker-checker.
 *
 * Spec-vocabulary -> actual-schema-vocabulary mapping (existing tables are
 * kept under their current names per the Phase 15 scoping decision):
 *   - "reinsurance_cessions"          -> "policy_cessions"
 *   - "reinsurance_treaty_layers"     -> "reinsurance_treaty_sections"
 *   - "reinsurance_recoveries"        -> "reinsurance_claim_recoveries"
 *
 * All monetary columns use numeric(20,2) to match every existing reinsurance
 * column (MoneyUtil's 2-decimal convention) — NOT numeric(20,4).
 */
export class ReinsuranceCapacityAndSettlement1795700000000
  implements MigrationInterface
{
  name = 'ReinsuranceCapacityAndSettlement1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------
    // Counterparty profiles (thin layer over Company)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reinsurance_counterparties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "counterparty_company_id" uuid NOT NULL,
        "role" varchar(40) NOT NULL,
        "rating" varchar(20),
        "rating_agency" varchar(60),
        "home_territory" varchar(30),
        "regulatory_status" varchar(30) NOT NULL DEFAULT 'UNREGISTERED',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_counterparties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_counterparty" UNIQUE ("company_id", "counterparty_company_id")
      )
    `);

    // ---------------------------------------------------------------
    // Programmes (treaty grouping/year construct)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reinsurance_programs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "program_name" varchar(180) NOT NULL,
        "program_year" integer NOT NULL,
        "direction" varchar(20) NOT NULL DEFAULT 'OUTWARD',
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_programs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_program" UNIQUE ("company_id", "program_name", "program_year")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "reinsurance_treaties"
      ADD COLUMN IF NOT EXISTS "program_id" uuid,
      ADD COLUMN IF NOT EXISTS "direction" varchar(20) NOT NULL DEFAULT 'OUTWARD',
      ADD COLUMN IF NOT EXISTS "territory" varchar(30),
      ADD COLUMN IF NOT EXISTS "regulatory_status" varchar(30) NOT NULL DEFAULT 'UNREGISTERED'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "reinsurance_treaties"
        ADD CONSTRAINT "FK_reinsurance_treaty_program"
        FOREIGN KEY ("program_id") REFERENCES "reinsurance_programs"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ---------------------------------------------------------------
    // Treaty eligibility rules
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reinsurance_treaty_eligibility_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "treaty_id" uuid NOT NULL,
        "rule_type" varchar(40) NOT NULL,
        "rule_value" varchar(180) NOT NULL,
        "is_exclusion" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_treaty_eligibility_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_eligibility_rule_treaty" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE
      )
    `);

    // ---------------------------------------------------------------
    // Facultative signed lines (final confirmed line, distinct from offers)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "facultative_signed_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "placement_id" uuid NOT NULL,
        "participant_company_id" uuid NOT NULL,
        "signed_share_percent" numeric(18,10) NOT NULL,
        "signed_amount" numeric(20,2) NOT NULL,
        "signed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "signed_by" uuid,
        CONSTRAINT "PK_facultative_signed_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_facultative_signed_line_placement" FOREIGN KEY ("placement_id") REFERENCES "facultative_placements"("id") ON DELETE CASCADE
      )
    `);

    // ---------------------------------------------------------------
    // Recovery receipts (append-only, mirrors claim_reserve_movements)
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reinsurance_recovery_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_recovery_id" uuid NOT NULL,
        "amount" numeric(20,2) NOT NULL,
        "currency_code" varchar(10) NOT NULL,
        "received_at" TIMESTAMPTZ NOT NULL,
        "reference" varchar(150),
        "recorded_by" uuid,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_recovery_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_recovery_receipt" FOREIGN KEY ("claim_recovery_id") REFERENCES "reinsurance_claim_recoveries"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_reinsurance_recovery_receipt_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.audit_maintenance', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN
            RETURN OLD;
          END IF;
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'reinsurance_recovery_receipts is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_reinsurance_recovery_receipts_append_only" ON "reinsurance_recovery_receipts"
    `);

    await queryRunner.query(`
      CREATE TRIGGER "TRG_reinsurance_recovery_receipts_append_only"
      BEFORE UPDATE OR DELETE ON "reinsurance_recovery_receipts"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_reinsurance_recovery_receipt_mutation()
    `);

    // ---------------------------------------------------------------
    // Settlement maker-checker + finance journal linkage
    // ---------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "reinsurance_settlements"
      ADD COLUMN IF NOT EXISTS "submitted_by" uuid,
      ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "approved_by" uuid,
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text,
      ADD COLUMN IF NOT EXISTS "finance_journal_entry_id" uuid,
      ADD COLUMN IF NOT EXISTS "finance_event_id" varchar(150),
      ADD COLUMN IF NOT EXISTS "settled_by" uuid,
      ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMPTZ
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reinsurance_counterparty_company" ON "reinsurance_counterparties" ("company_id", "counterparty_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reinsurance_eligibility_rule_treaty" ON "reinsurance_treaty_eligibility_rules" ("treaty_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_facultative_signed_line_placement" ON "facultative_signed_lines" ("placement_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reinsurance_recovery_receipt_recovery" ON "reinsurance_recovery_receipts" ("claim_recovery_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_recovery_receipt_recovery"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_facultative_signed_line_placement"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_eligibility_rule_treaty"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_counterparty_company"`,
    );

    await queryRunner.query(`
      ALTER TABLE "reinsurance_settlements"
      DROP COLUMN IF EXISTS "settled_at",
      DROP COLUMN IF EXISTS "settled_by",
      DROP COLUMN IF EXISTS "finance_event_id",
      DROP COLUMN IF EXISTS "finance_journal_entry_id",
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "approved_at",
      DROP COLUMN IF EXISTS "approved_by",
      DROP COLUMN IF EXISTS "submitted_at",
      DROP COLUMN IF EXISTS "submitted_by"
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_reinsurance_recovery_receipts_append_only" ON "reinsurance_recovery_receipts"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_reinsurance_recovery_receipt_mutation()`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_recovery_receipts"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "facultative_signed_lines"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_treaty_eligibility_rules"`,
    );

    await queryRunner.query(`
      ALTER TABLE "reinsurance_treaties"
      DROP CONSTRAINT IF EXISTS "FK_reinsurance_treaty_program",
      DROP COLUMN IF EXISTS "regulatory_status",
      DROP COLUMN IF EXISTS "territory",
      DROP COLUMN IF EXISTS "direction",
      DROP COLUMN IF EXISTS "program_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "reinsurance_programs"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_counterparties"`,
    );
  }
}
