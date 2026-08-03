import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReinsuranceModule1793800000000 implements MigrationInterface {
  name = 'ReinsuranceModule1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reinsurance_treaties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "treaty_no" varchar(60) NOT NULL,
        "treaty_name" varchar(180) NOT NULL,
        "treaty_type" varchar(40) NOT NULL,
        "treaty_form" varchar(60) NOT NULL,
        "effective_from" date NOT NULL,
        "effective_to" date NOT NULL,
        "currency" varchar(10) NOT NULL DEFAULT 'TZS',
        "total_capacity" numeric(20,2) NOT NULL DEFAULT 0,
        "company_retention" numeric(20,2) NOT NULL DEFAULT 0,
        "aggregate_limit" numeric(20,2) NOT NULL DEFAULT 0,
        "minimum_deposit_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "reinstatement_count" integer NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "agreement_reference" varchar(120),
        "agreement_document_url" varchar(500),
        "created_by" uuid,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMPTZ,
        "approved_by" uuid,
        "approved_at" TIMESTAMPTZ,
        "activated_by" uuid,
        "activated_at" TIMESTAMPTZ,
        "rejected_by" uuid,
        "rejected_at" TIMESTAMPTZ,
        "rejection_reason" text,
        "suspended_by" uuid,
        "suspended_at" TIMESTAMPTZ,
        "suspension_reason" text,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_treaties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_treaty_no" UNIQUE ("company_id", "treaty_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_treaty_sections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "treaty_id" uuid NOT NULL,
        "section_no" varchar(30) NOT NULL,
        "section_name" varchar(180) NOT NULL,
        "category_id" uuid,
        "product_id" uuid,
        "sub_class_id" uuid,
        "retention_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "cession_limit" numeric(20,2) NOT NULL DEFAULT 0,
        "treaty_limit" numeric(20,2) NOT NULL DEFAULT 0,
        "line_count" numeric(12,4) NOT NULL DEFAULT 0,
        "rate_on_line" numeric(18,10) NOT NULL DEFAULT 0,
        "minimum_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "maximum_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "ceding_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "brokerage_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "profit_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "event_limit" numeric(20,2) NOT NULL DEFAULT 0,
        "aggregate_limit" numeric(20,2) NOT NULL DEFAULT 0,
        "reinsurance_category" integer NOT NULL DEFAULT 1,
        "reinsurance_form" integer NOT NULL DEFAULT 1,
        "reinsurance_type" integer NOT NULL DEFAULT 1,
        "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_treaty_sections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_treaty_section" UNIQUE ("treaty_id", "section_no"),
        CONSTRAINT "FK_reinsurance_section_treaty" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_treaty_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "treaty_id" uuid NOT NULL,
        "treaty_section_id" uuid,
        "participant_company_id" uuid NOT NULL,
        "reinsurance_broker_company_id" uuid,
        "participant_code" varchar(50) NOT NULL,
        "re_broker_code" varchar(50),
        "participant_role" varchar(40) NOT NULL,
        "share_percent" numeric(18,10) NOT NULL,
        "signed_line_percent" numeric(18,10) NOT NULL DEFAULT 0,
        "capacity_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "reinsurance_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "participation_date" TIMESTAMPTZ NOT NULL,
        "effective_from" date,
        "effective_to" date,
        "status" varchar(30) NOT NULL DEFAULT 'INVITED',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_treaty_participants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_participant_treaty" FOREIGN KEY ("treaty_id") REFERENCES "reinsurance_treaties"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reinsurance_participant_section" FOREIGN KEY ("treaty_section_id") REFERENCES "reinsurance_treaty_sections"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "facultative_placements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "policy_id" uuid NOT NULL,
        "policy_risk_id" uuid,
        "placement_no" varchar(60) NOT NULL,
        "placement_reference" varchar(120),
        "risk_description" text NOT NULL,
        "gross_sum_insured" numeric(20,2) NOT NULL,
        "company_retention" numeric(20,2) NOT NULL,
        "amount_to_place" numeric(20,2) NOT NULL,
        "gross_premium" numeric(20,2) NOT NULL,
        "premium_to_place" numeric(20,2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "exchange_rate" numeric(18,6) NOT NULL DEFAULT 1,
        "target_share_percent" numeric(18,10) NOT NULL DEFAULT 100,
        "accepted_share_percent" numeric(18,10) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "submission_deadline" TIMESTAMPTZ,
        "notes" text,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_facultative_placements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_facultative_placement_no" UNIQUE ("company_id", "placement_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "facultative_placement_offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "placement_id" uuid NOT NULL,
        "reinsurer_company_id" uuid NOT NULL,
        "reinsurance_broker_company_id" uuid,
        "offer_no" varchar(60) NOT NULL,
        "participant_code" varchar(50),
        "re_broker_code" varchar(50),
        "offered_share_percent" numeric(18,10) NOT NULL,
        "offered_amount" numeric(20,2) NOT NULL,
        "offered_premium" numeric(20,2) NOT NULL,
        "quoted_share_percent" numeric(18,10) NOT NULL DEFAULT 0,
        "quoted_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "quoted_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "accepted_share_percent" numeric(18,10) NOT NULL DEFAULT 0,
        "accepted_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "accepted_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "reinsurance_commission_rate" numeric(18,10) NOT NULL DEFAULT 0,
        "terms" text,
        "conditions" text,
        "exclusions" text,
        "status" varchar(30) NOT NULL DEFAULT 'INVITED',
        "invited_by" uuid,
        "responded_by" uuid,
        "responded_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_facultative_placement_offers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_facultative_offer_placement" FOREIGN KEY ("placement_id") REFERENCES "facultative_placements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "policy_cessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "policy_id" uuid NOT NULL,
        "policy_risk_id" uuid,
        "treaty_id" uuid,
        "treaty_section_id" uuid,
        "facultative_placement_id" uuid,
        "cession_no" varchar(60) NOT NULL,
        "cession_type" varchar(30) NOT NULL,
        "effective_from" date NOT NULL,
        "effective_to" date NOT NULL,
        "currency" varchar(10) NOT NULL,
        "exchange_rate" numeric(18,6) NOT NULL DEFAULT 1,
        "gross_sum_insured" numeric(20,2) NOT NULL,
        "gross_premium" numeric(20,2) NOT NULL,
        "retention_amount" numeric(20,2) NOT NULL,
        "retained_premium" numeric(20,2) NOT NULL,
        "ceded_sum_insured" numeric(20,2) NOT NULL,
        "ceded_premium" numeric(20,2) NOT NULL,
        "ceded_share_percent" numeric(18,10) NOT NULL,
        "reinsurance_category" integer NOT NULL DEFAULT 1,
        "authorizing_officer_name" varchar(150),
        "authorizing_officer_title" varchar(100),
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMPTZ,
        "approved_by" uuid,
        "approved_at" TIMESTAMPTZ,
        "applied_by" uuid,
        "applied_at" TIMESTAMPTZ,
        "rejection_reason" text,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_policy_cessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_policy_cession_no" UNIQUE ("company_id", "cession_no"),
        CONSTRAINT "FK_policy_cession_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "policy_cession_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "cession_id" uuid NOT NULL,
        "participant_company_id" uuid NOT NULL,
        "reinsurance_broker_company_id" uuid,
        "source_treaty_participant_id" uuid,
        "source_facultative_offer_id" uuid,
        "participant_code" varchar(50) NOT NULL,
        "participant_type" integer NOT NULL DEFAULT 1,
        "reinsurance_form" integer NOT NULL DEFAULT 1,
        "reinsurance_type" integer NOT NULL DEFAULT 1,
        "re_broker_code" varchar(50),
        "brokerage_commission" numeric(18,2) NOT NULL DEFAULT 0,
        "reinsurance_commission" numeric(18,2) NOT NULL DEFAULT 0,
        "premium_share" numeric(18,10) NOT NULL,
        "sum_insured_share" numeric(20,2) NOT NULL,
        "ceded_premium_share" numeric(20,2) NOT NULL,
        "participation_date" TIMESTAMPTZ NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_policy_cession_participants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_policy_cession_participant_cession" FOREIGN KEY ("cession_id") REFERENCES "policy_cessions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_declarations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "policy_id" uuid NOT NULL,
        "cession_id" uuid NOT NULL,
        "declaration_no" varchar(60) NOT NULL,
        "cover_note_reference_number" varchar(100) NOT NULL,
        "premium_including_tax" numeric(20,2) NOT NULL,
        "currency_code" varchar(10) NOT NULL,
        "exchange_rate" numeric(18,6) NOT NULL DEFAULT 1,
        "authorizing_officer_name" varchar(150) NOT NULL,
        "authorizing_officer_title" varchar(100) NOT NULL,
        "reinsurance_category" integer NOT NULL,
        "participants" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "tiramis_submission_tracking_id" uuid,
        "tiramis_status" varchar(50),
        "tiramis_transaction_id" varchar(100),
        "tiramis_request_id" varchar(100),
        "tiramis_service_type" varchar(80),
        "tiramis_root_element" varchar(100),
        "tiramis_acknowledgement_status_code" varchar(20),
        "tiramis_acknowledgement_status_desc" varchar(255),
        "tiramis_final_response_id" varchar(100),
        "tiramis_final_response_status_code" varchar(20),
        "tiramis_final_response_status_desc" varchar(255),
        "tiramis_last_error_message" text,
        "tiramis_last_synced_at" TIMESTAMPTZ,
        "tiramis_payload" jsonb,
        "created_by" uuid,
        "submitted_at" TIMESTAMPTZ,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_declarations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_declaration_no" UNIQUE ("company_id", "declaration_no"),
        CONSTRAINT "UQ_reinsurance_declaration_cession" UNIQUE ("cession_id"),
        CONSTRAINT "FK_reinsurance_declaration_policy" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_reinsurance_declaration_cession" FOREIGN KEY ("cession_id") REFERENCES "policy_cessions"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_bordereaux" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "treaty_id" uuid,
        "participant_company_id" uuid,
        "bordereau_no" varchar(60) NOT NULL,
        "bordereau_type" varchar(30) NOT NULL,
        "period_from" date NOT NULL,
        "period_to" date NOT NULL,
        "currency" varchar(10) NOT NULL,
        "gross_sum_insured" numeric(20,2) NOT NULL DEFAULT 0,
        "ceded_sum_insured" numeric(20,2) NOT NULL DEFAULT 0,
        "gross_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "ceded_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "commission_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "claim_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_bordereaux" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_bordereau_no" UNIQUE ("company_id", "bordereau_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_bordereau_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bordereau_id" uuid NOT NULL,
        "cession_id" uuid,
        "cession_participant_id" uuid,
        "policy_id" uuid,
        "claim_id" uuid,
        "claim_recovery_id" uuid,
        "reference_number" varchar(120) NOT NULL,
        "gross_sum_insured" numeric(20,2) NOT NULL DEFAULT 0,
        "ceded_sum_insured" numeric(20,2) NOT NULL DEFAULT 0,
        "gross_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "ceded_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "commission_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "claim_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "recovery_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_bordereau_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_bordereau_item" FOREIGN KEY ("bordereau_id") REFERENCES "reinsurance_bordereaux"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_premium_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "treaty_id" uuid,
        "participant_company_id" uuid NOT NULL,
        "reinsurance_broker_company_id" uuid,
        "account_no" varchar(60) NOT NULL,
        "period_from" date NOT NULL,
        "period_to" date NOT NULL,
        "currency" varchar(10) NOT NULL,
        "gross_ceded_premium" numeric(20,2) NOT NULL DEFAULT 0,
        "reinsurance_commission" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_commission" numeric(20,2) NOT NULL DEFAULT 0,
        "tax_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "other_adjustments" numeric(20,2) NOT NULL DEFAULT 0,
        "net_premium_due" numeric(20,2) NOT NULL DEFAULT 0,
        "paid_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "outstanding_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_premium_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_account_no" UNIQUE ("company_id", "account_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_premium_account_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "premium_account_id" uuid NOT NULL,
        "cession_id" uuid NOT NULL,
        "cession_participant_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "gross_ceded_premium" numeric(20,2) NOT NULL,
        "reinsurance_commission" numeric(20,2) NOT NULL DEFAULT 0,
        "brokerage_commission" numeric(20,2) NOT NULL DEFAULT 0,
        "tax_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "net_premium_due" numeric(20,2) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_account_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_account_item" FOREIGN KEY ("premium_account_id") REFERENCES "reinsurance_premium_accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_claim_recoveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "claim_id" uuid NOT NULL,
        "cession_id" uuid NOT NULL,
        "cession_participant_id" uuid NOT NULL,
        "participant_company_id" uuid NOT NULL,
        "recovery_no" varchar(60) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "gross_claim_amount" numeric(20,2) NOT NULL,
        "participant_share_percent" numeric(18,10) NOT NULL,
        "expected_recovery" numeric(20,2) NOT NULL,
        "admitted_recovery" numeric(20,2) NOT NULL DEFAULT 0,
        "received_recovery" numeric(20,2) NOT NULL DEFAULT 0,
        "outstanding_recovery" numeric(20,2) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'EXPECTED',
        "created_by" uuid,
        "admitted_by" uuid,
        "admitted_at" TIMESTAMPTZ,
        "remarks" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_claim_recoveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_recovery_no" UNIQUE ("company_id", "recovery_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_settlements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "branch_id" uuid,
        "counterparty_company_id" uuid NOT NULL,
        "settlement_no" varchar(60) NOT NULL,
        "settlement_type" varchar(40) NOT NULL,
        "period_from" date,
        "period_to" date,
        "currency" varchar(10) NOT NULL,
        "gross_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "deduction_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "net_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "paid_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "balance_amount" numeric(20,2) NOT NULL DEFAULT 0,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "payment_method" varchar(50),
        "payment_reference" varchar(150),
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reinsurance_settlements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reinsurance_settlement_no" UNIQUE ("company_id", "settlement_no")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_settlement_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "settlement_id" uuid NOT NULL,
        "premium_account_id" uuid,
        "claim_recovery_id" uuid,
        "resource_type" varchar(50) NOT NULL,
        "resource_id" uuid NOT NULL,
        "amount" numeric(20,2) NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_settlement_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reinsurance_settlement_item" FOREIGN KEY ("settlement_id") REFERENCES "reinsurance_settlements"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reinsurance_reconciliation_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "counterparty_company_id" uuid NOT NULL,
        "resource_type" varchar(50) NOT NULL,
        "resource_id" uuid NOT NULL,
        "expected_amount" numeric(20,2) NOT NULL,
        "reported_amount" numeric(20,2) NOT NULL,
        "variance_amount" numeric(20,2) NOT NULL,
        "currency" varchar(10) NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'OPEN',
        "reason" text,
        "resolution" text,
        "assigned_user_id" uuid,
        "resolved_by" uuid,
        "resolved_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reinsurance_reconciliation_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_treaties_status" ON "reinsurance_treaties" ("company_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_participant_company" ON "reinsurance_treaty_participants" ("participant_company_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_declaration_status" ON "reinsurance_declarations" ("company_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_recovery_company" ON "reinsurance_claim_recoveries" ("company_id", "status", "participant_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reinsurance_settlement_counterparty" ON "reinsurance_settlements" ("company_id", "counterparty_company_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_settlement_counterparty"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_recovery_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_declaration_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_participant_company"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reinsurance_treaties_status"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_reconciliation_items"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_settlement_items"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "reinsurance_settlements"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_claim_recoveries"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_premium_account_items"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_premium_accounts"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_bordereau_items"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "reinsurance_bordereaux"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reinsurance_declarations"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "policy_cession_participants"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_cessions"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "facultative_placement_offers"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "facultative_placements"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_treaty_participants"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "reinsurance_treaty_sections"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "reinsurance_treaties"`);
  }
}
