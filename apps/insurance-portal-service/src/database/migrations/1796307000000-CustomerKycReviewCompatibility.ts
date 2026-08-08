import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerKycReviewCompatibility1796307000000
  implements MigrationInterface
{
  name = 'CustomerKycReviewCompatibility1796307000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_kyc_reviews"
      ADD COLUMN IF NOT EXISTS "customer_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "customer_snapshot_hash" character varying(64),
      ADD COLUMN IF NOT EXISTS "submission_notes" text,
      ADD COLUMN IF NOT EXISTS "rejection_reason" text,
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      UPDATE "customer_kyc_reviews"
      SET
        "customer_snapshot" = COALESCE("customer_snapshot", "snapshot"),
        "customer_snapshot_hash" = COALESCE("customer_snapshot_hash", "snapshot_hash"),
        "rejection_reason" = COALESCE("rejection_reason", "decision_reason"),
        "updated_at" = COALESCE("updated_at", "created_at", now())
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_kyc_reviews"
      ALTER COLUMN "customer_snapshot" SET NOT NULL,
      ALTER COLUMN "customer_snapshot_hash" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_kyc_reviews"
      DROP COLUMN IF EXISTS "updated_at",
      DROP COLUMN IF EXISTS "expires_at",
      DROP COLUMN IF EXISTS "rejection_reason",
      DROP COLUMN IF EXISTS "submission_notes",
      DROP COLUMN IF EXISTS "customer_snapshot_hash",
      DROP COLUMN IF EXISTS "customer_snapshot"
    `);
  }
}
