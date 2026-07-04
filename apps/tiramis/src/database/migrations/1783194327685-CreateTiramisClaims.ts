import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTiramisClaims1783194327685 implements MigrationInterface {
  name = 'CreateTiramisClaims1783194327685';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "tiramis_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "transaction_id" uuid NOT NULL, "current_attempt_id" uuid, "request_id" character varying(100) NOT NULL, "claim_type" character varying(50) NOT NULL, "service_type" character varying(80) NOT NULL, "root_element" character varying(100) NOT NULL, "company_code" character varying(20) NOT NULL, "system_code" character varying(30) NOT NULL, "callback_url" character varying(500) NOT NULL, "insurer_company_code" character varying(20) NOT NULL, "tran_company_code" character varying(20), "claim_notification_number" character varying(100), "claim_reference_number" character varying(100), "cover_note_reference_number" character varying(100), "claim_report_date" TIMESTAMP WITH TIME ZONE, "claim_form_dully_filled" character varying(1), "loss_date" TIMESTAMP WITH TIME ZONE, "loss_nature" character varying(255), "loss_type" character varying(255), "loss_location" character varying(255), "officer_name" character varying(150), "officer_title" character varying(150), "raw_data" jsonb, CONSTRAINT "PK_tiramis_claims" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_transaction_id" ON "tiramis_claims" ("transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_request_id" ON "tiramis_claims" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_type" ON "tiramis_claims" ("claim_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_notification_number" ON "tiramis_claims" ("claim_notification_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_claim_reference_number" ON "tiramis_claims" ("claim_reference_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_claims_cover_note_reference_number" ON "tiramis_claims" ("cover_note_reference_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_cover_note_reference_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_reference_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_notification_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_claim_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_claims_transaction_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_claims"`);
  }
}
