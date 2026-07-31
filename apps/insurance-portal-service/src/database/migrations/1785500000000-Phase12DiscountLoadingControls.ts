import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase12DiscountLoadingControls1785500000000 implements MigrationInterface {
  name = 'Phase12DiscountLoadingControls1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      ADD COLUMN IF NOT EXISTS "max_discount_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "max_discount_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "discount_approval_threshold_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "discount_approval_threshold_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "max_loading_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "max_loading_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "loading_approval_threshold_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "loading_approval_threshold_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "adjustment_effective_from" date,
      ADD COLUMN IF NOT EXISTS "adjustment_effective_to" date
    `);

    await queryRunner.query(`
      ALTER TABLE "quotation_risk_discounts"
      ADD COLUMN IF NOT EXISTS "request_reason_code" varchar(50),
      ADD COLUMN IF NOT EXISTS "request_comment" varchar(500),
      ADD COLUMN IF NOT EXISTS "effective_from" date,
      ADD COLUMN IF NOT EXISTS "effective_to" date,
      ADD COLUMN IF NOT EXISTS "requested_by" varchar(100),
      ADD COLUMN IF NOT EXISTS "requested_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "max_permitted_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "max_permitted_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "approval_required" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "approval_status" varchar(20) NOT NULL DEFAULT 'NOT_REQUIRED',
      ADD COLUMN IF NOT EXISTS "approved_rate" numeric(18,10),
      ADD COLUMN IF NOT EXISTS "approved_amount" numeric(20,4),
      ADD COLUMN IF NOT EXISTS "approved_by" varchar(100),
      ADD COLUMN IF NOT EXISTS "approval_date" timestamptz,
      ADD COLUMN IF NOT EXISTS "rejection_reason" varchar(500)
    `);

    await queryRunner
      .query(
        `
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rrr_discount_rate_limits"
      CHECK (
        "max_discount_rate" IS NULL OR
        ("max_discount_rate" >= 0 AND "max_discount_rate" <= 1)
      )
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rrr_discount_approval_rate_limits"
      CHECK (
        "discount_approval_threshold_rate" IS NULL OR
        ("discount_approval_threshold_rate" >= 0 AND "discount_approval_threshold_rate" <= 1)
      )
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rrr_loading_rate_limits"
      CHECK (
        "max_loading_rate" IS NULL OR
        ("max_loading_rate" >= 0 AND "max_loading_rate" <= 1)
      )
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rrr_loading_approval_rate_limits"
      CHECK (
        "loading_approval_threshold_rate" IS NULL OR
        ("loading_approval_threshold_rate" >= 0 AND "loading_approval_threshold_rate" <= 1)
      )
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "risk_rating_rules"
      ADD CONSTRAINT "CHK_rrr_adjustment_effective_window"
      CHECK (
        "adjustment_effective_from" IS NULL OR
        "adjustment_effective_to" IS NULL OR
        "adjustment_effective_to" >= "adjustment_effective_from"
      )
    `,
      )
      .catch(() => undefined);
    await queryRunner
      .query(
        `
      ALTER TABLE "quotation_risk_discounts"
      ADD CONSTRAINT "CHK_qrd_approval_status"
      CHECK ("approval_status" IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'))
    `,
      )
      .catch(() => undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotation_risk_discounts" DROP CONSTRAINT IF EXISTS "CHK_qrd_approval_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT IF EXISTS "CHK_rrr_adjustment_effective_window"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT IF EXISTS "CHK_rrr_loading_approval_rate_limits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT IF EXISTS "CHK_rrr_loading_rate_limits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT IF EXISTS "CHK_rrr_discount_approval_rate_limits"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_rating_rules" DROP CONSTRAINT IF EXISTS "CHK_rrr_discount_rate_limits"`,
    );

    await queryRunner.query(`
      ALTER TABLE "quotation_risk_discounts"
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "approval_date",
      DROP COLUMN IF EXISTS "approved_by",
      DROP COLUMN IF EXISTS "approved_amount",
      DROP COLUMN IF EXISTS "approved_rate",
      DROP COLUMN IF EXISTS "approval_status",
      DROP COLUMN IF EXISTS "approval_required",
      DROP COLUMN IF EXISTS "max_permitted_amount",
      DROP COLUMN IF EXISTS "max_permitted_rate",
      DROP COLUMN IF EXISTS "requested_at",
      DROP COLUMN IF EXISTS "requested_by",
      DROP COLUMN IF EXISTS "effective_to",
      DROP COLUMN IF EXISTS "effective_from",
      DROP COLUMN IF EXISTS "request_comment",
      DROP COLUMN IF EXISTS "request_reason_code"
    `);

    await queryRunner.query(`
      ALTER TABLE "risk_rating_rules"
      DROP COLUMN IF EXISTS "adjustment_effective_to",
      DROP COLUMN IF EXISTS "adjustment_effective_from",
      DROP COLUMN IF EXISTS "loading_approval_threshold_amount",
      DROP COLUMN IF EXISTS "loading_approval_threshold_rate",
      DROP COLUMN IF EXISTS "max_loading_amount",
      DROP COLUMN IF EXISTS "max_loading_rate",
      DROP COLUMN IF EXISTS "discount_approval_threshold_amount",
      DROP COLUMN IF EXISTS "discount_approval_threshold_rate",
      DROP COLUMN IF EXISTS "max_discount_amount",
      DROP COLUMN IF EXISTS "max_discount_rate"
    `);
  }
}
