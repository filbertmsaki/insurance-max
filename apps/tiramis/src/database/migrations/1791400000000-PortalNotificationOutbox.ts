import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalNotificationOutbox1791400000000 implements MigrationInterface {
  name = 'PortalNotificationOutbox1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tiramis_portal_notification_outbox" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_key" character varying(255) NOT NULL,
        "request_id" character varying(100) NOT NULL,
        "response_id" character varying(100),
        "event_type" character varying(100) NOT NULL,
        "webhook_url" character varying(500) NOT NULL,
        "client_configuration_id" uuid,
        "payload" jsonb NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "attempt_count" integer NOT NULL DEFAULT 0,
        "next_attempt_at" TIMESTAMP,
        "last_attempt_at" TIMESTAMP,
        "sent_at" TIMESTAMP,
        "last_error" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_portal_notification_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tiramis_portal_notification_outbox_event_key" UNIQUE ("event_key")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_portal_notification_outbox_status_next" ON "tiramis_portal_notification_outbox" ("status", "next_attempt_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_portal_notification_outbox_request" ON "tiramis_portal_notification_outbox" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_portal_notification_outbox_response" ON "tiramis_portal_notification_outbox" ("response_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_portal_notification_outbox_response"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_portal_notification_outbox_request"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_tiramis_portal_notification_outbox_status_next"`,
    );
    await queryRunner.query(`DROP TABLE "tiramis_portal_notification_outbox"`);
  }
}
