import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform TIRA profiles: one per environment, managed from
 * Platform → TIRAMIS Integration. Empty values fall back to environment
 * variables, so existing deployments keep working until a profile is saved.
 */
export class TiramisSystemProfiles1793300000000 implements MigrationInterface {
  name = 'TiramisSystemProfiles1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tiramis_system_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "environment" character varying(10) NOT NULL,
        "client_code" character varying(100),
        "client_key_encrypted" text,
        "system_code" character varying(50),
        "system_name" character varying(150),
        "base_url" character varying(500),
        "callback_url" character varying(500),
        "client_certificate_password_encrypted" text,
        "public_certificate_password_encrypted" text,
        "signature_algorithm" character varying(100),
        "allow_expired_certificates" boolean,
        "portal_webhook_api_key_encrypted" text,
        "portal_notification_events" jsonb,
        "validation_status" character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED',
        "validated_at" TIMESTAMP WITH TIME ZONE,
        "validation_message" text,
        "updated_by" character varying(100),
        CONSTRAINT "PK_tiramis_system_profiles" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_43b65b91e3ec0d042c3e040e88" ON "tiramis_system_profiles" ("environment")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tiramis_system_profiles"`);
  }
}
