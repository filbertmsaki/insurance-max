import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomersModule1783000000002 implements MigrationInterface {
  name = 'CustomersModule1783000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."customer_type_enum" AS ENUM('INDIVIDUAL', 'CORPORATE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_gender_enum" AS ENUM('M', 'F')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_kyc_status_enum" AS ENUM('PENDING', 'VERIFIED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_document_type_enum" AS ENUM('NIDA', 'VOTER_ID', 'PASSPORT', 'DRIVING_LICENSE', 'ZANID', 'TIN_CERTIFICATE', 'VRN_CERTIFICATE', 'BUSINESS_REGISTRATION', 'INCORPORATION_CERTIFICATE', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'BLACKLISTED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "customer_no" character varying(30) NOT NULL, "customer_type" "public"."customer_type_enum" NOT NULL, "first_name" character varying(50), "middle_name" character varying(50), "last_name" character varying(50), "gender" "public"."customer_gender_enum", "date_of_birth" date, "nationality" character varying(100), "company_name" character varying(150), "registration_no" character varying(100), "incorporation_certificate_no" character varying(100), "tin" character varying(100), "vrn" character varying(100), "policy_holder_type" smallint, "id_type" smallint, "id_number" character varying(50), "nida_no" character varying(50), "voter_no" character varying(50), "passport_no" character varying(50), "driving_license_no" character varying(50), "zanid_no" character varying(50), "phone" character varying(30) NOT NULL, "alternate_phone" character varying(30), "fax" character varying(30), "email" character varying(100), "country" character varying(100), "country_code" character varying(3) NOT NULL, "region" character varying(50) NOT NULL, "district" character varying(50) NOT NULL, "ward" character varying(50), "street" character varying(50), "postal_address" character varying(50), "latitude" numeric(10,6), "longitude" numeric(10,6), "contact_name" character varying(100), "contact_role" character varying(100), "contact_phone" character varying(30), "contact_email" character varying(100), "kyc_status" "public"."customer_kyc_status_enum" NOT NULL DEFAULT 'PENDING', "document_type" "public"."customer_document_type_enum", "document_no" character varying(50), "document_file_name" character varying(255), "document_file_url" character varying(500), "document_mime_type" character varying(100), "document_verified" boolean NOT NULL DEFAULT false, "document_verified_by" uuid, "document_verified_at" TIMESTAMP WITH TIME ZONE, "status" "public"."customer_status_enum" NOT NULL DEFAULT 'ACTIVE', "metadata" jsonb, "created_by" uuid, "updated_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_customers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_id" ON "customers" ("company_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_status" ON "customers" ("company_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_company_customer_type" ON "customers" ("company_id", "customer_type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_customers_company_customer_no" ON "customers" ("company_id", "customer_no") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_phone_active" ON "customers" ("company_id", "phone") WHERE deleted_at IS NULL AND phone IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_email_active" ON "customers" ("company_id", "email") WHERE deleted_at IS NULL AND email IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_id_number_active" ON "customers" ("company_id", "id_number") WHERE deleted_at IS NULL AND id_number IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_nida_no_active" ON "customers" ("company_id", "nida_no") WHERE deleted_at IS NULL AND nida_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_voter_no_active" ON "customers" ("company_id", "voter_no") WHERE deleted_at IS NULL AND voter_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_passport_no_active" ON "customers" ("company_id", "passport_no") WHERE deleted_at IS NULL AND passport_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_driving_license_no_active" ON "customers" ("company_id", "driving_license_no") WHERE deleted_at IS NULL AND driving_license_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_zanid_no_active" ON "customers" ("company_id", "zanid_no") WHERE deleted_at IS NULL AND zanid_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_tin_active" ON "customers" ("company_id", "tin") WHERE deleted_at IS NULL AND tin IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_registration_no_active" ON "customers" ("company_id", "registration_no") WHERE deleted_at IS NULL AND registration_no IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_customers_company_incorp_cert_no_active" ON "customers" ("company_id", "incorporation_certificate_no") WHERE deleted_at IS NULL AND incorporation_certificate_no IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "FK_customers_document_verified_by" FOREIGN KEY ("document_verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_document_verified_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "FK_customers_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_incorp_cert_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_registration_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_tin_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_zanid_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_driving_license_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_passport_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_voter_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_nida_no_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_id_number_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_email_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_customers_company_phone_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_customer_no"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_customer_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_company_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_company_id"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TYPE "public"."customer_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_document_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_kyc_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_gender_enum"`);
    await queryRunner.query(`DROP TYPE "public"."customer_type_enum"`);
  }
}
