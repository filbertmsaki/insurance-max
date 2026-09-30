import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DischargeVoucherRes callbacks were routed to tiramis_claims and silently
 * lost; vouchers now record their own final TIRA response.
 */
export class AddDischargeVoucherFinalResponse1790800000000 implements MigrationInterface {
  name = 'AddDischargeVoucherFinalResponse1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_discharge_vouchers"
        ADD COLUMN IF NOT EXISTS "final_response_id" character varying(100),
        ADD COLUMN IF NOT EXISTS "final_response_status_code" character varying(20),
        ADD COLUMN IF NOT EXISTS "final_response_status_desc" character varying(255),
        ADD COLUMN IF NOT EXISTS "final_response_received_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "final_response_payload" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_discharge_vouchers"
        DROP COLUMN IF EXISTS "final_response_payload",
        DROP COLUMN IF EXISTS "final_response_received_at",
        DROP COLUMN IF EXISTS "final_response_status_desc",
        DROP COLUMN IF EXISTS "final_response_status_code",
        DROP COLUMN IF EXISTS "final_response_id"`,
    );
  }
}
