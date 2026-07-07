import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTiramisTrackingColumnsToMotorPolicyDetails1783000000022
  implements MigrationInterface
{
  name = 'AddTiramisTrackingColumnsToMotorPolicyDetails1783000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_submission_tracking_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_status" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_transaction_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_request_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_service_type" character varying(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_root_element" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_acknowledgement_status_code" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_acknowledgement_status_desc" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_final_response_id" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_final_response_status_code" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_final_response_status_desc" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_last_error_message" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" ADD COLUMN IF NOT EXISTS "tiramis_last_synced_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_last_synced_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_last_error_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_final_response_status_desc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_final_response_status_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_final_response_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_acknowledgement_status_desc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_acknowledgement_status_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_root_element"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_service_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "motor_policy_details" DROP COLUMN IF EXISTS "tiramis_submission_tracking_id"`,
    );
  }
}
