import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisSubmissionTracking1783000000011
  implements MigrationInterface
{
  name = 'PortalTiramisSubmissionTracking1783000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "tiramis_submission_tracking" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "request_type" character varying(80) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "source_service" character varying(100) NOT NULL DEFAULT 'insurance-portal-service', "source_company_id" uuid, "source_user_id" uuid, "source_module" character varying(100), "source_record_id" character varying(150), "policy_id" character varying(150), "quotation_id" character varying(150), "business_reference" character varying(150), "tiramis_transaction_id" uuid, "tiramis_request_id" character varying(100), "tiramis_service_type" character varying(80), "tiramis_root_element" character varying(100), "acknowledgement_status_code" character varying(20), "acknowledgement_status_desc" character varying(255), "last_error_message" text, "request_payload" jsonb, "tiramis_response_payload" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "failed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_tiramis_submission_tracking" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_request_type" ON "tiramis_submission_tracking" ("request_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_business_reference" ON "tiramis_submission_tracking" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_source_company_id" ON "tiramis_submission_tracking" ("source_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_source_record_id" ON "tiramis_submission_tracking" ("source_record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_transaction_id" ON "tiramis_submission_tracking" ("tiramis_transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_request_id" ON "tiramis_submission_tracking" ("tiramis_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_status" ON "tiramis_submission_tracking" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_transaction_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_source_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_source_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_business_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_request_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_submission_tracking"`);
  }
}
