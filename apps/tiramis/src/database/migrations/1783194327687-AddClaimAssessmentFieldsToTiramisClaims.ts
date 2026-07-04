import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClaimAssessmentFieldsToTiramisClaims1783194327687
  implements MigrationInterface
{
  name = 'AddClaimAssessmentFieldsToTiramisClaims1783194327687';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_assessment_number" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessment_received_date" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessment_report_summary" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "assessment_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "approved_claim_amount" numeric(36,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_approval_date" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "claim_approval_authority" varchar(150) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "is_reassessment" varchar(1) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_assessment_number" ON "tiramis_claims" ("claim_assessment_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_assessment_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "is_reassessment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_approval_authority"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_approval_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "approved_claim_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessment_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessment_report_summary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "assessment_received_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "claim_assessment_number"`,
    );
  }
}
