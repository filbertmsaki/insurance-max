import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsurancePartnerAgreementAmendments1792400000000 implements MigrationInterface {
  name = 'InsurancePartnerAgreementAmendments1792400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."insurance_company_partner_amendments_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')`,
    );
    await queryRunner.query(`CREATE TABLE "insurance_company_partner_amendments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "relationship_id" uuid NOT NULL,
      "proposed_by_company_id" uuid NOT NULL,
      "proposed_by_user_id" uuid NOT NULL,
      "proposed_terms" jsonb NOT NULL,
      "note" text,
      "status" "public"."insurance_company_partner_amendments_status_enum" NOT NULL DEFAULT 'PENDING',
      "responded_by_company_id" uuid,
      "responded_by_user_id" uuid,
      "response_reason" text,
      "responded_at" timestamptz,
      "applied_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_partner_amendments" PRIMARY KEY ("id"),
      CONSTRAINT "FK_partner_amendments_relationship" FOREIGN KEY ("relationship_id") REFERENCES "insurance_company_partners"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_partner_amendments_relationship_created" ON "insurance_company_partner_amendments" ("relationship_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_partner_amendments_one_pending" ON "insurance_company_partner_amendments" ("relationship_id") WHERE "status" = 'PENDING'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_partner_amendments_one_pending"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "insurance_company_partner_amendments"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."insurance_company_partner_amendments_status_enum"`,
    );
  }
}
