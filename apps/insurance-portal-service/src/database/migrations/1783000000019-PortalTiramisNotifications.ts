import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalTiramisNotifications1783000000019
  implements MigrationInterface
{
  name = 'PortalTiramisNotifications1783000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tiramis_notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying(100) NOT NULL,
        "correlation_id" character varying(150),
        "event_key" character varying(180),
        "dedupe_key" character varying(255),
        "channel" character varying(40) NOT NULL DEFAULT 'IN_APP',
        "delivery_status" character varying(40) NOT NULL DEFAULT 'PENDING',
        "delivery_attempts" integer NOT NULL DEFAULT 0,
        "last_delivery_attempt_at" TIMESTAMP WITH TIME ZONE,
        "delivered_at" TIMESTAMP WITH TIME ZONE,
        "delivery_error_message" text,
        "severity" character varying(30) NOT NULL DEFAULT 'WARNING',
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "request_type" character varying(80),
        "source_company_id" uuid,
        "source_user_id" uuid,
        "source_module" character varying(100),
        "source_record_id" character varying(150),
        "business_reference" character varying(150),
        "local_tracking_id" uuid,
        "tiramis_transaction_id" uuid,
        "tiramis_request_id" character varying(100),
        "status" character varying(80),
        "error_message" text,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "read_by_user_id" uuid,
        "dismissed_at" TIMESTAMP WITH TIME ZONE,
        "dismissed_by_user_id" uuid,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_type" ON "tiramis_notifications" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_severity" ON "tiramis_notifications" ("severity")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_source_company_id" ON "tiramis_notifications" ("source_company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_source_user_id" ON "tiramis_notifications" ("source_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_source_module" ON "tiramis_notifications" ("source_module")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_source_record_id" ON "tiramis_notifications" ("source_record_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_business_reference" ON "tiramis_notifications" ("business_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_correlation_id" ON "tiramis_notifications" ("correlation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_event_key" ON "tiramis_notifications" ("event_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_dedupe_key" ON "tiramis_notifications" ("dedupe_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_local_tracking_id" ON "tiramis_notifications" ("local_tracking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_delivery_status" ON "tiramis_notifications" ("delivery_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_is_read" ON "tiramis_notifications" ("is_read")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tiramis_notifications_created_at" ON "tiramis_notifications" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_is_read"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_local_tracking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_business_reference"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_source_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_source_module"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_source_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_source_company_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_severity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tiramis_notifications_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tiramis_notifications"`);
  }
}
