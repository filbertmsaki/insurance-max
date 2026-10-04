import { MigrationInterface, QueryRunner } from 'typeorm';

export class TiramisNotificationReceipts1791400000000 implements MigrationInterface {
  name = 'TiramisNotificationReceipts1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tiramis_notification_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_key" character varying(255) NOT NULL,
        "request_id" character varying(100) NOT NULL,
        "response_id" character varying(100),
        "event_type" character varying(100) NOT NULL,
        "payload_hash" character varying(128),
        "processing_status" character varying(30) NOT NULL DEFAULT 'PROCESSING',
        "receive_count" integer NOT NULL DEFAULT 1,
        "last_received_at" TIMESTAMP,
        "last_error" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_notification_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_notification_receipts_event_key" UNIQUE ("event_key")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_notification_receipts_request" ON "tiramis_notification_receipts" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_notification_receipts_response" ON "tiramis_notification_receipts" ("response_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_notification_receipts_response"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_notification_receipts_request"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_notification_receipts"`);
  }
}
