import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformTiramisConnectionProfiles1794200000000 implements MigrationInterface {
  name = 'PlatformTiramisConnectionProfiles1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tiramis_connection_profiles" (
        "environment" character varying(10) NOT NULL,
        "base_url" character varying(500),
        "candidate_base_url" character varying(500),
        "service_api_key_encrypted" text,
        "webhook_source_ip" character varying(100),
        "portal_webhook_url" character varying(500),
        "candidate_portal_webhook_url" character varying(500),
        "validation_status" character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED',
        "validated_at" TIMESTAMP WITH TIME ZONE,
        "last_test_result" jsonb,
        "previous_base_url" character varying(500),
        "updated_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_connection_profiles" PRIMARY KEY ("environment"),
        CONSTRAINT "CHK_tiramis_connection_profiles_environment" CHECK ("environment" IN ('uat', 'production'))
      )`);

    await queryRunner.query(`
      INSERT INTO "tiramis_connection_profiles" ("environment")
      VALUES ('uat'), ('production')
      ON CONFLICT ("environment") DO NOTHING`);

    // Preserve previously provisioned platform keys during the transition.
    if (
      await queryRunner.hasColumn(
        'tiramis_platform_settings',
        'service_api_key_encrypted',
      )
    ) {
      await queryRunner.query(`
        UPDATE "tiramis_connection_profiles" p
        SET "service_api_key_encrypted" = s."service_api_key_encrypted"
        FROM "tiramis_platform_settings" s
        WHERE s."id" = 'platform' AND p."environment" = s."active_environment"
          AND p."service_api_key_encrypted" IS NULL`);
    }
    if (
      await queryRunner.hasColumn(
        'tiramis_platform_settings',
        'service_api_key_test_encrypted',
      )
    ) {
      await queryRunner.query(`
        UPDATE "tiramis_connection_profiles" p
        SET "service_api_key_encrypted" = s."service_api_key_test_encrypted"
        FROM "tiramis_platform_settings" s
        WHERE s."id" = 'platform' AND p."environment" = 'uat'
          AND p."service_api_key_encrypted" IS NULL`);
    }
    if (
      await queryRunner.hasColumn(
        'tiramis_platform_settings',
        'service_api_key_live_encrypted',
      )
    ) {
      await queryRunner.query(`
        UPDATE "tiramis_connection_profiles" p
        SET "service_api_key_encrypted" = s."service_api_key_live_encrypted"
        FROM "tiramis_platform_settings" s
        WHERE s."id" = 'platform' AND p."environment" = 'production'
          AND p."service_api_key_encrypted" IS NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tiramis_connection_profiles"`);
  }
}
