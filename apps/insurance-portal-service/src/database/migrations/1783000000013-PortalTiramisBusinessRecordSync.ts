import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisBusinessRecordSync1783000000013
  implements MigrationInterface
{
  name = 'PortalTiramisBusinessRecordSync1783000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "business_record_synced_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "business_record_sync_error" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" ADD COLUMN IF NOT EXISTS "business_record_sync_attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tiramis_tracking_business_record_synced_at" ON "tiramis_submission_tracking" ("business_record_synced_at")`,
    );

    const businessTables = [
      'policies',
      'motor_fleets',
      'non_motor_policy_details',
    ];

    for (const table of businessTables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_submission_tracking_id" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_status" varchar(50)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_transaction_id" uuid`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_request_id" varchar(100)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_service_type" varchar(80)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_root_element" varchar(100)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_acknowledgement_status_code" varchar(20)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_acknowledgement_status_desc" varchar(255)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_final_response_id" varchar(100)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_final_response_status_code" varchar(20)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_final_response_status_desc" varchar(255)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_last_error_message" text`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const businessTables = [
      'policies',
      'motor_fleets',
      'non_motor_policy_details',
    ];

    for (const table of businessTables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_last_synced_at"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_last_error_message"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_final_response_status_desc"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_final_response_status_code"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_final_response_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_acknowledgement_status_desc"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_acknowledgement_status_code"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_root_element"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_service_type"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_request_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_transaction_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_status"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tiramis_submission_tracking_id"`,
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tiramis_tracking_business_record_synced_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "business_record_sync_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "business_record_sync_error"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_submission_tracking" DROP COLUMN IF EXISTS "business_record_synced_at"`,
    );
  }
}
