import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  {
    name: 'audit:verify-chain',
    displayName: 'Verify audit chain integrity',
    description: 'Validate the tamper-evident audit hash chain',
  },
  {
    name: 'operations:health-read',
    displayName: 'Read operational health metrics',
    description: 'View protected operational metrics and health telemetry',
  },
  {
    name: 'operations:release-read',
    displayName: 'Read release gate status',
    description: 'View deployment and release readiness status',
  },
] as const;

const ADMIN_ROLE_NAMES = [
  'OWNER',
  'SUPER_ADMIN',
  'ADMINISTRATOR',
  'INSURANCE_ADMIN',
  'REINSURANCE_ADMIN',
  'BROKER_ADMIN',
  'AGENCY_ADMIN',
  'BANCASSURANCE_ADMIN',
  'SERVICE_PROVIDER_ADMIN',
] as const;

export class Phase18OperationalPermissions1796301000000
  implements MigrationInterface
{
  name = 'Phase18OperationalPermissions1796301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `
          INSERT INTO "permissions" (
            "name",
            "display_name",
            "description",
            "is_system_generated",
            "assignment_scope",
            "assignable_to_company_role",
            "assignable_to_platform_role"
          )
          VALUES ($1, $2, $3, true, 'shared', true, true)
          ON CONFLICT ("name")
          DO UPDATE SET
            "display_name" = EXCLUDED."display_name",
            "description" = EXCLUDED."description",
            "is_system_generated" = true,
            "assignment_scope" = 'shared',
            "assignable_to_company_role" = true,
            "assignable_to_platform_role" = true,
            "is_deprecated" = false
        `,
        [permission.name, permission.displayName, permission.description],
      );
    }

    for (const roleName of ADMIN_ROLE_NAMES) {
      await queryRunner.query(
        `
          INSERT INTO "permission_role" ("roles_id", "permissions_id")
          SELECT role.id, permission.id
          FROM "roles" role
          INNER JOIN "permissions" permission
            ON permission.name IN (
              'audit:verify-chain',
              'operations:health-read',
              'operations:release-read'
            )
          WHERE role.name = $1
          ON CONFLICT DO NOTHING
        `,
        [roleName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "permission_role"
      WHERE "permissions_id" IN (
        SELECT id
        FROM "permissions"
        WHERE "name" IN (
          'audit:verify-chain',
          'operations:health-read',
          'operations:release-read'
        )
      )
    `);

    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "name" IN (
        'audit:verify-chain',
        'operations:health-read',
        'operations:release-read'
      )
    `);
  }
}
