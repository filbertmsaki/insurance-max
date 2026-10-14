import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCustomerKyc1794300000000 implements MigrationInterface {
  name = 'RemoveCustomerKyc1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission_scopes"
      WHERE "permission_id" IN (
        SELECT "id" FROM "permissions"
        WHERE "name" IN (
          'customer-kyc:read',
          'customer-kyc:submit',
          'customer-kyc:review',
          'customer-kyc:approve'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT "id" FROM "permissions"
        WHERE "name" IN (
          'customer-kyc:read',
          'customer-kyc:submit',
          'customer-kyc:review',
          'customer-kyc:approve'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM "company_user_permissions"
      WHERE "permission_id" IN (
        SELECT "id" FROM "permissions"
        WHERE "name" IN (
          'customer-kyc:read',
          'customer-kyc:submit',
          'customer-kyc:review',
          'customer-kyc:approve'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'customer-kyc:read',
        'customer-kyc:submit',
        'customer-kyc:review',
        'customer-kyc:approve'
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "FK_526a0e4622f2e6e3a21678731db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" DROP CONSTRAINT IF EXISTS "FK_999865462d0d46d73c12408d4c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_kyc_reviews" DROP CONSTRAINT IF EXISTS "FK_0ebe2ce751ec4cc2355c43b636d"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_kyc_reviews"`);

    await queryRunner.query(
      `ALTER TABLE "quotations" DROP COLUMN IF EXISTS "customer_kyc_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_verified_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "kyc_rejection_reason"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."customer_kyc_status_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."customer_kyc_status_enum" AS ENUM(
        'PENDING',
        'IN_REVIEW',
        'VERIFIED',
        'REJECTED',
        'REQUIRES_UPDATE',
        'EXPIRED'
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_status" "public"."customer_kyc_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_version" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_verified_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN "kyc_rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ADD COLUMN "customer_kyc_version" integer`,
    );
    await queryRunner.query(`
      CREATE TABLE "customer_kyc_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "kyc_version" integer NOT NULL,
        "status" character varying(30) NOT NULL,
        "customer_snapshot" jsonb NOT NULL,
        "customer_snapshot_hash" character varying(64) NOT NULL,
        "submission_notes" text,
        "rejection_reason" text,
        "submitted_by" uuid,
        "submitted_at" TIMESTAMP WITH TIME ZONE,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_kyc_reviews" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_kyc_reviews"
      ADD CONSTRAINT "FK_customer_kyc_reviews_company"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_kyc_reviews"
      ADD CONSTRAINT "FK_customer_kyc_reviews_customer"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD CONSTRAINT "FK_customers_kyc_verified_by"
      FOREIGN KEY ("kyc_verified_by") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }
}
