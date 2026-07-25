import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiraSubmissions1783000000010 implements MigrationInterface {
  name = 'PortalTiraSubmissions1783000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."portal_tira_submission_status_enum" AS ENUM('DRAFT', 'VALIDATED', 'SUBMITTED_TO_TIRAMIS', 'SENT_TO_TIRA', 'ACK_SUCCESS', 'ACK_FAILED', 'WAITING_FINAL_RESPONSE', 'FINAL_SUCCESS', 'FINAL_FAILED', 'COMPLETED', 'FAILED', 'CALLBACK_REJECTED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "portal_tira_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "policy_id" uuid, "quotation_id" uuid, "source_module" character varying(80), "source_record_id" character varying(100), "business_reference" character varying(100), "request_type" character varying(50), "service_type" character varying(50), "root_element" character varying(100), "tiramis_transaction_id" character varying(100), "tiramis_request_id" character varying(100), "tiramis_response_id" character varying(100), "status" "public"."portal_tira_submission_status_enum" NOT NULL DEFAULT 'DRAFT', "status_code" character varying(50), "status_description" character varying(255), "cover_note_reference_number" character varying(100), "policy_reference_number" character varying(100), "sticker_number" character varying(100), "last_error" text, "last_payload" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "last_event_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_portal_tira_submissions" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "portal_tira_submission_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" uuid NOT NULL, "company_id" uuid NOT NULL, "tiramis_transaction_id" character varying(100), "request_id" character varying(100) NOT NULL, "response_id" character varying(100), "event_type" character varying(100) NOT NULL, "status_code" character varying(50), "status_description" character varying(255), "error_message" text, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_portal_tira_submission_events" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_pts_company_id" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_pts_policy_id" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" ADD CONSTRAINT "FK_pts_quotation_id" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submission_events" ADD CONSTRAINT "FK_ptse_submission_id" FOREIGN KEY ("submission_id") REFERENCES "portal_tira_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_pts_company_id" ON "portal_tira_submissions" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_policy_id" ON "portal_tira_submissions" ("policy_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_quotation_id" ON "portal_tira_submissions" ("quotation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_status" ON "portal_tira_submissions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_request_id" ON "portal_tira_submissions" ("tiramis_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_transaction_id" ON "portal_tira_submissions" ("tiramis_transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pts_business_reference" ON "portal_tira_submissions" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_submission_id" ON "portal_tira_submission_events" ("submission_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_request_id" ON "portal_tira_submission_events" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_event_type" ON "portal_tira_submission_events" ("event_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ptse_created_at" ON "portal_tira_submission_events" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ptse_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_ptse_event_type"`);
    await queryRunner.query(`DROP INDEX "IDX_ptse_request_id"`);
    await queryRunner.query(`DROP INDEX "IDX_ptse_submission_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_business_reference"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_transaction_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_request_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_status"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_quotation_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_policy_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pts_company_id"`);

    await queryRunner.query(
      `ALTER TABLE "portal_tira_submission_events" DROP CONSTRAINT "FK_ptse_submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_pts_quotation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_pts_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tira_submissions" DROP CONSTRAINT "FK_pts_company_id"`,
    );

    await queryRunner.query(`DROP TABLE "portal_tira_submission_events"`);
    await queryRunner.query(`DROP TABLE "portal_tira_submissions"`);
    await queryRunner.query(
      `DROP TYPE "public"."portal_tira_submission_status_enum"`,
    );
  }
}
