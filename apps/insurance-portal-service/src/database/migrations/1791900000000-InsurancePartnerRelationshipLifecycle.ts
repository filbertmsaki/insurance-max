import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsurancePartnerRelationshipLifecycle1791900000000 implements MigrationInterface {
  name = 'InsurancePartnerRelationshipLifecycle1791900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The old index incorrectly prevented an agency from appointing with
    // more than one insurer, which is a core multi-insurer requirement.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_current_agency_one_insurer"`,
    );
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN "verification_status" varchar(24) NOT NULL DEFAULT 'VERIFIED',
      ADD COLUMN "verified_by" uuid,
      ADD COLUMN "verified_at" timestamptz,
      ADD COLUMN "verification_note" text,
      ADD CONSTRAINT "CHK_companies_verification_status"
        CHECK ("verification_status" IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED'))
    `);
    await queryRunner.query(`
      ALTER TABLE "insurance_company_partners"
      ADD COLUMN "requested_by_company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "insurance_company_partner_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "relationship_id" uuid NOT NULL REFERENCES "insurance_company_partners"("id") ON DELETE CASCADE,
        "actor_company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
        "actor_user_id" uuid,
        "event_type" varchar(40) NOT NULL,
        "previous_status" varchar(20),
        "new_status" varchar(20),
        "notes" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_insurance_partner_events_relationship_created"
      ON "insurance_company_partner_events" ("relationship_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_insurance_partner_events_relationship_created"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "insurance_company_partner_events"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_company_partners" DROP COLUMN IF EXISTS "requested_by_company_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP CONSTRAINT IF EXISTS "CHK_companies_verification_status",
      DROP COLUMN IF EXISTS "verification_note",
      DROP COLUMN IF EXISTS "verified_at",
      DROP COLUMN IF EXISTS "verified_by",
      DROP COLUMN IF EXISTS "verification_status"
    `);
  }
}
