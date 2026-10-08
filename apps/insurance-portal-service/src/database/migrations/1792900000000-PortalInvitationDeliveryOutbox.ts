import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Portal invitation emails move from a direct send inside the request to an
 * outbox with delivery status, retries and dead-lettering. Invitations that
 * exist already were sent directly, so they are recorded as SENT.
 */
export class PortalInvitationDeliveryOutbox1792900000000 implements MigrationInterface {
  name = 'PortalInvitationDeliveryOutbox1792900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "portal_invitations"
        ADD COLUMN "delivery_status" varchar(20) NOT NULL DEFAULT 'QUEUED',
        ADD COLUMN "delivery_attempts" integer NOT NULL DEFAULT 0,
        ADD COLUMN "next_delivery_attempt_at" timestamptz,
        ADD COLUMN "last_delivery_attempt_at" timestamptz,
        ADD COLUMN "last_delivery_error" text,
        ADD COLUMN "sent_at" timestamptz,
        ADD COLUMN "resend_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "delivery_token_ciphertext" text
    `);
    await queryRunner.query(`
      UPDATE "portal_invitations"
      SET "delivery_status" = 'SENT', "sent_at" = "created_at"
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_portal_invitations_delivery_due"
      ON "portal_invitations" ("delivery_status", "next_delivery_attempt_at")
      WHERE "delivery_status" IN ('QUEUED', 'FAILED', 'SENDING')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_portal_invitations_delivery_due"`,
    );
    await queryRunner.query(`
      ALTER TABLE "portal_invitations"
        DROP COLUMN IF EXISTS "delivery_token_ciphertext",
        DROP COLUMN IF EXISTS "resend_count",
        DROP COLUMN IF EXISTS "sent_at",
        DROP COLUMN IF EXISTS "last_delivery_error",
        DROP COLUMN IF EXISTS "last_delivery_attempt_at",
        DROP COLUMN IF EXISTS "next_delivery_attempt_at",
        DROP COLUMN IF EXISTS "delivery_attempts",
        DROP COLUMN IF EXISTS "delivery_status"
    `);
  }
}
