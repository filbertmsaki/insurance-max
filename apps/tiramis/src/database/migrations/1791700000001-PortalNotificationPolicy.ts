import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalNotificationPolicy1791700000001 implements MigrationInterface {
  name = 'PortalNotificationPolicy1791700000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" ADD COLUMN IF NOT EXISTS "portal_notification_events" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_callback_receipts" ADD COLUMN IF NOT EXISTS "signature_verification_reason" varchar(255)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tiramis_client_configurations" DROP COLUMN IF EXISTS "portal_notification_events"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tiramis_callback_receipts" DROP COLUMN IF EXISTS "signature_verification_reason"`,
    );
  }
}
