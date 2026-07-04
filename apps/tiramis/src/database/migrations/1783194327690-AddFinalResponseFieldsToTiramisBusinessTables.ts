import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinalResponseFieldsToTiramisBusinessTables1783194327690
  implements MigrationInterface
{
  name = 'AddFinalResponseFieldsToTiramisBusinessTables1783194327690';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "final_response_id" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "final_response_status_code" varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "final_response_status_desc" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "final_response_received_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" ADD COLUMN IF NOT EXISTS "final_response_payload" jsonb NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD COLUMN IF NOT EXISTS "final_response_id" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD COLUMN IF NOT EXISTS "final_response_status_code" varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD COLUMN IF NOT EXISTS "final_response_status_desc" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD COLUMN IF NOT EXISTS "final_response_received_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" ADD COLUMN IF NOT EXISTS "final_response_payload" jsonb NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "final_response_id" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "final_response_status_code" varchar(20) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "final_response_status_desc" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "final_response_received_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" ADD COLUMN IF NOT EXISTS "final_response_payload" jsonb NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "final_response_payload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "final_response_received_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "final_response_status_desc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "final_response_status_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_claims" DROP COLUMN IF EXISTS "final_response_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN IF EXISTS "final_response_payload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN IF EXISTS "final_response_received_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN IF EXISTS "final_response_status_desc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN IF EXISTS "final_response_status_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_policies" DROP COLUMN IF EXISTS "final_response_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "final_response_payload"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "final_response_received_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "final_response_status_desc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "final_response_status_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_reinsurances" DROP COLUMN IF EXISTS "final_response_id"`,
    );
  }
}
