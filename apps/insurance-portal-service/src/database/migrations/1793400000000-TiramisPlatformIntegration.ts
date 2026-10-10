import { MigrationInterface, QueryRunner } from 'typeorm';

const PLATFORM_PERMISSIONS: Array<[string, string, string]> = [
  [
    'platform:tiramis-integration:read',
    'View TIRAMIS integration',
    'View the platform TIRAMIS integration: profiles, environment, credentials status and linked companies.',
  ],
  [
    'platform:tiramis-integration:manage',
    'Manage TIRAMIS integration',
    'Manage the platform TIRA identity, credentials, certificates, keys and notification settings.',
  ],
  [
    'platform:tiramis-integration:switch-environment',
    'Switch TIRAMIS environment',
    'Switch the platform-wide active TIRA environment between Test and Production.',
  ],
  [
    'platform:tiramis-integration:company-access',
    'Manage company TIRAMIS access',
    'Link companies to TIRAMIS and grant, revoke or restore their integration access.',
  ],
];

/** Technical TIRAMIS permissions that companies must no longer hold. */
const PLATFORM_ONLY_PERMISSIONS = [
  'company-tiramis-config:read',
  'company-tiramis-config:update',
  'company-tiramis-config:validate',
  'tiramis.config.view',
  'tiramis.config.manage',
];

/**
 * Centralizes the TIRAMIS integration at platform level:
 * - tiramis_platform_settings: active environment and platform credentials;
 * - tiramis_company_links: each company's link and access status, backfilled
 *   from today's per-company configurations;
 * - platform-only permissions; technical TIRAMIS permissions leave company roles.
 */
export class TiramisPlatformIntegration1793400000000 implements MigrationInterface {
  name = 'TiramisPlatformIntegration1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tiramis_platform_settings" (
        "id" character varying(20) NOT NULL DEFAULT 'platform',
        "active_environment" character varying(10) NOT NULL DEFAULT 'test',
        "service_api_key_test_encrypted" text,
        "service_api_key_live_encrypted" text,
        "integration_permissions" jsonb,
        "test_validation_status" character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED',
        "test_validated_at" TIMESTAMP WITH TIME ZONE,
        "live_validation_status" character varying(20) NOT NULL DEFAULT 'NOT_VALIDATED',
        "live_validated_at" TIMESTAMP WITH TIME ZONE,
        "environment_switched_at" TIMESTAMP WITH TIME ZONE,
        "environment_switched_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_platform_settings" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(`
      CREATE TABLE "tiramis_company_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "company_name" character varying(150) NOT NULL,
        "insurer_company_code" character varying(30) NOT NULL,
        "insurer_company_name" character varying(150) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'LINKED',
        "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "linked_by" uuid,
        "activated_at" TIMESTAMP WITH TIME ZONE,
        "activated_by" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "revoked_by" uuid,
        "revoke_reason" text,
        "restored_at" TIMESTAMP WITH TIME ZONE,
        "restored_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tiramis_company_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tiramis_company_links_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tiramis_company_links_company" ON "tiramis_company_links" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tiramis_company_links_status" ON "tiramis_company_links" ("status")`,
    );

    // Platform settings from today's per-company state: live if any company
    // had activated live; an environment counts as validated if any company's
    // configuration for it was validated (the TIRA identity is shared).
    await queryRunner.query(`
      INSERT INTO "tiramis_platform_settings" (
        "id", "active_environment",
        "test_validation_status", "test_validated_at",
        "live_validation_status", "live_validated_at"
      )
      SELECT 'platform',
        CASE WHEN EXISTS (
          SELECT 1 FROM "companies"
           WHERE "settings"->>'tiramis_target_environment' = 'live'
        ) THEN 'live' ELSE 'test' END,
        CASE WHEN bool_or(c."environment" = 'test' AND c."validation_status" = 'VALID')
          THEN 'VALID' ELSE 'NOT_VALIDATED' END,
        max(c."validated_at") FILTER (WHERE c."environment" = 'test' AND c."validation_status" = 'VALID'),
        CASE WHEN bool_or(c."environment" = 'live' AND c."validation_status" = 'VALID')
          THEN 'VALID' ELSE 'NOT_VALIDATED' END,
        max(c."validated_at") FILTER (WHERE c."environment" = 'live' AND c."validation_status" = 'VALID')
      FROM "tiramis_company_configurations" c
      ON CONFLICT ("id") DO NOTHING`);
    await queryRunner.query(
      `INSERT INTO "tiramis_platform_settings" ("id") VALUES ('platform') ON CONFLICT ("id") DO NOTHING`,
    );

    // One link per company that had a TIRAMIS configuration. Active when the
    // company had integration enabled and a validated configuration.
    await queryRunner.query(`
      INSERT INTO "tiramis_company_links" (
        "company_id", "company_name", "insurer_company_code",
        "insurer_company_name", "status", "linked_at", "activated_at"
      )
      SELECT DISTINCT ON (c."company_id")
        c."company_id",
        co."name",
        COALESCE(NULLIF(c."insurer_company_code", ''), c."company_code"),
        COALESCE(NULLIF(c."insurer_company_name", ''), co."name"),
        CASE WHEN co."tira_integration_enabled" AND EXISTS (
          SELECT 1 FROM "tiramis_company_configurations" v
           WHERE v."company_id" = c."company_id" AND v."validation_status" = 'VALID'
        ) THEN 'ACTIVE' ELSE 'LINKED' END,
        c."created_at",
        CASE WHEN co."tira_integration_enabled" THEN c."updated_at" END
      FROM "tiramis_company_configurations" c
      JOIN "companies" co ON co."id" = c."company_id"
      ORDER BY c."company_id", (c."environment" = 'test') DESC, c."created_at"`);

    for (const [name, displayName, description] of PLATFORM_PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO "permissions" (
           "id", "name", "display_name", "description", "is_system_generated",
           "assignment_scope", "assignable_to_company_role",
           "assignable_to_platform_role", "is_deprecated"
         )
         VALUES (uuid_generate_v4(), $1, $2, $3, true, 'platform', false, true, false)
         ON CONFLICT ("name") DO NOTHING`,
        [name, displayName, description],
      );
      await queryRunner.query(
        `INSERT INTO "permission_role" ("roles_id", "permissions_id")
         SELECT role."id", permission."id"
           FROM "roles" role
           CROSS JOIN "permissions" permission
          WHERE role."name" = 'OWNER' AND permission."name" = $1
         ON CONFLICT DO NOTHING`,
        [name],
      );
    }

    // Technical TIRAMIS permissions become platform-only.
    await queryRunner.query(
      `DELETE FROM "permission_role" pr
        USING "permissions" p, "roles" r
        WHERE pr."permissions_id" = p."id"
          AND pr."roles_id" = r."id"
          AND p."name" = ANY($1)
          AND r."scope" <> 'platform'`,
      [PLATFORM_ONLY_PERMISSIONS],
    );
    await queryRunner.query(
      `UPDATE "permissions"
          SET "assignment_scope" = 'platform',
              "assignable_to_company_role" = false,
              "assignable_to_platform_role" = true
        WHERE "name" = ANY($1)`,
      [PLATFORM_ONLY_PERMISSIONS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "permissions"
          SET "assignment_scope" = 'shared', "assignable_to_company_role" = true
        WHERE "name" = ANY($1)`,
      [PLATFORM_ONLY_PERMISSIONS],
    );
    await queryRunner.query(
      `DELETE FROM "permission_role" pr USING "permissions" p
        WHERE pr."permissions_id" = p."id" AND p."name" = ANY($1)`,
      [PLATFORM_PERMISSIONS.map(([name]) => name)],
    );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = ANY($1)`,
      [PLATFORM_PERMISSIONS.map(([name]) => name)],
    );
    await queryRunner.query(`DROP TABLE "tiramis_company_links"`);
    await queryRunner.query(`DROP TABLE "tiramis_platform_settings"`);
  }
}
