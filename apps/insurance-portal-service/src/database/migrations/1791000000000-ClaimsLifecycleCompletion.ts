import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Claims lifecycle completion (additive).
 *
 * 1. `business_document_sequences`, used by BusinessReferenceService but never
 *    created by a migration (it only existed in restored databases).
 * 2. TIRAMIS claimant fields, discharge-voucher adjustment/reconciliation,
 *    rejection regulatory fields, assessment breakdown and incident fields.
 * 3. Authority matrix, approval history, document requirements, claim events.
 * 4. Controlled lifecycle: legacy statuses are remapped onto the state machine.
 * 5. Granular claims permissions, granted from their legacy equivalents.
 *
 * The permission list is a frozen snapshot on purpose.
 */
const CLAIMS_MIGRATION_PERMISSIONS: Array<{
  name: string;
  displayName: string;
  description: string;
  legacy: string[];
}> = [
  {
    name: 'claims:delete-draft',
    displayName: 'Delete draft claims',
    description: 'Delete claims that have not been submitted to TIRA',
    legacy: ['claims:create'],
  },
  {
    name: 'claims:notification-submit',
    displayName: 'Submit claim notifications',
    description: 'Submit claim notifications to TIRAMIS',
    legacy: ['claims:tiramis-submit'],
  },
  {
    name: 'claims:intimation-create',
    displayName: 'Create claim intimations',
    description: 'Create and edit claim intimations and claimants',
    legacy: ['claims:update'],
  },
  {
    name: 'claims:intimation-submit',
    displayName: 'Submit claim intimations',
    description: 'Submit claim intimations to TIRAMIS',
    legacy: ['claims:tiramis-submit'],
  },
  {
    name: 'claims:assessment-update',
    displayName: 'Update claim assessments',
    description: 'Edit draft claim assessments',
    legacy: ['claims:assessment-create'],
  },
  {
    name: 'claims:assessment-submit',
    displayName: 'Submit claim assessments',
    description: 'Submit claim assessments for approval',
    legacy: ['claims:assessment-create'],
  },
  {
    name: 'claims:approve',
    displayName: 'Approve claims',
    description: 'Approve claim amounts within the configured authority limit',
    legacy: ['claim-decisions:approve', 'claims:assessment-approve'],
  },
  {
    name: 'claims:discharge-submit',
    displayName: 'Submit discharge vouchers',
    description: 'Issue discharge vouchers and submit them to TIRAMIS',
    legacy: ['claims:discharge-create'],
  },
  {
    name: 'claims:payment-submit',
    displayName: 'Submit claim payments',
    description: 'Submit completed claim payments to TIRAMIS',
    legacy: ['claims:tiramis-submit'],
  },
  {
    name: 'claims:rejection-create',
    displayName: 'Create claim rejections',
    description: 'Recommend a claim for rejection',
    legacy: ['claims:reject'],
  },
  {
    name: 'claims:rejection-approve',
    displayName: 'Approve claim rejections',
    description: 'Approve a recommended claim rejection',
    legacy: ['claims:reject'],
  },
  {
    name: 'claims:rejection-submit',
    displayName: 'Submit claim rejections',
    description: 'Submit approved claim rejections to TIRAMIS',
    legacy: ['claims:reject'],
  },
  {
    name: 'claims:tiramis-view-payload',
    displayName: 'View claim TIRAMIS payloads',
    description: 'View raw TIRAMIS request and response payloads for claims',
    legacy: ['claims:tiramis-retry'],
  },
  {
    name: 'claims:report-read',
    displayName: 'Read claims reports',
    description: 'Run and download claims reports',
    legacy: ['dashboard:claims'],
  },
  {
    name: 'claims:dashboard',
    displayName: 'View claims dashboard',
    description: 'View the claims dashboard within the permitted data scope',
    legacy: ['dashboard:claims'],
  },
  {
    name: 'claims:configuration-manage',
    displayName: 'Manage claims configuration',
    description: 'Manage authority limits and claim document requirements',
    legacy: ['claims:override-cover-validation'],
  },
];

export class ClaimsLifecycleCompletion1791000000000 implements MigrationInterface {
  name = 'ClaimsLifecycleCompletion1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_document_sequences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "document_type" character varying(50) NOT NULL,
        "period_key" character varying(20) NOT NULL,
        "current_value" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_business_document_sequences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_business_document_sequences"
          UNIQUE ("company_id", "document_type", "period_key")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "claims"
        ADD COLUMN IF NOT EXISTS "claim_title" character varying(200),
        ADD COLUMN IF NOT EXISTS "department_id" uuid,
        ADD COLUMN IF NOT EXISTS "notification_source" character varying(40),
        ADD COLUMN IF NOT EXISTS "reporter_name" character varying(180),
        ADD COLUMN IF NOT EXISTS "reporter_phone" character varying(50),
        ADD COLUMN IF NOT EXISTS "reporter_email" character varying(150),
        ADD COLUMN IF NOT EXISTS "incident_details" jsonb,
        ADD COLUMN IF NOT EXISTS "internal_notes" text,
        ADD COLUMN IF NOT EXISTS "tiramis_reference_locked" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "reopened_by" uuid,
        ADD COLUMN IF NOT EXISTS "reopen_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_claimants"
        ADD COLUMN IF NOT EXISTS "claimant_category" smallint,
        ADD COLUMN IF NOT EXISTS "party_type" smallint,
        ADD COLUMN IF NOT EXISTS "id_type" smallint,
        ADD COLUMN IF NOT EXISTS "birth_date" date,
        ADD COLUMN IF NOT EXISTS "gender" character varying(1),
        ADD COLUMN IF NOT EXISTS "country_code" character varying(3),
        ADD COLUMN IF NOT EXISTS "region" character varying(50),
        ADD COLUMN IF NOT EXISTS "district" character varying(50),
        ADD COLUMN IF NOT EXISTS "street" character varying(100),
        ADD COLUMN IF NOT EXISTS "fax" character varying(50),
        ADD COLUMN IF NOT EXISTS "postal_address" character varying(100),
        ADD COLUMN IF NOT EXISTS "uses_policyholder" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "claim_claimants"
      SET "claimant_category" = CASE
            WHEN "claimant_type" IN ('POLICYHOLDER', 'INSURED') THEN 1
            ELSE 2
          END
      WHERE "claimant_category" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_intimations"
        ADD COLUMN IF NOT EXISTS "assessor_company_id" uuid,
        ADD COLUMN IF NOT EXISTS "assessor_user_id" uuid,
        ADD COLUMN IF NOT EXISTS "submitted_by" uuid,
        ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_assessments"
        ADD COLUMN IF NOT EXISTS "supersedes_assessment_id" uuid,
        ADD COLUMN IF NOT EXISTS "assessor_name" character varying(180),
        ADD COLUMN IF NOT EXISTS "assessor_company" character varying(180),
        ADD COLUMN IF NOT EXISTS "inspection_date" date,
        ADD COLUMN IF NOT EXISTS "recommended_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "deductible_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "salvage_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "contribution_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "betterment_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "recovery_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "remarks" text
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_discharge_vouchers"
        ADD COLUMN IF NOT EXISTS "assessment_id" uuid,
        ADD COLUMN IF NOT EXISTS "adjustment_date" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "adjustment_reason" text,
        ADD COLUMN IF NOT EXISTS "adjustment_amount" numeric(18,2),
        ADD COLUMN IF NOT EXISTS "reconciliation_date" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "reconciliation_summary" text,
        ADD COLUMN IF NOT EXISTS "reconciled_amount" numeric(18,2),
        ADD COLUMN IF NOT EXISTS "claimants" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "supersedes_voucher_id" uuid,
        ADD COLUMN IF NOT EXISTS "generated_document_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_rejections"
        ADD COLUMN IF NOT EXISTS "claim_intimation_number" character varying(80),
        ADD COLUMN IF NOT EXISTS "tira_rejection_reason" character varying(100),
        ADD COLUMN IF NOT EXISTS "claim_resulted_litigation" character varying(1) NOT NULL DEFAULT 'N',
        ADD COLUMN IF NOT EXISTS "claim_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "currency_code" character varying(10),
        ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(18,6) NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "claimants" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "recommendation" text,
        ADD COLUMN IF NOT EXISTS "policy_clause_reference" character varying(200),
        ADD COLUMN IF NOT EXISTS "letter_document_id" uuid,
        ADD COLUMN IF NOT EXISTS "previous_claim_status" character varying(30),
        ADD COLUMN IF NOT EXISTS "submitted_by" uuid,
        ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "claim_payments"
        ADD COLUMN IF NOT EXISTS "claimants" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "payee_bank_details" jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_approval_limits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "approval_type" character varying(30) NOT NULL,
        "level" smallint NOT NULL,
        "role_id" uuid,
        "user_id" uuid,
        "insurance_category_id" uuid,
        "product_id" uuid,
        "branch_id" uuid,
        "min_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "max_amount" numeric(18,2),
        "currency_code" character varying(3) NOT NULL DEFAULT 'TZS',
        "is_active" boolean NOT NULL DEFAULT true,
        "description" character varying(200),
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_approval_limits" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_claim_approval_limits_actor"
          CHECK ("role_id" IS NOT NULL OR "user_id" IS NOT NULL),
        CONSTRAINT "CHK_claim_approval_limits_band"
          CHECK ("max_amount" IS NULL OR "max_amount" >= "min_amount")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claim_approval_limits_lookup"
      ON "claim_approval_limits" ("company_id", "approval_type", "is_active", "level")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_approvals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "subject_type" character varying(30) NOT NULL,
        "subject_id" uuid NOT NULL,
        "approval_type" character varying(30) NOT NULL,
        "round" integer NOT NULL DEFAULT 1,
        "level" smallint NOT NULL,
        "required_levels" smallint NOT NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "currency_code" character varying(3) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "limit_id" uuid,
        "comments" text,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "acted_by" uuid,
        "acted_at" TIMESTAMP WITH TIME ZONE,
        "admin_override" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_approvals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_approvals_subject_round_level"
          UNIQUE ("subject_type", "subject_id", "round", "level"),
        CONSTRAINT "FK_claim_approvals_claim" FOREIGN KEY ("claim_id")
          REFERENCES "claims"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claim_approvals_pending"
      ON "claim_approvals" ("company_id", "status", "approval_type")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_document_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "insurance_category_id" uuid,
        "product_id" uuid,
        "claim_stage" character varying(30) NOT NULL,
        "document_type" character varying(80) NOT NULL,
        "title" character varying(180) NOT NULL,
        "description" text,
        "is_mandatory" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_document_requirements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claim_document_requirements_lookup"
      ON "claim_document_requirements" ("company_id", "claim_stage", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "claim_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "claim_id" uuid NOT NULL,
        "event_type" character varying(60) NOT NULL,
        "actor_type" character varying(20) NOT NULL DEFAULT 'USER',
        "actor_id" uuid,
        "previous_status" character varying(30),
        "new_status" character varying(30),
        "subject_type" character varying(30),
        "subject_id" uuid,
        "summary" text NOT NULL,
        "metadata" jsonb,
        "source_event_id" character varying(200),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_claim_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_claim_events_source_event" UNIQUE ("source_event_id"),
        CONSTRAINT "FK_claim_events_claim" FOREIGN KEY ("claim_id")
          REFERENCES "claims"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_claim_events_claim_created"
      ON "claim_events" ("claim_id", "created_at")
    `);

    // Legacy statuses → controlled lifecycle (§4). A NOTIFIED claim without
    // a TIRA reference was never accepted by TIRA and becomes a draft (or
    // stays submitted while TIRA is still processing it).
    await queryRunner.query(`
      UPDATE "claims"
      SET "status" = CASE
        WHEN "status" IN ('NOTIFIED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING')
             AND "claim_reference_number" IS NOT NULL
          THEN 'NOTIFICATION_ACCEPTED'
        WHEN "status" IN ('NOTIFIED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING')
             AND "tiramis_status" IN ('PENDING', 'SUBMITTING', 'SENT_TO_TIRAMIS_SERVICE',
               'ACK_ACCEPTED', 'PENDING_FINAL', 'RETRY_PENDING', 'RETRYING', 'CALLBACK_OVERDUE')
          THEN 'NOTIFICATION_SUBMITTED'
        WHEN "status" IN ('NOTIFIED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING')
             AND "tiramis_status" IN ('FINAL_FAILED', 'ACK_FAILED', 'FAILED', 'RETRY_EXHAUSTED')
          THEN 'NOTIFICATION_FAILED'
        WHEN "status" IN ('NOTIFIED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING')
          THEN 'DRAFT'
        WHEN "status" = 'DISCHARGED' THEN 'DISCHARGE_ACCEPTED'
        ELSE "status"
      END
      WHERE "status" IN ('NOTIFIED', 'UNDER_REVIEW', 'DOCUMENTS_PENDING', 'DISCHARGED')
    `);
    await queryRunner.query(
      `ALTER TABLE "claims" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(`
      UPDATE "claims" SET "tiramis_reference_locked" = true
      WHERE "claim_reference_number" IS NOT NULL
    `);

    // Rejections were previously created already APPROVED; keep them so.
    await queryRunner.query(`
      UPDATE "claim_rejections" rejection
      SET "claim_intimation_number" = (
            SELECT intimation."claim_intimation_number"
            FROM "claim_intimations" intimation
            WHERE intimation."claim_id" = rejection."claim_id"
            ORDER BY intimation."created_at" DESC
            LIMIT 1
          ),
          "currency_code" = COALESCE(rejection."currency_code", claim."currency_code"),
          "exchange_rate" = claim."exchange_rate",
          "claim_amount" = claim."estimated_amount",
          "tira_rejection_reason" = LEFT(rejection."rejection_reason", 100)
      FROM "claims" claim
      WHERE claim."id" = rejection."claim_id"
        AND rejection."tira_rejection_reason" IS NULL
    `);

    for (const permission of CLAIMS_MIGRATION_PERMISSIONS) {
      await queryRunner.query(
        `
        INSERT INTO "permissions" (
          "id", "name", "display_name", "description", "is_system_generated",
          "assignment_scope", "assignable_to_company_role",
          "assignable_to_platform_role", "is_deprecated"
        )
        VALUES (uuid_generate_v4(), $1, $2, $3, true, 'shared', true, true, false)
        ON CONFLICT ("name") DO NOTHING
      `,
        [permission.name, permission.displayName, permission.description],
      );

      await queryRunner.query(
        `
        INSERT INTO "permission_role" ("roles_id", "permissions_id")
        SELECT DISTINCT existing."roles_id", target."id"
        FROM "permission_role" existing
        JOIN "permissions" legacy ON legacy."id" = existing."permissions_id"
        JOIN "permissions" target ON target."name" = $1
        WHERE legacy."name" = ANY($2::text[])
        ON CONFLICT DO NOTHING
      `,
        [permission.name, permission.legacy],
      );

      await queryRunner.query(
        `
        INSERT INTO "company_user_permissions" ("company_user_id", "permission_id")
        SELECT DISTINCT existing."company_user_id", target."id"
        FROM "company_user_permissions" existing
        JOIN "permissions" legacy ON legacy."id" = existing."permission_id"
        JOIN "permissions" target ON target."name" = $1
        WHERE legacy."name" = ANY($2::text[])
        ON CONFLICT ("company_user_id", "permission_id") DO NOTHING
      `,
        [permission.name, permission.legacy],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = CLAIMS_MIGRATION_PERMISSIONS.map((item) => item.name);

    await queryRunner.query(
      `
      DELETE FROM "company_user_permissions" grant_row
      USING "permissions" permission
      WHERE grant_row."permission_id" = permission."id"
        AND permission."name" = ANY($1::text[])
    `,
      [names],
    );
    await queryRunner.query(
      `
      DELETE FROM "permission_role" grant_row
      USING "permissions" permission
      WHERE grant_row."permissions_id" = permission."id"
        AND permission."name" = ANY($1::text[])
    `,
      [names],
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = ANY($1::text[])`,
      [names],
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "claim_events"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "claim_document_requirements"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_approvals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "claim_approval_limits"`);

    await queryRunner.query(`
      UPDATE "claims" SET "status" = CASE
        WHEN "status" IN ('DRAFT', 'NOTIFICATION_SUBMITTED', 'NOTIFICATION_FAILED',
          'NOTIFICATION_ACCEPTED', 'INTIMATION_PENDING', 'INTIMATION_SUBMITTED',
          'INTIMATION_FAILED') THEN 'NOTIFIED'
        WHEN "status" IN ('UNDER_ASSESSMENT', 'ASSESSED', 'PENDING_APPROVAL',
          'REASSESSMENT_REQUIRED') THEN 'ASSESSMENT_PENDING'
        WHEN "status" IN ('DISCHARGE_ISSUED', 'DISCHARGE_REJECTED') THEN 'DISCHARGE_PENDING'
        WHEN "status" = 'DISCHARGE_ACCEPTED' THEN 'DISCHARGED'
        WHEN "status" = 'SETTLED' THEN 'PAID'
        WHEN "status" = 'REJECTION_PENDING' THEN 'UNDER_REVIEW'
        ELSE "status"
      END
    `);
    await queryRunner.query(
      `ALTER TABLE "claims" ALTER COLUMN "status" SET DEFAULT 'NOTIFIED'`,
    );

    await queryRunner.query(`
      ALTER TABLE "claim_payments"
        DROP COLUMN IF EXISTS "payee_bank_details",
        DROP COLUMN IF EXISTS "claimants"
    `);
    await queryRunner.query(`
      ALTER TABLE "claim_rejections"
        DROP COLUMN IF EXISTS "submitted_at",
        DROP COLUMN IF EXISTS "submitted_by",
        DROP COLUMN IF EXISTS "previous_claim_status",
        DROP COLUMN IF EXISTS "letter_document_id",
        DROP COLUMN IF EXISTS "policy_clause_reference",
        DROP COLUMN IF EXISTS "recommendation",
        DROP COLUMN IF EXISTS "claimants",
        DROP COLUMN IF EXISTS "exchange_rate",
        DROP COLUMN IF EXISTS "currency_code",
        DROP COLUMN IF EXISTS "claim_amount",
        DROP COLUMN IF EXISTS "claim_resulted_litigation",
        DROP COLUMN IF EXISTS "tira_rejection_reason",
        DROP COLUMN IF EXISTS "claim_intimation_number"
    `);
    await queryRunner.query(`
      ALTER TABLE "claim_discharge_vouchers"
        DROP COLUMN IF EXISTS "generated_document_id",
        DROP COLUMN IF EXISTS "supersedes_voucher_id",
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "claimants",
        DROP COLUMN IF EXISTS "reconciled_amount",
        DROP COLUMN IF EXISTS "reconciliation_summary",
        DROP COLUMN IF EXISTS "reconciliation_date",
        DROP COLUMN IF EXISTS "adjustment_amount",
        DROP COLUMN IF EXISTS "adjustment_reason",
        DROP COLUMN IF EXISTS "adjustment_date",
        DROP COLUMN IF EXISTS "assessment_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "claim_assessments"
        DROP COLUMN IF EXISTS "remarks",
        DROP COLUMN IF EXISTS "recovery_amount",
        DROP COLUMN IF EXISTS "betterment_amount",
        DROP COLUMN IF EXISTS "contribution_amount",
        DROP COLUMN IF EXISTS "salvage_amount",
        DROP COLUMN IF EXISTS "deductible_amount",
        DROP COLUMN IF EXISTS "recommended_amount",
        DROP COLUMN IF EXISTS "inspection_date",
        DROP COLUMN IF EXISTS "assessor_company",
        DROP COLUMN IF EXISTS "assessor_name",
        DROP COLUMN IF EXISTS "supersedes_assessment_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "claim_intimations"
        DROP COLUMN IF EXISTS "submitted_at",
        DROP COLUMN IF EXISTS "submitted_by",
        DROP COLUMN IF EXISTS "assessor_user_id",
        DROP COLUMN IF EXISTS "assessor_company_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "claim_claimants"
        DROP COLUMN IF EXISTS "uses_policyholder",
        DROP COLUMN IF EXISTS "postal_address",
        DROP COLUMN IF EXISTS "fax",
        DROP COLUMN IF EXISTS "street",
        DROP COLUMN IF EXISTS "district",
        DROP COLUMN IF EXISTS "region",
        DROP COLUMN IF EXISTS "country_code",
        DROP COLUMN IF EXISTS "gender",
        DROP COLUMN IF EXISTS "birth_date",
        DROP COLUMN IF EXISTS "id_type",
        DROP COLUMN IF EXISTS "party_type",
        DROP COLUMN IF EXISTS "claimant_category"
    `);
    await queryRunner.query(`
      ALTER TABLE "claims"
        DROP COLUMN IF EXISTS "reopen_reason",
        DROP COLUMN IF EXISTS "reopened_by",
        DROP COLUMN IF EXISTS "reopened_at",
        DROP COLUMN IF EXISTS "tiramis_reference_locked",
        DROP COLUMN IF EXISTS "internal_notes",
        DROP COLUMN IF EXISTS "incident_details",
        DROP COLUMN IF EXISTS "reporter_email",
        DROP COLUMN IF EXISTS "reporter_phone",
        DROP COLUMN IF EXISTS "reporter_name",
        DROP COLUMN IF EXISTS "notification_source",
        DROP COLUMN IF EXISTS "department_id",
        DROP COLUMN IF EXISTS "claim_title"
    `);
    // business_document_sequences is shared by other document types and is
    // intentionally kept.
  }
}
